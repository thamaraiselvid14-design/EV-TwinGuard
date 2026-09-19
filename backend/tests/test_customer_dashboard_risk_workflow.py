import os
import sys
import time
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.services.alert_service import get_alert_service
from app.services.auth_service import get_auth_service, create_jwt_token

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    auth_service = get_auth_service()
    email = "test_customer_workflow@evtwinguard.io"
    customer = auth_service.get_user_by_email(email)
    if not customer:
        customer = auth_service.create_customer(
            full_name="Test Customer Flow",
            email=email,
            password="Password123!",
            mobile_number="+15551234567",
            vehicle_model="Model 3",
            battery_id="EV-TEST-FLOW-01"
        )
    token = create_jwt_token({"sub": str(customer["id"]), "role": "CUSTOMER", "email": customer["email"]})
    return {"Authorization": f"Bearer {token}"}


def test_scenario_1_low_risk(auth_headers):
    """
    Scenario 1: LOW RISK
    - Reason explaining why battery is normal (nominal factors).
    - No email sent.
    - No call.
    - No countdown / pending alert requiring acknowledge.
    """
    payload = {
        "battery_id": "EV-TEST-LOW",
        "battery_temperature": 27.0,
        "current": 10.0,
        "voltage": 395.0,
        "soc": 45.0,
        "battery_age": 6.0,
        "charging_cycles": 120,
        "ambient_temperature": 24.0,
    }
    resp = client.post("/api/customer/battery/analyze", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["risk_level"] == "LOW"
    assert data["risk_value"] < 40.0
    assert isinstance(data["main_risk_factors"], list)
    assert len(data["main_risk_factors"]) > 0
    # Dynamic reason explains nominal parameters
    assert any("nominal" in f.lower() or "within" in f.lower() for f in data["main_risk_factors"])
    # No alert record, no email sent, no call, no countdown
    assert data.get("alert") is None


def test_scenario_2_medium_risk(auth_headers):
    """
    Scenario 2: MEDIUM RISK
    - Reason explaining why battery is medium risk.
    - Email sent automatically.
    - No call.
    - No 60-second countdown (alert already in SENT status).
    """
    payload = {
        "battery_id": "EV-TEST-MED",
        "battery_temperature": 39.5,
        "current": 28.0,
        "voltage": 410.0,
        "soc": 88.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
        "ambient_temperature": 30.0,
    }
    resp = client.post("/api/customer/battery/analyze", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["risk_level"] == "MEDIUM"
    assert 40.0 <= data["risk_value"] <= 69.0
    assert isinstance(data["main_risk_factors"], list)
    assert len(data["main_risk_factors"]) > 0
    # Dynamic reasons include elevated factors
    assert any("SOC" in f or "temperature" in f.lower() or "current" in f.lower() for f in data["main_risk_factors"])
    
    alert = data.get("alert")
    assert alert is not None
    assert alert.get("email_sent") is True
    assert alert.get("status") == "SENT"
    assert alert.get("call_sent") is False or alert.get("call_sent") is None


def test_scenario_3_high_risk_acknowledged(auth_headers):
    """
    Scenario 3: HIGH RISK + BUTTON CLICKED (Acknowledge/Stop)
    - Reason explaining why battery is critical/high risk.
    - Starts with PENDING status (60s window).
    - User acknowledges -> countdown stops, call cancelled, HIGH-risk email sent.
    """
    payload = {
        "battery_id": "EV-TEST-HIGH-ACK",
        "battery_temperature": 53.0,
        "current": 55.0,
        "voltage": 425.0,
        "soc": 94.0,
        "battery_age": 42.0,
        "charging_cycles": 900,
        "ambient_temperature": 35.0,
    }
    resp = client.post("/api/customer/battery/analyze", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["risk_level"] == "HIGH"
    assert data["risk_value"] >= 70.0
    assert any("thermal" in f.lower() or "temperature" in f.lower() or "SOC" in f for f in data["main_risk_factors"])

    alert = data.get("alert")
    assert alert is not None
    assert alert.get("status") == "PENDING"
    assert alert.get("acknowledgement_deadline") is not None
    alert_id = alert["id"]

    # User clicks Acknowledge/Stop before 60 seconds
    ack_resp = client.post(f"/api/customer/alerts/{alert_id}/acknowledge", headers=auth_headers)
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()
    assert ack_data["success"] is True
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["call_triggered"] is False
    assert ack_data["email_sent"] is True


def test_scenario_4_high_risk_escalated_on_timeout(auth_headers):
    """
    Scenario 4: HIGH RISK + NO BUTTON CLICK (Countdown reaches 0)
    - Unacknowledged alert past deadline escalates automatically.
    - Escalation triggers call + sends HIGH risk email.
    """
    alert_service = get_alert_service()
    auth_service = get_auth_service()
    customer = auth_service.get_user_by_email("test_customer_workflow@evtwinguard.io")

    # Create a high risk alert with an expired deadline (simulate 60s elapsed)
    analysis_id = alert_service.save_battery_analysis(
        user_id=customer["id"],
        temperature=55.0,
        current=60.0,
        voltage=430.0,
        soc=95.0,
        battery_age=48.0,
        cycles=950,
        predicted_temperature=58.0,
        risk_value=92.0,
        risk_level="HIGH",
    )
    alert_info = alert_service.create_customer_alert(
        analysis_id=analysis_id,
        user_id=customer["id"],
        battery_id="EV-TEST-HIGH-TIMEOUT",
        risk_score=92.0,
        risk_level="HIGH",
        predicted_temperature=58.0,
        current_temperature=55.0,
        soc=95.0,
        charging_current=60.0,
        voltage=430.0,
        battery_age=48.0,
        charging_cycles=950,
        main_risk_factors=["Critical thermal runaway risk (>50°C)", "High State of Charge (SOC > 80%)"],
        recommendations=["Simulate disconnect immediately"],
    )
    alert_id = alert_info["id"]

    # Force deadline to past to simulate countdown reaching 0
    past_time = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
    with alert_service._get_connection() as conn:
        conn.execute("UPDATE alert_events SET acknowledgement_deadline = ? WHERE id = ?", (past_time, alert_id))
        conn.commit()

    # Run check_and_escalate_pending_alerts
    escalated_count = alert_service.check_and_escalate_pending_alerts()
    assert escalated_count >= 1

    # Verify alert is now ESCALATED with call and email triggered
    with alert_service._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status, call_triggered, email_sent FROM alert_events WHERE id = ?", (alert_id,))
        row = cursor.fetchone()
        assert row is not None
        status = row["status"]
        call_triggered = row["call_triggered"]
        email_sent = row["email_sent"]
        assert status == "ESCALATED"
        assert call_triggered == 1
        assert email_sent == 1
