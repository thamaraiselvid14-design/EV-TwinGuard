import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.alert_service import get_alert_service

client = TestClient(app)


def test_medium_risk_alert_system():
    # Medium risk payload (elevated temp / current)
    payload = {
        "battery_id": "EV-TEST-MED-ALERT",
        "predicted_future_temperature": 45.0,
        "soc": 75.0,
        "voltage": 402.0,
        "charging_current": 42.0,
        "current_temperature": 38.0,
        "ambient_temperature": 28.0,
        "battery_age": 14.0,
        "charging_cycles": 380,
    }

    resp = client.post("/risk-assessment", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["risk_level"] == "MEDIUM"
    assert data["alert_triggered"] is True
    assert data["charging_status"] == "CONNECTED"
    assert data["alert_event"] is not None

    event = data["alert_event"]
    assert event["email_dispatched"] is True
    assert event["call_triggered"] is False
    assert "EV-TEST-MED-ALERT" in event["full_report"]
    assert "Operating Voltage:          402.0 V" in event["full_report"]
    assert "State of Charge (SOC):      75.0 %" in event["full_report"]
    assert "Predicted Future Temp:      45.0 °C" in event["full_report"]


def test_high_risk_alert_system_and_simulated_disconnect():
    # High risk payload (critical thermal runaway condition)
    payload = {
        "battery_id": "EV-TEST-HIGH-ALERT",
        "predicted_future_temperature": 56.0,
        "soc": 92.0,
        "voltage": 418.0,
        "charging_current": 75.0,
        "current_temperature": 52.0,
        "ambient_temperature": 36.0,
        "battery_age": 36.0,
        "charging_cycles": 1200,
    }

    resp = client.post("/risk-assessment", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["risk_level"] == "HIGH"
    assert data["risk_score"] >= 70.0
    assert data["alert_triggered"] is True
    assert data["charging_status"] == "SIMULATED DISCONNECT"
    assert data["alert_event"] is not None

    event = data["alert_event"]
    assert event["email_dispatched"] is True
    assert event["call_triggered"] is True
    assert event["call_sid"] is not None
    assert event["charging_status"] == "SIMULATED DISCONNECT"
    assert "SIMULATED DISCONNECT" in event["full_report"]


def test_low_risk_no_alert_fired():
    payload = {
        "battery_id": "EV-TEST-LOW-ALERT",
        "predicted_future_temperature": 26.0,
        "soc": 45.0,
        "voltage": 392.0,
        "charging_current": 15.0,
        "battery_age": 6.0,
        "charging_cycles": 100,
    }

    resp = client.post("/risk-assessment", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["risk_level"] == "LOW"
    assert data["alert_triggered"] is False
    assert data["charging_status"] == "CONNECTED"
    assert data["alert_event"] is None


def test_alert_history_persisted_in_database():
    alert_svc = get_alert_service()
    alerts = alert_svc.get_alerts(limit=10)
    assert len(alerts) > 0
    # Check that database persists fields
    assert any(a.battery_id == "EV-TEST-HIGH-ALERT" for a in alerts)
    assert any(a.charging_status == "SIMULATED DISCONNECT" for a in alerts)


def test_alert_history_api_endpoints():
    resp1 = client.get("/alerts/history?limit=10")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert isinstance(data1, list)
    assert len(data1) > 0
    item1 = data1[0]
    assert "battery_id" in item1
    assert "predicted_temperature" in item1
    assert "risk_score" in item1
    assert "risk_level" in item1
    assert "alert_type" in item1
    assert "charging_status" in item1

    resp2 = client.get("/api/battery/alerts/history?limit=10")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert isinstance(data2, list)
    assert len(data2) > 0


def test_safe_email_config_status():
    resp = client.get("/alerts/email-status")
    assert resp.status_code == 200
    data = resp.json()

    assert "smtp_configured" in data
    assert "recipient_configured" in data
    assert data["smtp_configured"] in ["YES", "NO"]
    assert data["recipient_configured"] in ["YES", "NO"]

    # CRITICAL: Verify NO password or secret keys are exposed
    data_str = str(data).lower()
    assert "password" not in data_str
    assert "smtp_password" not in data_str
    assert "secret" not in data_str

    # Also test via /api/battery/alerts/email-status
    resp2 = client.get("/api/battery/alerts/email-status")
    assert resp2.status_code == 200
    assert resp2.json() == data


