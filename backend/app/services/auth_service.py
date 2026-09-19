import base64
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import secrets
import sqlite3
import time
from typing import Any, Dict, Optional
import uuid

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.services.alert_service import AlertService, get_alert_service

logger = logging.getLogger("ev_twinguard.auth_service")

# JWT secret configuration
JWT_SECRET = os.getenv("JWT_SECRET", "ev-twinguard-secure-jwt-secret-key-2026-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 86400 * 7  # 7 days

security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """
    Hashes password using PBKDF2-HMAC-SHA256 with 100,000 iterations and random salt.
    """
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}:{key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies plain password against stored salt:hash string using constant-time comparison.
    """
    try:
        parts = hashed_password.split(":")
        if len(parts) != 2:
            return False
        salt, key_hex = parts
        key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data_str: str) -> bytes:
    padding = 4 - (len(data_str) % 4)
    if padding != 4:
        data_str += "=" * padding
    return base64.urlsafe_b64decode(data_str)


def create_jwt_token(payload: Dict[str, Any], expires_in_seconds: int = JWT_EXPIRATION_SECONDS) -> str:
    """
    Generates an RFC 7519 compliant HMAC-SHA256 signed JSON Web Token (zero external dependencies).
    """
    now = int(time.time())
    full_payload = dict(payload)
    full_payload["iat"] = now
    full_payload["exp"] = now + expires_in_seconds

    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    header_json = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_json = json.dumps(full_payload, separators=(",", ":")).encode("utf-8")

    segment1 = _b64url_encode(header_json)
    segment2 = _b64url_encode(payload_json)
    signing_input = f"{segment1}.{segment2}".encode("utf-8")

    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    segment3 = _b64url_encode(signature)

    return f"{segment1}.{segment2}.{segment3}"


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """
    Decodes and cryptographically verifies an HMAC-SHA256 JWT.
    Raises HTTPException(401) on invalid signature, malformed token, or expiration.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    segment1, segment2, segment3 = parts
    signing_input = f"{segment1}.{segment2}".encode("utf-8")
    expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_sig = _b64url_decode(segment3)
        if not hmac.compare_digest(actual_sig, expected_sig):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload_bytes = _b64url_decode(segment2)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Check expiration
        exp = payload.get("exp")
        if exp and int(exp) < int(time.time()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Failed to decode token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthService:
    _instance: Optional["AuthService"] = None

    def __init__(self, alert_service: Optional[AlertService] = None):
        self.alert_service = alert_service or get_alert_service()
        self.seed_default_owner_if_not_exists()

    @classmethod
    def get_instance(cls) -> "AuthService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        return self.alert_service._get_connection()

    def seed_default_owner_if_not_exists(self):
        """
        Seeds default OWNER accounts:
        1. Primary Owner: Configured via OWNER_EMAIL and OWNER_PASSWORD (defaults to thamaraiselvid14@gmail.com).
        2. System Test Owner: owner@evtwinguard.io for automated test suites.
        Never creates duplicate accounts; all passwords securely hashed with PBKDF2.
        """
        owner_email = os.getenv("OWNER_EMAIL", "owner@evtwinguard.io").strip().lower()
        owner_password = os.getenv("OWNER_PASSWORD", "OwnerPassword@2026")

        with self._get_connection() as conn:
            now = datetime.now(timezone.utc).isoformat()

            # 1. Seed or update primary owner
            cur = conn.execute("SELECT * FROM users WHERE email = ? LIMIT 1", (owner_email,))
            primary_user = cur.fetchone()
            primary_hash = hash_password(owner_password)

            if primary_user:
                conn.execute("""
                    UPDATE users 
                    SET role = 'OWNER', password_hash = ?, updated_at = ?
                    WHERE id = ?
                """, (primary_hash, now, primary_user["id"]))
                conn.commit()
                logger.info(f"Updated primary OWNER account: {owner_email}")
            else:
                primary_id = "USR-OWNER-PRIMARY"
                conn.execute("""
                    INSERT INTO users (
                        id, name, email, phone, password_hash, role,
                        vehicle_model, battery_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    primary_id, "Thamarai Selvi (Fleet Owner)", owner_email,
                    os.getenv("TWILIO_TO_PHONE", "+1-800-555-0199"),
                    primary_hash, "OWNER", "Fleet Control", "ADMIN-PACK-01",
                    now, now
                ))
                conn.commit()
                logger.info(f"Created primary OWNER account: {owner_email}")

            # 2. Seed test owner for test suites if different from primary owner
            if owner_email != "owner@evtwinguard.io":
                cur_test = conn.execute("SELECT * FROM users WHERE email = 'owner@evtwinguard.io' LIMIT 1")
                test_user = cur_test.fetchone()
                if not test_user:
                    test_hash = hash_password("Owner@EV2026!")
                    conn.execute("""
                        INSERT INTO users (
                            id, name, email, phone, password_hash, role,
                            vehicle_model, battery_id, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        "USR-OWNER-DEVTEST", "Fleet Operations Admin", "owner@evtwinguard.io",
                        "+1-800-555-0199", test_hash, "OWNER", "Admin Fleet Control", "ADMIN-PACK-01",
                        now, now
                    ))
                    conn.commit()
                    logger.info("Seeded test owner account: owner@evtwinguard.io")

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def create_customer(
        self,
        full_name: str,
        email: str,
        mobile_number: str,
        password: str,
        vehicle_model: str,
        battery_id: str,
    ) -> Dict[str, Any]:
        """
        Registers customer strictly with role = 'CUSTOMER'.
        Validates duplicate email and hashes password securely.
        """
        clean_email = email.strip().lower()
        if self.get_user_by_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered. A user with this email address already exists. Please sign in or use another email.",
            )

        user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        pw_hash = hash_password(password)

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO users (
                    id, name, email, phone, password_hash, role,
                    vehicle_model, battery_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id, full_name.strip(), clean_email, mobile_number.strip(),
                pw_hash, "CUSTOMER", vehicle_model.strip(), battery_id.strip(),
                now, now
            ))
            conn.commit()

        created_user = self.get_user_by_id(user_id)
        assert created_user is not None
        # Remove sensitive password hash from return dictionary
        created_user.pop("password_hash", None)
        return created_user

    def authenticate_user(self, email: str, password: str, expected_role: Optional[str] = None) -> Dict[str, Any]:
        user = self.get_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password. Please verify your credentials.",
            )

        if not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password. Please verify your credentials.",
            )

        if expected_role and user["role"] != expected_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {expected_role}.",
            )

        token = create_jwt_token({
            "sub": user["id"],
            "role": user["role"],
            "email": user["email"],
            "name": user["name"],
        })

        safe_user = dict(user)
        safe_user.pop("password_hash", None)

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": safe_user,
        }

    def change_password(self, user_id: str, current_password: str, new_password: str) -> Dict[str, Any]:
        """
        Securely changes customer password after verifying current password.
        Hashes new password with PBKDF2-HMAC-SHA256.
        """
        if not new_password or len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters long.",
            )

        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

            stored_hash = user["password_hash"]
            if not verify_password(current_password, stored_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect.",
                )

            new_hash = hash_password(new_password)
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (new_hash, now, user_id),
            )
            conn.commit()

        logger.info(f"Password changed successfully for user ID {user_id}")
        return {"success": True, "message": "Password changed successfully."}


def get_auth_service() -> AuthService:
    return AuthService.get_instance()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    """
    Dependency that extracts the Bearer token, validates it, and fetches the authenticated user.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_payload = decode_jwt_token(credentials.credentials)
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_dict = dict(user)
    user_dict.pop("password_hash", None)
    return user_dict


async def require_customer(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Enforces that authenticated user has role == 'CUSTOMER'.
    """
    if current_user.get("role") != "CUSTOMER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Customer role required.",
        )
    return current_user


async def require_owner(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Enforces that authenticated user has role == 'OWNER'.
    """
    if current_user.get("role") != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Owner role required.",
        )
    return current_user
