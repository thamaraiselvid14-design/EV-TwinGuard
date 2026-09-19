import asyncio
from contextlib import asynccontextmanager
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
from app.api.battery import router as battery_router
from app.api.realtime import router as realtime_router
from app.api.auth import router as auth_router
from app.api.customer import router as customer_router
from app.api.owner import router as owner_router
from typing import List
from app.schemas.battery import (
    AlertHistoryItem,
    BatteryPredictionRequest,
    ChargingSimulationRequest,
    ChargingSimulationResponse,
    PredictionResult,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)
from app.services.alert_service import AlertService, get_alert_service
from app.services.prediction_service import PredictionService, get_prediction_service
from app.services.risk_service import RiskAssessmentService, get_risk_service
from app.services.simulation_service import DigitalTwinSimulationService, get_simulation_service

# Load environment variables from .env if present
base_dir = Path(__file__).resolve().parent.parent
load_dotenv(base_dir / ".env")
load_dotenv(base_dir.parent / ".env")


async def escalation_background_worker():
    """Periodically checks and escalates unacknowledged high-risk alerts past deadline."""
    alert_service = get_alert_service()
    while True:
        try:
            alert_service.check_and_escalate_pending_alerts()
        except Exception:
            pass
        await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup hook: Ensure database and default owner are seeded
    from app.services.auth_service import get_auth_service
    get_auth_service().seed_default_owner_if_not_exists()
    worker_task = asyncio.create_task(escalation_background_worker())
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="EV TwinGuard API",
    description="API for EV battery Digital Twin, ML temperature prediction, multi-factor risk scoring, and safety monitoring.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [
    frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
allowed_origins = list(dict.fromkeys(filter(None, origins)))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api prefix
app.include_router(api_router, prefix="/api")
app.include_router(battery_router, prefix="/api")
app.include_router(realtime_router, prefix="/api")
app.include_router(realtime_router)
app.include_router(auth_router, prefix="/api")
app.include_router(customer_router, prefix="/api")
app.include_router(owner_router, prefix="/api")


@app.post(
    "/predict",
    response_model=PredictionResult,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"],
    summary="Predict Future Battery Temperature",
    description="Takes physical battery parameters (SOC, voltage, charging current, current temperature, ambient temperature, battery age, charging cycles) and returns predicted future temperature.",
)
async def direct_predict_endpoint(
    battery_data: BatteryPredictionRequest,
    pred_service: PredictionService = Depends(get_prediction_service),
) -> PredictionResult:
    return pred_service.predict(battery_data)


@app.post(
    "/risk-assessment",
    response_model=RiskAssessmentResponse,
    status_code=status.HTTP_200_OK,
    tags=["Risk Assessment"],
    summary="Multi-Factor Risk Assessment",
    description="Given predicted future temperature plus battery inputs, computes a 0-100 risk score, classifies as LOW (0-39), MEDIUM (40-69), or HIGH (70-100), and returns key risk driving factors.",
)
async def direct_risk_assessment_endpoint(
    req: RiskAssessmentRequest,
    risk_service: RiskAssessmentService = Depends(get_risk_service),
) -> RiskAssessmentResponse:
    return risk_service.assess_risk(req)


@app.post(
    "/simulate-charging",
    response_model=ChargingSimulationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Simulation"],
    summary="What-If Charging Simulator",
    description="Evaluates battery thermal and risk behavior across 12A, 18A, and 25A charging currents.",
)
async def direct_simulate_charging_endpoint(
    req: ChargingSimulationRequest,
    sim_service: DigitalTwinSimulationService = Depends(get_simulation_service),
) -> ChargingSimulationResponse:
    return sim_service.simulate_charging_scenarios(req)


@app.get(
    "/alerts/history",
    response_model=List[AlertHistoryItem],
    status_code=status.HTTP_200_OK,
    tags=["Alerts"],
    summary="Get Safety Alert History",
    description="Reads recorded alert events from SQLite alert_events table.",
)
async def direct_get_alert_history(
    limit: int = 50,
    alert_service: AlertService = Depends(get_alert_service),
) -> List[AlertHistoryItem]:
    return alert_service.get_alert_history(limit=limit)


@app.get(
    "/alerts/email-status",
    tags=["Alerts"],
    summary="Get Safe Email Configuration Status",
    description="Reports whether SMTP and recipient are configured without exposing passwords.",
)
async def direct_get_email_status(
    alert_service: AlertService = Depends(get_alert_service),
):
    return alert_service.get_email_config_status()



@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Welcome to EV TwinGuard API",
        "docs": "/docs",
        "health": "/api/health",
        "predict": "/predict",
        "risk_assessment": "/risk-assessment",
        "simulate_charging": "/simulate-charging",
    }
