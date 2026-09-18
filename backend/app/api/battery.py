import logging
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.data.dataset_service import DatasetService, get_dataset_service
from app.schemas.battery import (
    AlertAcknowledgeRequest,
    AlertHistoryItem,
    AlertItem,
    AlertSimulateRequest,
    BatteryInput,
    BatteryPredictionRequest,
    BatteryValidationResponse,
    ComprehensiveAnalysisResponse,
    PredictionResult,
    RiskAssessment,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
    SimulationRequest,
    SimulationResponse,
    ChargingSimulationRequest,
    ChargingSimulationResponse,
)

from app.services.alert_service import AlertService, get_alert_service
from app.services.prediction_service import PredictionService, get_prediction_service
from app.services.risk_service import RiskAssessmentService, get_risk_service
from app.services.simulation_service import DigitalTwinSimulationService, get_simulation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/battery", tags=["EV Battery Digital Twin"])


@router.post(
    "/manual-input",
    response_model=BatteryValidationResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate and Receive Manual EV Battery Data (Phase 1)",
    description="Validates physical telemetry parameters and echoes back validated data.",
)
async def submit_manual_battery_input(battery_data: BatteryInput) -> BatteryValidationResponse:
    logger.info(f"Validated manual battery telemetry for: {battery_data.battery_id}")
    return BatteryValidationResponse(
        status="validated",
        message="Battery data validated successfully.",
        data=battery_data,
    )


@router.post(
    "/predict",
    response_model=PredictionResult,
    status_code=status.HTTP_200_OK,
    summary="Predict Future Battery Temperature (Scikit-learn Model)",
    description="Takes physical battery parameters and returns predicted future temperature.",
)
async def predict_battery_temperature(
    battery_data: BatteryPredictionRequest,
    pred_service: PredictionService = Depends(get_prediction_service),
) -> PredictionResult:
    result = pred_service.predict(battery_data)
    logger.info(f"AI Prediction for {battery_data.battery_id}: Future Temp = {result.predicted_future_temperature}°C")
    return result


@router.post(
    "/risk-assessment",
    response_model=RiskAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Multi-Factor Battery Risk Score & Drivers",
    description="Given predicted future temperature plus battery inputs, computes a 0-100 risk score, classifies as LOW (0-39), MEDIUM (40-69), or HIGH (70-100), outputs main risk factors, and automatically fires email/call alerts on Medium/High risk.",
)
async def assess_risk_endpoint(
    req: RiskAssessmentRequest,
    risk_service: RiskAssessmentService = Depends(get_risk_service),
) -> RiskAssessmentResponse:
    return risk_service.assess_risk(req, trigger_alerts=True)



@router.post(
    "/assess-risk",
    response_model=RiskAssessment,
    status_code=status.HTTP_200_OK,
    summary="Legacy Assess Risk Endpoint",
)
async def assess_battery_risk(
    battery_data: BatteryInput,
    pred_service: PredictionService = Depends(get_prediction_service),
    risk_service: RiskAssessmentService = Depends(get_risk_service),
    alert_service: AlertService = Depends(get_alert_service),
) -> RiskAssessment:
    prediction = pred_service.predict(battery_data)
    risk = risk_service.calculate_risk(battery_data, prediction)
    alert_service.process_telemetry_risk(battery_data, risk)
    return risk


@router.post(
    "/analyze",
    response_model=ComprehensiveAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Unified End-to-End Battery Analysis",
    description="Performs complete telemetry validation, AI temperature prediction, multi-factor risk assessment, and alert dispatch evaluation in a single call.",
)
async def analyze_battery_system(
    battery_data: BatteryInput,
    pred_service: PredictionService = Depends(get_prediction_service),
    risk_service: RiskAssessmentService = Depends(get_risk_service),
    alert_service: AlertService = Depends(get_alert_service),
) -> ComprehensiveAnalysisResponse:
    prediction = pred_service.predict(battery_data)
    risk = risk_service.calculate_risk(battery_data, prediction)
    alert_service.process_telemetry_risk(battery_data, risk)

    return ComprehensiveAnalysisResponse(
        battery_id=battery_data.battery_id,
        telemetry=battery_data,
        prediction=prediction,
        risk_assessment=risk,
    )


@router.post(
    "/simulate-charging",
    response_model=ChargingSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="What-If Charging Simulator",
    description="Evaluates battery thermal and risk behavior across 12A, 18A, and 25A charging currents using the existing ML prediction model and risk service.",
)
async def simulate_charging_endpoint(
    req: ChargingSimulationRequest,
    sim_service: DigitalTwinSimulationService = Depends(get_simulation_service),
) -> ChargingSimulationResponse:
    logger.info(f"Running What-If charging simulation for battery {req.battery_id}")
    return sim_service.simulate_charging_scenarios(req)


@router.post(
    "/simulate",
    response_model=SimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Digital Twin Parametric Time-Series Simulation (Phase 5)",
    description="Runs a multi-step physics-grounded electro-thermal simulation over time to forecast SOC curves, temperature rises, and risk evolution.",
)
async def simulate_digital_twin(
    req: SimulationRequest,
    sim_service: DigitalTwinSimulationService = Depends(get_simulation_service),
) -> SimulationResponse:
    logger.info(f"Running Digital Twin simulation for {req.battery_id} ({req.duration_minutes} mins at {req.charging_current}A)")
    return sim_service.run_simulation(req)



@router.get(
    "/alerts",
    response_model=List[AlertItem],
    status_code=status.HTTP_200_OK,
    summary="Get Safety Alerts & Notifications (Phase 4)",
)
async def get_safety_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[AlertItem]:
    return alert_service.get_alerts(limit=limit)


@router.get(
    "/alerts/history",
    response_model=List[AlertHistoryItem],
    status_code=status.HTTP_200_OK,
    summary="Get Safety Alert History (Phase 4 SQLite Log)",
    description="Reads recorded alert events from SQLite alert_events table.",
)
async def get_safety_alert_history(
    limit: int = Query(default=50, ge=1, le=200),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[AlertHistoryItem]:
    return alert_service.get_alert_history(limit=limit)


@router.post(
    "/alerts/acknowledge",
    status_code=status.HTTP_200_OK,
    summary="Acknowledge Safety Alert",
)
async def acknowledge_alert(
    req: AlertAcknowledgeRequest,
    alert_service: AlertService = Depends(get_alert_service),
):
    success = alert_service.acknowledge_alert(req.alert_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")
    return {"status": "acknowledged", "alert_id": req.alert_id}


@router.post(
    "/alerts/simulate",
    status_code=status.HTTP_200_OK,
    summary="Simulate Safety Alert Dispatch",
)
async def simulate_alert_dispatch(
    req: AlertSimulateRequest,
    alert_service: AlertService = Depends(get_alert_service),
):
    return alert_service.simulate_custom_alert(req)


@router.get(
    "/dataset/sample",
    status_code=status.HTTP_200_OK,
    summary="Sample Dataset Telemetry Records",
)
async def sample_dataset_records(
    n: int = Query(default=10, ge=1, le=100),
    dataset_service: DatasetService = Depends(get_dataset_service),
):
    records = dataset_service.sample_records(n=n)
    return {"count": len(records), "data": records}
