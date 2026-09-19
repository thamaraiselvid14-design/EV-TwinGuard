import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.realtime_service import get_realtime_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_realtime_state():
    svc = get_realtime_service()
    svc.reset_stream()
    yield
    svc.reset_stream()


# ==============================================================================
# 13 REQUIRED TESTS SPECIFIED IN SECTION 18
# ==============================================================================

def test_01_get_next_realtime_record_analysis_automatically_occurs():
    """
    Test 1: GET/NEXT realtime record -> analysis automatically occurs.
    The user does not need to invoke a separate analyze step.
    """
    res = client.get("/api/realtime/next")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "success"
    # Verification that prediction ran automatically
    assert "prediction" in data
    assert "predicted_future_temperature" in data["prediction"]
    assert data["prediction"]["predicted_future_temperature"] > 0
    # Verification that risk assessment ran automatically
    assert "risk_assessment" in data
    assert "risk_score" in data["risk_assessment"]
    assert data["risk_assessment"]["risk_level"] in ["LOW", "MEDIUM", "HIGH"]


def test_02_response_contains_telemetry_prediction_risk_and_alert_status():
    """
    Test 2: Verify response contains raw telemetry, prediction, risk score,
    risk level, and alert status.
    """
    res = client.get("/api/realtime/next")
    assert res.status_code == 200
    data = res.json()

    # Raw telemetry
    assert "telemetry" in data
    tel = data["telemetry"]
    for field in [
        "battery_id", "soc", "voltage", "charging_current",
        "current_temperature", "ambient_temperature", "battery_age", "charging_cycles"
    ]:
        assert field in tel, f"Missing {field} in raw telemetry"

    # AI Prediction
    assert "prediction" in data
    pred = data["prediction"]
    assert "predicted_future_temperature" in pred
    assert "temperature_delta" in pred
    assert "confidence_score" in pred

    # Risk Assessment
    assert "risk_assessment" in data
    risk = data["risk_assessment"]
    assert "risk_score" in risk
    assert "risk_level" in risk

    # Alert Status
    assert "alert_status" in data
    alert = data["alert_status"]
    assert "email_sent" in alert
    assert "call_triggered" in alert
    assert "charging_status" in alert


def test_03_verify_low_dataset_record():
    """
    Test 3: Verify LOW dataset record.
    Record 1 (EV-FLEET-001) or Record 2 (EV-FLEET-002) is a nominal battery pack.
    """
    svc = get_realtime_service()
    svc.reset_stream()

    res = client.get("/api/realtime/next")
    assert res.status_code == 200
    data = res.json()

    risk = data["risk_assessment"]
    assert risk["risk_level"] == "LOW"
    assert risk["risk_score"] < 50.0

    alert = data["alert_status"]
    assert alert["email_sent"] is False
    assert alert["call_triggered"] is False
    assert alert["charging_status"] == "CONNECTED"


def test_04_verify_medium_dataset_record():
    """
    Test 4: Verify MEDIUM dataset record.
    Step through dataset to find the MEDIUM risk record (e.g., EV-FLEET-004).
    """
    svc = get_realtime_service()
    svc.reset_stream()

    found_medium = None
    total = svc.total_records
    for _ in range(total):
        res = client.get("/api/realtime/next")
        data = res.json()
        if data["risk_assessment"]["risk_level"] == "MEDIUM":
            found_medium = data
            break

    assert found_medium is not None, "Expected at least one MEDIUM risk record in dataset"
    assert found_medium["risk_assessment"]["risk_level"] == "MEDIUM"
    assert 50.0 <= found_medium["risk_assessment"]["risk_score"] < 75.0
    # Medium risk dispatches email alert
    assert found_medium["alert_status"]["email_sent"] is True
    # Emergency phone call only triggers for HIGH
    assert found_medium["alert_status"]["call_triggered"] is False
    # Contactor remains connected for MEDIUM
    assert found_medium["alert_status"]["charging_status"] == "CONNECTED"


def test_05_verify_high_dataset_record():
    """
    Test 5: Verify HIGH dataset record.
    Step through dataset to find the HIGH risk record (e.g., EV-FLEET-005 or EV-FLEET-010).
    """
    svc = get_realtime_service()
    svc.reset_stream()

    found_high = None
    total = svc.total_records
    for _ in range(total):
        res = client.get("/api/realtime/next")
        data = res.json()
        if data["risk_assessment"]["risk_level"] == "HIGH":
            found_high = data
            break

    assert found_high is not None, "Expected at least one HIGH risk record in dataset"
    assert found_high["risk_assessment"]["risk_level"] == "HIGH"
    assert found_high["risk_assessment"]["risk_score"] >= 75.0
    # High risk dispatches email and emergency call
    assert found_high["alert_status"]["email_sent"] is True
    assert found_high["alert_status"]["call_triggered"] is True
    # Contactor trips to SIMULATED DISCONNECT
    assert "DISCONNECT" in found_high["alert_status"]["charging_status"].upper()


def test_06_verify_invalid_dataset_record_is_skipped():
    """
    Test 6: Verify invalid dataset record is skipped without crashing the stream.
    """
    svc = get_realtime_service()
    svc.reset_stream()
    records = svc._ensure_records_loaded()

    # Prepend an invalid record
    corrupt_record = {"battery_id": "", "soc": "NOT_A_NUMBER", "voltage": -999.0}
    records.insert(0, corrupt_record)
    svc._cached_records = records

    try:
        res = client.get("/api/realtime/next")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        # Verify that an invalid record was skipped and a valid one was analyzed
        assert data["telemetry"]["battery_id"] != ""
        assert data["telemetry"]["soc"] >= 0.0
    finally:
        # Restore nominal dataset
        svc._cached_records = None
        svc._ensure_records_loaded()


def test_07_verify_prediction_failure_does_not_stop_stream(monkeypatch):
    """
    Test 7: Verify prediction failure does not stop stream (fallback heuristic activates).
    """
    svc = get_realtime_service()
    svc.reset_stream()

    def mock_broken_predict(*args, **kwargs):
        raise RuntimeError("Simulated ML Model Inference Failure")

    monkeypatch.setattr(svc.prediction_service, "predict", mock_broken_predict)

    res = client.get("/api/realtime/next")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    # Fallback heuristic successfully provided prediction
    assert data["prediction"]["predicted_future_temperature"] > 0
    assert "risk_assessment" in data


def test_08_verify_email_twilio_failure_does_not_stop_stream(monkeypatch):
    """
    Test 8: Verify email/Twilio failure does not stop stream.
    """
    svc = get_realtime_service()
    svc.reset_stream()

    def mock_broken_alert_dispatch(*args, **kwargs):
        raise ConnectionError("Simulated External SMTP/Twilio Network Outage")

    monkeypatch.setattr(svc.alert_service, "process_telemetry_risk", mock_broken_alert_dispatch)

    res = client.get("/api/realtime/next")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["telemetry"]["battery_id"] is not None


def test_09_verify_next_record_advances_exactly_once():
    """
    Test 9: Verify Next Record advances exactly once.
    """
    svc = get_realtime_service()
    svc.reset_stream()

    # Initial call
    res1 = client.get("/api/realtime/next")
    assert res1.status_code == 200
    idx1 = res1.json()["index"]

    # Second call
    res2 = client.get("/api/realtime/next")
    assert res2.status_code == 200
    idx2 = res2.json()["index"]

    assert idx2 == idx1 + 1


def test_10_verify_start_stream_processes_multiple_records():
    """
    Test 10: Verify Start Stream processes multiple records sequentially.
    """
    start_res = client.post("/api/realtime/start", json={"interval_seconds": 3})
    assert start_res.status_code == 200
    assert start_res.json()["running"] is True

    indices = []
    for _ in range(4):
        res = client.get("/api/realtime/next")
        assert res.status_code == 200
        indices.append(res.json()["index"])

    assert indices == [1, 2, 3, 4]


def test_11_verify_pause_stream_stops_processing():
    """
    Test 11: Verify Pause Stream stops processing.
    """
    # Start
    client.post("/api/realtime/start", json={"interval_seconds": 2})
    status1 = client.get("/api/realtime/status").json()
    assert status1["running"] is True

    # Pause
    pause_res = client.post("/api/realtime/pause")
    assert pause_res.status_code == 200
    assert pause_res.json()["running"] is False

    status2 = client.get("/api/realtime/status").json()
    assert status2["running"] is False


def test_12_verify_restart_dataset_resets_index():
    """
    Test 12: Verify Restart Dataset works by resetting index back to record 1.
    """
    svc = get_realtime_service()
    svc.reset_stream()

    # Advance 5 records
    for _ in range(5):
        client.get("/api/realtime/next")

    # Reset
    reset_res = client.post("/api/realtime/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["current_index"] <= 1

    # Next record after reset should be record 1
    next_res = client.get("/api/realtime/next")
    assert next_res.json()["index"] == 1
    assert next_res.json()["telemetry"]["battery_id"] == "EV-FLEET-001"


def test_13_verify_manual_input_still_works():
    """
    Test 13: Verify Manual Input mode still works completely without interference.
    """
    manual_payload = {
        "battery_id": "EV-MANUAL-VERIFY-001",
        "soc": 78.5,
        "voltage": 402.0,
        "charging_current": 20.0,
        "current_temperature": 34.0,
        "ambient_temperature": 26.0,
        "battery_age": 10.0,
        "charging_cycles": 250,
    }

    res = client.post("/api/battery/analyze", json=manual_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["battery_id"] == "EV-MANUAL-VERIFY-001"
    assert "prediction" in data
    assert "predicted_future_temperature" in data["prediction"]
    assert "risk_assessment" in data
    assert "risk_score" in data["risk_assessment"]
    assert "risk_level" in data["risk_assessment"]
    assert data["risk_assessment"]["risk_level"] == "LOW"
    assert "recommendations" in data["risk_assessment"]
    assert len(data["risk_assessment"]["recommendations"]) > 0


# ==============================================================================
# EXISTING ADDITIONAL INTEGRATION & EDGE TESTS
# ==============================================================================

def test_realtime_continuous_cycling():
    svc = get_realtime_service()
    total = svc.total_records
    assert total > 0

    seen_indices = []
    for _ in range(total + 3):
        res = client.get("/api/realtime/next")
        assert res.status_code == 200
        seen_indices.append(res.json()["index"])

    assert len(seen_indices) == total + 3
    assert 1 in seen_indices


def test_realtime_alerts_persisted_to_sqlite():
    for _ in range(10):
        client.get("/api/realtime/next")

    hist_res = client.get("/api/battery/alerts/history?limit=50")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert isinstance(history, list)
    assert len(history) > 0


def test_what_if_simulator_with_realtime_telemetry():
    next_res = client.get("/api/realtime/next")
    telemetry = next_res.json()["telemetry"]

    sim_req = {
        "battery_id": telemetry["battery_id"],
        "soc": telemetry["soc"],
        "voltage": telemetry["voltage"],
        "charging_current": telemetry["charging_current"],
        "current_temperature": telemetry.get("current_temperature") or telemetry.get("battery_temperature", 30.0),
        "ambient_temperature": telemetry["ambient_temperature"],
        "battery_age": telemetry["battery_age"],
        "charging_cycles": telemetry["charging_cycles"],
    }
    sim_res = client.post("/api/battery/simulate-charging", json=sim_req)
    assert sim_res.status_code == 200
    scenarios = sim_res.json()["scenarios"]
    assert len(scenarios) == 3
    currents = [s["charging_current"] for s in scenarios]
    assert currents == [12.0, 18.0, 25.0]
