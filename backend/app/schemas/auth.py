from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
import re


class CustomerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Full Name")
    email: str = Field(..., min_length=5, max_length=120, description="Valid Email Address")
    mobile_number: str = Field(..., min_length=7, max_length=20, description="Mobile / Phone Number")
    password: str = Field(..., min_length=6, max_length=100, description="Password (min 6 characters)")
    confirm_password: str = Field(..., min_length=6, max_length=100, description="Password Confirmation")
    vehicle_model: str = Field(..., min_length=2, max_length=100, description="EV Vehicle Model (e.g. Tata Nexon EV)")
    battery_id: Optional[str] = Field(None, min_length=2, max_length=50, description="Battery ID (e.g. BAT-NX-01)")
    battery_pack_id: Optional[str] = Field(None, min_length=2, max_length=50, description="Battery Pack ID alias")

    @model_validator(mode="before")
    @classmethod
    def resolve_battery_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            bid = data.get("battery_id") or data.get("battery_pack_id")
            if not bid or len(str(bid).strip()) < 2:
                raise ValueError("Battery Pack ID is required (minimum 2 characters)")
            data["battery_id"] = str(bid).strip()
            data["battery_pack_id"] = str(bid).strip()
        return data

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Invalid email format")
        return clean

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_format(cls, v: str) -> str:
        clean = v.strip()
        if not re.match(r"^\+?[0-9\s\-]{7,20}$", clean):
            raise ValueError("Invalid mobile phone number format")
        return clean

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered Email")
    password: str = Field(..., description="Account Password")

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: str
    vehicle_model: str
    battery_id: str
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
