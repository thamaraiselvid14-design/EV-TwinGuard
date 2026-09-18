import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.battery import ChargingSimulationRequest
from app.services.simulation_service import (
    SIMULATION_CURRENTS,
    get_simulation_service,
)

client = TestClient(app)


def test_simulate_charging_endpoint_structure_and_scenarios():
    payload = {
        "battery_id": "EV001",
        "soc": 80.0,
        "voltage": 405.0,
        "charging_current": 18.0,
        "current_temperature": 35.0,
        "ambient_temperature": 28.0,
        "battery_age": 12.0,
        "charging_cycles": 300,
    }

    # Test direct POST /simulate-charging
    resp = client.post("/simulate-charging", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["battery_id"] == "EV001"
    assert "current_battery_state" in data
    assert data["current_battery_state"]["soc"] == 80.0
    assert data["current_battery_state"]["voltage"] == 405.0
    assert data["current_battery_state"]["current_temperature"] == 35.0

    scenarios = data["scenarios"]
    assert len(scenarios) == 3

    # Check currents match SIMULATION_CURRENTS [12.0, 18.0, 25.0]
    currents = [s["charging_current"] for s in scenarios]
    assert currents == [12.0, 18.0, 25.0]

    for s in scenarios:
        assert "predicted_future_temperature" in s
        assert "risk_score" in s
        assert "risk_level" in s
        assert s["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
        assert isinstance(s["main_risk_factors"], list)

    # Higher charging current should yield equal or higher predicted temperature
    temp_12 = scenarios[0]["predicted_future_temperature"]
    temp_18 = scenarios[1]["predicted_future_temperature"]
    temp_25 = scenarios[2]["predicted_future_temperature"]
    assert temp_12 <= temp_18 <= temp_25

    # Higher charging current should yield equal or higher risk score
    risk_12 = scenarios[0]["risk_score"]
    risk_18 = scenarios[1]["risk_score"]
    risk_25 = scenarios[2]["risk_score"]
    assert risk_12 <= risk_18 <= risk_25


def test_simulate_charging_api_prefix_endpoint():
    payload = {
        "battery_id": "EV-PREFIX-02",
        "soc": 65.0,
        "voltage": 395.0,
        "charging_current": 12.0,
        "current_temperature": 29.0,
        "ambient_temperature": 24.0,
        "battery_age": 8.0,
        "charging_cycles": 180,
    }

    resp = client.post("/api/battery/simulate-charging", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["battery_id"] == "EV-PREFIX-02"
    assert len(data["scenarios"]) == 3
