import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.battery import AlertSimulateRequest, SimulationRequest
from app.services.alert_service import get_alert_service
from app.services.simulation_service import get_simulation_service

client = TestClient(app)


def test_digital_twin_simulation_service():
    sim_svc = get_simulation_service()
    req = SimulationRequest(
        battery_id="EV-SIM-TEST",
        initial_soc=20.0,
        pack_voltage=400.0,
        charging_current=60.0,
        ambient_temperature=28.0,
        battery_age=12.0,
        charging_cycles=300,
        duration_minutes=40,
        time_step_minutes=5,
        cooling_efficiency=0.7,
    )
    res = sim_svc.run_simulation(req)

    assert res.battery_id == "EV-SIM-TEST"
    assert res.final_soc > res.initial_soc
    assert res.max_temperature >= res.initial_temperature
    assert len(res.timeline) == 9  # 0, 5, 10, 15, 20, 25, 30, 35, 40 min
    assert res.timeline[0].time_min == 0
    assert res.timeline[-1].time_min == 40


def test_alert_service_and_endpoints():
    alert_svc = get_alert_service()
    initial_alerts = alert_svc.get_alerts()
    assert len(initial_alerts) >= 2

    # Simulate custom alert via API
    sim_payload = {
        "battery_id": "EV-TEST-ALT",
        "severity": "CRITICAL",
        "title": "Thermal Excursion",
        "message": "Pack temp exceeded 58C.",
        "metrics_summary": {"battery_temperature": 58.2, "soc": 89.0},
    }
    resp = client.post("/api/battery/alerts/simulate", json=sim_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "dispatched"
    alert_id = data["alert"]["id"]

    # Acknowledge alert
    ack_resp = client.post("/api/battery/alerts/acknowledge", json={"alert_id": alert_id})
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "acknowledged"


def test_api_analyze_endpoint():
    payload = {
        "battery_id": "EV-ANALYZE-01",
        "soc": 65.0,
        "voltage": 398.0,
        "charging_current": 30.0,
        "battery_temperature": 34.0,
        "ambient_temperature": 25.0,
        "battery_age": 10.0,
        "charging_cycles": 250,
    }
    resp = client.post("/api/battery/analyze", json=payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["battery_id"] == "EV-ANALYZE-01"
    assert "prediction" in res_data
    assert "predicted_temperature" in res_data["prediction"]
    assert "risk_assessment" in res_data
    assert res_data["risk_assessment"]["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
