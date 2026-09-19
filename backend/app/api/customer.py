import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.schemas.auth import UserResponse
from app.schemas.battery import (
    BatteryInput,
    PredictionResult,
    RiskAssessment,
)
from app.services.alert_service import AlertService, get_alert_service
from app.services.auth_service import AuthService, get_auth_service, get_current_user, require_customer
from app.services.prediction_service import PredictionService, get_prediction_service
from app.services.risk_service import RiskAssessmentService, get_risk_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customer", tags=["Customer Portal"])


class CustomerBatteryAnalyzeRequest(BaseModel):
    battery_temperature: float = Field(..., description="Battery Temperature (°C)")
    current: float = Field(..., description="Charging / Operating Current (A)")
    voltage: float = Field(..., gt=0.0, description="Battery Pack Voltage (V)")
    soc: float = Field(..., ge=0.0, le=100.0, description="State of Charge (SOC %)")
    battery_age: float = Field(..., ge=0.0, description="Battery Age in Months")
    charging_cycles: int = Field(..., ge=0, description="Charge / Discharge Cycles")
    ambient_temperature: Optional[float] = Field(default=25.0, description="Ambient Environmental Temperature (°C)")
    battery_id: Optional[str] = Field(default=None, description="Battery ID (defaults to user battery ID)")


@router.get(
    "/profile",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Customer Profile",
    description="Returns authenticated customer personal details and vehicle/battery specs.",
)
async def get_customer_profile(
    current_user: dict = Depends(require_customer),
) -> UserResponse:
    return UserResponse(**current_user)


@router.get(
    "/analyses",
    status_code=status.HTTP_200_OK,
    summary="Get Customer Battery Analysis History",
    description="Returns all previously performed battery analyses for the authenticated customer.",
)
async def get_customer_analyses(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(require_customer),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[Dict[str, Any]]:
    return alert_service.get_customer_analyses(user_id=current_user["id"], limit=limit)


@router.get(
    "/alerts",
    status_code=status.HTTP_200_OK,
    summary="Get Customer Alert History",
    description="Returns safety alert events and acknowledgments for the authenticated customer.",
)
async def get_customer_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(require_customer),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[Dict[str, Any]]:
    return alert_service.get_customer_alerts(user_id=current_user["id"], limit=limit)


@router.post(
    "/battery/analyze",
    status_code=status.HTTP_200_OK,
    summary="Perform Customer Battery AI Analysis & Risk Assessment",
    description="Validates battery telemetry, predicts temperature using existing ML model, computes risk level, records analysis, and triggers appropriate alert logic.",
)
async def customer_analyze_battery(
    req: CustomerBatteryAnalyzeRequest,
    current_user: dict = Depends(require_customer),
    pred_service: PredictionService = Depends(get_prediction_service),
    risk_service: RiskAssessmentService = Depends(get_risk_service),
    alert_service: AlertService = Depends(get_alert_service),
) -> Dict[str, Any]:
    battery_id = (req.battery_id or current_user.get("battery_id") or "EV-BAT-01").strip()
    ambient_temp = req.ambient_temperature if req.ambient_temperature is not None else 25.0

    # 1. Format for existing ML model
    model_input = {
        "battery_id": battery_id,
        "soc": req.soc,
        "voltage": req.voltage,
        "charging_current": req.current,
        "current_temperature": req.battery_temperature,
        "ambient_temperature": ambient_temp,
        "battery_age": req.battery_age,
        "charging_cycles": req.charging_cycles,
    }

    # 2. Predict Future Temperature
    prediction: PredictionResult = pred_service.predict(model_input)

    # 3. Calculate Risk Assessment
    battery_input_obj = BatteryInput(
        battery_id=battery_id,
        soc=req.soc,
        voltage=req.voltage,
        charging_current=req.current,
        battery_temperature=req.battery_temperature,
        ambient_temperature=ambient_temp,
        battery_age=req.battery_age,
        charging_cycles=req.charging_cycles,
    )
    risk: RiskAssessment = risk_service.calculate_risk(battery_input_obj, prediction)

    # 4. Save analysis to SQLite database
    analysis_id = alert_service.save_battery_analysis(
        user_id=current_user["id"],
        temperature=req.battery_temperature,
        current=req.current,
        voltage=req.voltage,
        soc=req.soc,
        battery_age=req.battery_age,
        cycles=req.charging_cycles,
        predicted_temperature=prediction.predicted_future_temperature,
        risk_value=risk.overall_risk_score,
        risk_level=risk.risk_level,
    )

    # 5. Evaluate strict Alert Logic
    alert_info = alert_service.create_customer_alert(
        analysis_id=analysis_id,
        user_id=current_user["id"],
        battery_id=battery_id,
        risk_score=risk.overall_risk_score,
        risk_level=risk.risk_level,
        predicted_temperature=prediction.predicted_future_temperature,
        current_temperature=req.battery_temperature,
        soc=req.soc,
        charging_current=req.current,
        voltage=req.voltage,
        battery_age=req.battery_age,
        charging_cycles=req.charging_cycles,
        main_risk_factors=risk.main_risk_factors or [],
        recommendations=risk.recommendations or [],
        ambient_temperature=ambient_temp,
    )

    logger.info(
        f"Customer {current_user['email']} analyzed {battery_id}: "
        f"Pred Temp = {prediction.predicted_future_temperature:.1f}°C, "
        f"Risk = {risk.overall_risk_score:.1f} ({risk.risk_level})"
    )

    return {
        "analysis_id": analysis_id,
        "battery_id": battery_id,
        "predicted_temperature": round(prediction.predicted_future_temperature, 1),
        "risk_value": round(risk.overall_risk_score, 1),
        "risk_level": risk.risk_level,
        "main_risk_factors": risk.main_risk_factors,
        "recommendations": risk.recommendations,
        "alert": alert_info,
        "telemetry": {
            "battery_temperature": req.battery_temperature,
            "current": req.current,
            "voltage": req.voltage,
            "soc": req.soc,
            "battery_age": req.battery_age,
            "charging_cycles": req.charging_cycles,
            "ambient_temperature": ambient_temp,
        },
    }


@router.post(
    "/alerts/{alert_id}/acknowledge",
    status_code=status.HTTP_200_OK,
    summary="Acknowledge Safety Alert",
    description="Customer acknowledges a Medium or High risk alert. For High risk within 1 minute, cancels escalation and sends email report.",
)
async def customer_acknowledge_alert(
    alert_id: str,
    current_user: dict = Depends(require_customer),
    alert_service: AlertService = Depends(get_alert_service),
) -> Dict[str, Any]:
    result = alert_service.acknowledge_customer_alert(
        alert_id=alert_id,
        user_id=current_user["id"],
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "Alert not found or access denied."),
        )
    return result


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current password")
    new_password: str = Field(..., min_length=6, description="New password (minimum 6 characters)")


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change Customer Password",
    description="Updates password after verifying the customer's current password.",
)
async def customer_change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(require_customer),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    return auth_service.change_password(
        user_id=current_user["id"],
        current_password=req.current_password,
        new_password=req.new_password,
    )
