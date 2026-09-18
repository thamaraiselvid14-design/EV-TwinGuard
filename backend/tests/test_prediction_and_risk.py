import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.battery import BatteryInput, BatteryPredictionRequest, RiskAssessmentRequest
from app.services.prediction_service import get_prediction_service
from app.services.risk_service import (
    RiskAssessmentService,
    get_risk_service,
    WEIGHT_TEMPERATURE,
    WEIGHT_SOC,
    WEIGHT_CHARGING_CURRENT,
    WEIGHT_BATTERY_AGE,
    WEIGHT_CHARGING_CYCLES,
    RISK_THRESHOLD_LOW_MAX,
    RISK_THRESHOLD_MEDIUM_MAX,
)

client = TestClient(app)


@pytest.fixture
def nominal_battery():
    return BatteryInput(
        battery_id="EV-TEST-NOMINAL",
        soc=55.0,
        voltage=395.0,
        charging_current=15.0,
        battery_temperature=28.0,
        ambient_temperature=24.0,
        battery_age=6.0,
        charging_cycles=120,
    )


@pytest.fixture
def critical_battery():
    return BatteryInput(
        battery_id="EV-TEST-CRITICAL",
        soc=92.0,
        voltage=418.0,
        charging_current=75.0,
        battery_temperature=56.5,
        ambient_temperature=38.0,
        battery_age=36.0,
        charging_cycles=1400,
    )


def test_prediction_service_nominal(nominal_battery):
    service = get_prediction_service()
    res = service.predict(nominal_battery)
    assert res.predicted_future_temperature > 20.0
    assert res.predicted_future_temperature < 50.0
    assert res.confidence_score >= 0.70
    assert "charging_current" in res.feature_contributions
    assert "current_temperature" in res.feature_contributions


def test_prediction_service_critical(critical_battery):
    service = get_prediction_service()
    res = service.predict(critical_battery)
    assert res.predicted_future_temperature > 50.0
    assert res.thermal_status in ["ELEVATED", "CRITICAL"]


def test_direct_predict_endpoint():
    payload = {
        "battery_id": "EV-FAST-TEST",
        "soc": 80.0,
        "voltage": 405.0,
        "charging_current": 50.0,
        "current_temperature": 35.0,
        "ambient_temperature": 28.0,
        "battery_age": 12.0,
        "charging_cycles": 300,
    }
    resp1 = client.post("/predict", json=payload)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "predicted_future_temperature" in data1
    assert data1["predicted_future_temperature"] > 30.0


def test_risk_assessment_endpoint_low_tier():
    payload = {
        "predicted_future_temperature": 28.0,
        "soc": 40.0,
        "charging_current": 15.0,
        "battery_age": 6.0,
        "charging_cycles": 100,
    }
    resp = client.post("/risk-assessment", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "risk_score" in data
    assert "risk_level" in data
    assert "main_risk_factors" in data
    assert data["risk_score"] <= RISK_THRESHOLD_LOW_MAX
    assert data["risk_level"] == "LOW"
    assert data["level"] == "LOW"


def test_risk_assessment_endpoint_medium_tier():
    payload = {
        "predicted_future_temperature": 44.0,
        "soc": 78.0,
        "charging_current": 42.0,
        "battery_age": 20.0,
        "charging_cycles": 500,
    }
    resp = client.post("/risk-assessment", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_score"] >= 40.0
    assert data["risk_score"] <= RISK_THRESHOLD_MEDIUM_MAX
    assert data["risk_level"] == "MEDIUM"
    assert any("temperature" in f.lower() or "current" in f.lower() for f in data["main_risk_factors"])


def test_risk_assessment_endpoint_high_tier():
    payload = {
        "predicted_future_temperature": 55.0,
        "soc": 90.0,
        "charging_current": 70.0,
        "battery_age": 42.0,
        "charging_cycles": 1200,
    }
    resp = client.post("/risk-assessment", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_score"] >= 70.0
    assert data["risk_level"] == "HIGH"
    assert "High State of Charge (SOC > 80%)" in data["main_risk_factors"]
    assert "High charging current" in data["main_risk_factors"]
    assert len(data["recommendations"]) > 0


def test_configurable_risk_weights():
    # Verify constants exist and sum to 1.0
    total_weights = (
        WEIGHT_TEMPERATURE +
        WEIGHT_SOC +
        WEIGHT_CHARGING_CURRENT +
        WEIGHT_BATTERY_AGE +
        WEIGHT_CHARGING_CYCLES
    )
    assert round(total_weights, 4) == 1.0000
    assert RISK_THRESHOLD_LOW_MAX == 39.0
    assert RISK_THRESHOLD_MEDIUM_MAX == 69.0
