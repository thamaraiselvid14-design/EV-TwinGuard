import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.alert_service import get_alert_service
from app.data.dataset_service import get_dataset_service

client = TestClient(app)


def test_e2e_low_risk_manual_input_flow():
    """
    Scenario 1: LOW Risk Battery Flow
    Nominal operating conditions -> AI Prediction -> Risk 0-39 (LOW)
    -> No email, no emergency call, charging remains CONNECTED.
    """
    low_payload = {
        "battery_id": "TEST-LOW-E2E",
        "soc": 45.0,
        "voltage": 395.0,
        "charging_current": 12.0,
        "current_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": 6.0,
        "charging_cycles": 120,
    }

    # Step 1: Physical Validation
    val_resp = client.post("/api/battery/manual-input", json=low_payload)
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["status"] == "validated"

    # Step 2: AI Temperature Prediction
    pred_resp = client.post("/predict", json=low_payload)
    assert pred_resp.status_code == 200
    pred_data = pred_resp.json()
    assert "predicted_future_temperature" in pred_data
    assert pred_data["predicted_future_temperature"] < 40.0

    # Step 3: Multi-Factor Risk Assessment
    risk_req = {
        **low_payload,
        "predicted_future_temperature": pred_data["predicted_future_temperature"],
    }
    risk_resp = client.post("/risk-assessment", json=risk_req)
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()

    assert risk_data["risk_level"] == "LOW"
    assert 0.0 <= risk_data["risk_score"] <= 39.0
    assert risk_data["charging_status"] == "CONNECTED"
    assert risk_data["alert_triggered"] is False
    assert risk_data["alert_event"] is None


def test_e2e_medium_risk_manual_input_flow():
    """
    Scenario 2: MEDIUM Risk Battery Flow
    Elevated current & temp -> AI Prediction -> Risk 40-69 (MEDIUM)
    -> Email alert dispatched/logged, no emergency call, charging remains CONNECTED.
    """
    med_payload = {
        "battery_id": "TEST-MED-E2E",
        "soc": 78.0,
        "voltage": 405.0,
        "charging_current": 45.0,
        "current_temperature": 38.0,
        "ambient_temperature": 28.0,
        "battery_age": 16.0,
        "charging_cycles": 480,
    }

    # Step 1: AI Prediction
    pred_resp = client.post("/predict", json=med_payload)
    assert pred_resp.status_code == 200
    pred_data = pred_resp.json()

    # Step 2: Risk Assessment & Alert Dispatch
    risk_req = {
        **med_payload,
        "predicted_future_temperature": pred_data["predicted_future_temperature"],
    }
    risk_resp = client.post("/risk-assessment", json=risk_req)
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()

    assert risk_data["risk_level"] == "MEDIUM"
    assert 40.0 <= risk_data["risk_score"] <= 69.9
    assert risk_data["charging_status"] == "CONNECTED"
    assert risk_data["alert_triggered"] is True
    assert risk_data["alert_event"] is not None

    event = risk_data["alert_event"]
    assert event["email_dispatched"] is True
    assert event["call_triggered"] is False
    assert "TEST-MED-E2E" in event["full_report"]


def test_e2e_high_risk_and_simulated_disconnect_flow():
    """
    Scenario 3: HIGH Risk Battery Flow
    Thermal runaway / heavy stress -> AI Prediction -> Risk 70-100 (HIGH)
    -> Email alert + Phone call triggered + SIMULATED DISCONNECT executed + Logged.
    """
    high_payload = {
        "battery_id": "TEST-HIGH-E2E",
        "soc": 93.0,
        "voltage": 418.0,
        "charging_current": 75.0,
        "current_temperature": 52.0,
        "ambient_temperature": 36.0,
        "battery_age": 36.0,
        "charging_cycles": 1250,
    }

    # Step 1: AI Prediction
    pred_resp = client.post("/predict", json=high_payload)
    assert pred_resp.status_code == 200
    pred_data = pred_resp.json()
    assert pred_data["predicted_future_temperature"] >= 50.0

    # Step 2: Risk Assessment & Emergency Safety Dispatch
    risk_req = {
        **high_payload,
        "predicted_future_temperature": pred_data["predicted_future_temperature"],
    }
    risk_resp = client.post("/risk-assessment", json=risk_req)
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()

    assert risk_data["risk_level"] == "HIGH"
    assert risk_data["risk_score"] >= 70.0
    assert risk_data["charging_status"] == "SIMULATED DISCONNECT"
    assert risk_data["alert_triggered"] is True
    assert risk_data["alert_event"] is not None

    event = risk_data["alert_event"]
    assert event["email_dispatched"] is True
    assert event["call_triggered"] is True
    assert event["call_sid"] is not None
    assert event["charging_status"] == "SIMULATED DISCONNECT"

    # Step 3: Verify SQLite alert history persistence
    hist_resp = client.get("/alerts/history?limit=10")
    assert hist_resp.status_code == 200
    hist = hist_resp.json()
    assert any(h["battery_id"] == "TEST-HIGH-E2E" and h["charging_status"] == "SIMULATED DISCONNECT" for h in hist)


def test_e2e_dataset_sourced_battery_flow():
    """
    Scenario 4: Dataset-Sourced Battery Flow
    Samples record from CSV dataset, validates, runs prediction, evaluates risk, logs alerts.
    """
    sample_resp = client.get("/api/battery/dataset/sample?n=5")
    assert sample_resp.status_code == 200
    sample_data = sample_resp.json()
    assert "data" in sample_data
    assert len(sample_data["data"]) > 0

    record = sample_data["data"][0]
    payload = {
        "battery_id": str(record.get("battery_id", "DATASET-UNIT-01")),
        "soc": float(record.get("soc", 70.0)),
        "voltage": float(record.get("voltage", 400.0)),
        "charging_current": float(record.get("charging_current", 20.0)),
        "current_temperature": float(record.get("battery_temperature", 30.0)),
        "ambient_temperature": float(record.get("ambient_temperature", 25.0)),
        "battery_age": float(record.get("battery_age", 12.0)),
        "charging_cycles": int(record.get("charging_cycles", 300)),
    }

    # Pass through prediction
    pred_res = client.post("/predict", json=payload)
    assert pred_res.status_code == 200
    pred = pred_res.json()

    # Pass through risk assessment
    risk_res = client.post("/risk-assessment", json={**payload, "predicted_future_temperature": pred["predicted_future_temperature"]})
    assert risk_res.status_code == 200
    risk = risk_res.json()
    assert risk["risk_level"] in ["LOW", "MEDIUM", "HIGH"]


def test_e2e_what_if_charging_simulator():
    """
    Scenario 5: What-If Charging Simulator Flow
    Evaluates 12A, 18A, and 25A charging scenarios and verifies monotonic physical scaling.
    """
    sim_req = {
        "battery_id": "SIM-TEST-01",
        "soc": 75.0,
        "voltage": 402.0,
        "charging_current": 18.0,
        "current_temperature": 34.0,
        "ambient_temperature": 26.0,
        "battery_age": 12.0,
        "charging_cycles": 320,
    }

    resp = client.post("/simulate-charging", json=sim_req)
    assert resp.status_code == 200
    data = resp.json()

    assert data["battery_id"] == "SIM-TEST-01"
    scenarios = data["scenarios"]
    assert len(scenarios) == 3

    currents = [s["charging_current"] for s in scenarios]
    assert currents == [12.0, 18.0, 25.0]

    temps = [s["predicted_future_temperature"] for s in scenarios]
    # Temperature should strictly increase or stay equal with higher current
    assert temps[0] <= temps[1] <= temps[2]


def test_error_handling_and_validation_resilience():
    """
    Scenario 6: Validation, Bad Inputs, and Error Handling
    """
    # 1. Negative SOC
    res1 = client.post("/predict", json={"soc": -5.0, "voltage": 400, "charging_current": 18, "battery_age": 10, "charging_cycles": 100, "ambient_temperature": 25, "current_temperature": 25})
    assert res1.status_code == 422

    # 2. SOC > 100%
    res2 = client.post("/predict", json={"soc": 110.0, "voltage": 400, "charging_current": 18, "battery_age": 10, "charging_cycles": 100, "ambient_temperature": 25, "current_temperature": 25})
    assert res2.status_code == 422

    # 3. Negative voltage
    res3 = client.post("/predict", json={"soc": 50.0, "voltage": -400, "charging_current": 18, "battery_age": 10, "charging_cycles": 100, "ambient_temperature": 25, "current_temperature": 25})
    assert res3.status_code == 422

    # 4. Missing required fields in manual input
    res4 = client.post("/api/battery/manual-input", json={"soc": 50.0})
    assert res4.status_code == 422
