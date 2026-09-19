from datetime import datetime, timezone, timedelta
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.alert_service import get_alert_service
from app.services.auth_service import get_auth_service

client = TestClient(app)


def test_customer_registration_and_validation():
    # 1. Successful registration
    reg_payload = {
        "full_name": "Arun Kumar",
        "email": f"arun_{datetime.now().timestamp()}@example.com",
        "mobile_number": "+919876543210",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "vehicle_model": "Tata Nexon EV Max",
        "battery_id": "BAT-NX-882",
    }
    resp = client.post("/api/auth/customer/register", json=reg_payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "Arun Kumar"
    assert data["role"] == "CUSTOMER"  # Role strictly CUSTOMER
    assert data["vehicle_model"] == "Tata Nexon EV Max"
    assert data["battery_id"] == "BAT-NX-882"
    assert "password" not in data
    assert "password_hash" not in data

    # 2. Duplicate registration fails
    dup_resp = client.post("/api/auth/customer/register", json=reg_payload)
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"].lower()

    # 3. Password mismatch validation
    mismatch_payload = dict(reg_payload)
    mismatch_payload["email"] = "other@example.com"
    mismatch_payload["confirm_password"] = "Mismatch123!"
    bad_resp = client.post("/api/auth/customer/register", json=mismatch_payload)
    assert bad_resp.status_code == 422


def test_customer_and_owner_login_flows():
    email = f"logintest_{datetime.now().timestamp()}@example.com"
    reg_payload = {
        "full_name": "Login Tester",
        "email": email,
        "mobile_number": "+15552345678",
        "password": "TestPassword123!",
        "confirm_password": "TestPassword123!",
        "vehicle_model": "MG ZS EV",
        "battery_id": "BAT-MG-102",
    }
    client.post("/api/auth/customer/register", json=reg_payload)

    # Customer login
    login_resp = client.post("/api/auth/customer/login", json={
        "email": email,
        "password": "TestPassword123!",
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    customer_token = token_data["access_token"]
    assert token_data["user"]["role"] == "CUSTOMER"

    # Access /api/customer/profile with customer token
    prof_resp = client.get("/api/customer/profile", headers={"Authorization": f"Bearer {customer_token}"})
    assert prof_resp.status_code == 200
    assert prof_resp.json()["email"] == email

    # Customer cannot access owner dashboard
    forbidden_resp = client.get("/api/owner/dashboard", headers={"Authorization": f"Bearer {customer_token}"})
    assert forbidden_resp.status_code == 403

    # Owner login
    owner_resp = client.post("/api/auth/owner/login", json={
        "email": "owner@evtwinguard.io",
        "password": "Owner@EV2026!",
    })
    assert owner_resp.status_code == 200
    owner_token = owner_resp.json()["access_token"]
    assert owner_resp.json()["user"]["role"] == "OWNER"

    # Owner accesses owner dashboard
    owner_dash = client.get("/api/owner/dashboard", headers={"Authorization": f"Bearer {owner_token}"})
    assert owner_dash.status_code == 200
    assert "total_customers" in owner_dash.json()
    assert "total_analyses" in owner_dash.json()

    # Owner cannot access customer profile directly as customer
    owner_as_cust = client.get("/api/customer/profile", headers={"Authorization": f"Bearer {owner_token}"})
    assert owner_as_cust.status_code == 403


def test_customer_isolation():
    # Customer 1
    c1_email = f"user1_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "User One",
        "email": c1_email,
        "mobile_number": "+15551111111",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "Tesla Model 3",
        "battery_id": "BAT-TSLA-01",
    })
    c1_token = client.post("/api/auth/customer/login", json={"email": c1_email, "password": "Password123!"}).json()["access_token"]

    # Customer 2
    c2_email = f"user2_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "User Two",
        "email": c2_email,
        "mobile_number": "+15552222222",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "Hyundai Ioniq 5",
        "battery_id": "BAT-HYU-02",
    })
    c2_token = client.post("/api/auth/customer/login", json={"email": c2_email, "password": "Password123!"}).json()["access_token"]

    # C1 performs an analysis
    anl_resp = client.post(
        "/api/customer/battery/analyze",
        headers={"Authorization": f"Bearer {c1_token}"},
        json={
            "battery_temperature": 28.0,
            "current": 10.0,
            "voltage": 400.0,
            "soc": 55.0,
            "battery_age": 6.0,
            "charging_cycles": 120,
        }
    )
    assert anl_resp.status_code == 200

    # C1 sees the analysis in their history
    c1_analyses = client.get("/api/customer/analyses", headers={"Authorization": f"Bearer {c1_token}"}).json()
    assert len(c1_analyses) >= 1
    assert c1_analyses[0]["temperature"] == 28.0

    # C2 history does NOT contain C1's analysis
    c2_analyses = client.get("/api/customer/analyses", headers={"Authorization": f"Bearer {c2_token}"}).json()
    assert len(c2_analyses) == 0


def test_low_risk_behavior():
    email = f"low_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "Low Risk Tester",
        "email": email,
        "mobile_number": "+15553333333",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "Nissan Leaf",
        "battery_id": "BAT-LEAF-01",
    })
    token = client.post("/api/auth/customer/login", json={"email": email, "password": "Password123!"}).json()["access_token"]

    # Low risk parameters
    resp = client.post(
        "/api/customer/battery/analyze",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "battery_temperature": 25.0,
            "current": 8.0,
            "voltage": 395.0,
            "soc": 45.0,
            "battery_age": 4.0,
            "charging_cycles": 80,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] == "LOW"
    assert data["alert"] is None  # LOW = Dashboard only, no alert created, no email, no SMS, no call


def test_medium_risk_behavior_email_always():
    email = f"med_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "Medium Risk Tester",
        "email": email,
        "mobile_number": "+15554444444",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "BMW i4",
        "battery_id": "BAT-BMW-01",
    })
    token = client.post("/api/auth/customer/login", json={"email": email, "password": "Password123!"}).json()["access_token"]

    # Medium risk parameters
    resp = client.post(
        "/api/customer/battery/analyze",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "battery_temperature": 43.0,
            "current": 48.0,
            "voltage": 405.0,
            "soc": 84.0,
            "battery_age": 20.0,
            "charging_cycles": 520,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] == "MEDIUM"
    alert = data["alert"]
    assert alert is not None
    assert alert["risk_level"] == "MEDIUM"
    assert alert["email_sent"] is True  # Email ALWAYS sent immediately
    assert alert["sms_sent"] is False   # No SMS
    assert alert["call_triggered"] is False  # No Call
    assert alert["acknowledged"] is False

    alert_id = alert["id"]

    # Customer acknowledges alert
    ack_resp = client.post(
        f"/api/customer/alerts/{alert_id}/acknowledge",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["email_sent"] is True
    assert ack_data["sms_sent"] is False
    assert ack_data["call_triggered"] is False

    # Double click acknowledge is idempotent
    ack2_resp = client.post(
        f"/api/customer/alerts/{alert_id}/acknowledge",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ack2_resp.status_code == 200
    assert ack2_resp.json()["status"] == "ALREADY_ACKNOWLEDGED"


def test_high_risk_acknowledged_within_60_seconds():
    email = f"high_ack_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "High Ack Tester",
        "email": email,
        "mobile_number": "+15555555555",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "Porsche Taycan",
        "battery_id": "BAT-TYC-01",
    })
    token = client.post("/api/auth/customer/login", json={"email": email, "password": "Password123!"}).json()["access_token"]

    # High risk parameters
    resp = client.post(
        "/api/customer/battery/analyze",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "battery_temperature": 56.0,
            "current": 75.0,
            "voltage": 418.0,
            "soc": 93.0,
            "battery_age": 36.0,
            "charging_cycles": 1100,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] == "HIGH"
    alert = data["alert"]
    assert alert is not None
    assert alert["risk_level"] == "HIGH"
    assert alert["status"] == "PENDING"
    assert alert["acknowledgement_deadline"] is not None  # 60s window
    assert alert["email_sent"] is False  # Waiting for 60s window
    assert alert["sms_sent"] is False
    assert alert["call_triggered"] is False

    alert_id = alert["id"]

    # User acknowledges within 1 minute
    ack_resp = client.post(
        f"/api/customer/alerts/{alert_id}/acknowledge",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["email_sent"] is True  # Report sent to email!
    assert ack_data["sms_sent"] is False   # No SMS
    assert ack_data["call_triggered"] is False  # No Call


def test_high_risk_timeout_escalation():
    email = f"high_timeout_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "Timeout Tester",
        "email": email,
        "mobile_number": "+15556666666",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "Audi e-tron",
        "battery_id": "BAT-ETRON-01",
    })
    token = client.post("/api/auth/customer/login", json={"email": email, "password": "Password123!"}).json()["access_token"]

    # High risk analysis
    resp = client.post(
        "/api/customer/battery/analyze",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "battery_temperature": 58.0,
            "current": 80.0,
            "voltage": 420.0,
            "soc": 95.0,
            "battery_age": 40.0,
            "charging_cycles": 1300,
        }
    )
    assert resp.status_code == 200
    alert_id = resp.json()["alert"]["id"]

    # Artificially expire the deadline in SQLite to test background escalation worker
    alert_service = get_alert_service()
    past_iso = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    with alert_service._get_connection() as conn:
        conn.execute(
            "UPDATE alert_events SET acknowledgement_deadline = ? WHERE id = ?",
            (past_iso, alert_id)
        )
        conn.commit()

    # Trigger escalation worker
    escalated_count = alert_service.check_and_escalate_pending_alerts()
    assert escalated_count >= 1

    # Check alert record state
    with alert_service._get_connection() as conn:
        row = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert_id,)).fetchone()
        assert row["status"] == "ESCALATED"
        assert row["escalated_at"] is not None
        assert row["email_sent"] == 1  # Email sent
        assert row["sms_sent"] == 1    # SMS sent
        assert row["call_triggered"] == 1  # Call triggered


def test_owner_customer_view_keeps_owner_role():
    # Register customer
    c_email = f"ownerview_{datetime.now().timestamp()}@example.com"
    c_reg = client.post("/api/auth/customer/register", json={
        "full_name": "Owner View Customer",
        "email": c_email,
        "mobile_number": "+15557777777",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "vehicle_model": "Lucid Air",
        "battery_id": "BAT-LCD-01",
    }).json()
    customer_id = c_reg["id"]

    # Login owner
    owner_token = client.post("/api/auth/owner/login", json={
        "email": "owner@evtwinguard.io",
        "password": "Owner@EV2026!",
    }).json()["access_token"]

    # Owner views customer
    view_resp = client.get(
        f"/api/owner/customers/{customer_id}",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert view_resp.status_code == 200
    view_data = view_resp.json()
    assert view_data["customer"]["id"] == customer_id
    assert view_data["customer"]["name"] == "Owner View Customer"
    assert "analyses" in view_data
    assert "alerts" in view_data

    # Check that owner's profile still shows role == OWNER (Owner token was never swapped!)
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {owner_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "OWNER"


def test_customer_change_password():
    email = f"pwdtest_{datetime.now().timestamp()}@example.com"
    client.post("/api/auth/customer/register", json={
        "full_name": "Password Test User",
        "email": email,
        "mobile_number": "+15559998888",
        "password": "OldPassword123!",
        "confirm_password": "OldPassword123!",
        "vehicle_model": "Tesla Model Y",
        "battery_id": "BAT-TSLA-Y",
    })

    # Login with old password
    login_resp = client.post("/api/auth/customer/login", json={
        "email": email,
        "password": "OldPassword123!",
    })
    token = login_resp.json()["access_token"]

    # Wrong current password fails
    bad_resp = client.post(
        "/api/customer/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "WrongPassword!", "new_password": "NewPassword123!"}
    )
    assert bad_resp.status_code == 400

    # Short new password fails
    short_resp = client.post(
        "/api/customer/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "OldPassword123!", "new_password": "123"}
    )
    assert short_resp.status_code == 422  # Pydantic min_length=6

    # Successful change
    good_resp = client.post(
        "/api/customer/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "OldPassword123!", "new_password": "NewPassword123!"}
    )
    assert good_resp.status_code == 200
    assert good_resp.json()["success"] is True

    # Login with old password now fails
    fail_login = client.post("/api/auth/customer/login", json={
        "email": email,
        "password": "OldPassword123!",
    })
    assert fail_login.status_code == 401

    # Login with new password succeeds
    success_login = client.post("/api/auth/customer/login", json={
        "email": email,
        "password": "NewPassword123!",
    })
    assert success_login.status_code == 200
