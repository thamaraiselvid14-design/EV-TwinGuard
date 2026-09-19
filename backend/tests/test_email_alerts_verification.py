import json
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.alert_service import get_alert_service
from app.services.auth_service import get_auth_service

client = TestClient(app)

RECIPIENT_EMAIL = "thamaraiselvid14@gmail.com"


@pytest.fixture(autouse=True)
def ensure_env_recipient(monkeypatch):
    monkeypatch.setenv("ALERT_RECIPIENT_EMAIL", RECIPIENT_EMAIL)


def test_customer_medium_risk_email_alert_flow():
    """
    MEDIUM RISK TEST:
    1. Authenticate / Login to Customer Dashboard
    2. Enter / analyze battery values that produce MEDIUM risk
    3. Verify that MEDIUM risk is detected
    4. Verify that email is automatically triggered WITHOUT clicking Acknowledge
    5. Verify email recipient is thamaraiselvid14@gmail.com
    6. Verify email contains:
       - Risk Level (MEDIUM)
       - Risk Value
       - Predicted Temperature
       - Battery values (SOC, Current, Voltage, Temp, Age, Cycles)
       - 'WHY IS IT MEDIUM?'
       - Dynamic reason explaining why the battery is MEDIUM
    """
    # 1. Login as customer (or create one)
    auth_svc = get_auth_service()
    customer = auth_svc.get_user_by_email("revanyadevaraj@gmail.com")
    if not customer:
        customer = auth_svc.create_customer(
            full_name="Revanya Devaraj",
            email="revanyadevaraj@gmail.com",
            mobile_number="+91-9876543210",
            password="password123",
            vehicle_model="Tata Nexon EV",
            battery_id="EV-TEST-MED-PACK",
        )
    
    login_resp = client.post("/api/auth/customer/login", json={
        "email": "revanyadevaraj@gmail.com",
        "password": "password123" if not customer or customer["name"] == "Revanya Devaraj" else "revanya",
    })
    if login_resp.status_code != 200:
        login_resp = client.post("/api/auth/customer/login", json={
            "email": "revanyadevaraj@gmail.com",
            "password": "revanya",
        })
    assert login_resp.status_code == 200, f"Customer login failed: {login_resp.json()}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Enter battery values producing MEDIUM risk
    med_telemetry = {
        "battery_id": "EV-TEST-MED-PACK",
        "battery_temperature": 40.0,
        "current": 35.0,
        "voltage": 405.0,
        "soc": 82.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
        "ambient_temperature": 28.0,
    }

    # 3. Run battery analysis
    analyze_resp = client.post("/api/customer/battery/analyze", json=med_telemetry, headers=headers)
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()

    # 4. Verify MEDIUM risk is detected
    assert data["risk_level"] == "MEDIUM", f"Expected MEDIUM, got {data['risk_level']}"
    assert 40.0 <= data["risk_value"] <= 69.0, f"Expected risk score between 40-69, got {data['risk_value']}"

    # 5. Verify alert and email are automatically triggered WITHOUT clicking acknowledge
    alert = data.get("alert")
    assert alert is not None, "Expected alert object in analysis response"
    assert alert["risk_level"] == "MEDIUM"
    assert alert["email_sent"] is True, "MEDIUM risk email must be sent immediately without acknowledgement"
    assert alert["acknowledged"] is False, "Alert must be unacknowledged at creation time"
    assert alert["call_triggered"] is False, "No phone call should be triggered for MEDIUM risk"

    # 6. Verify stored alert event details & email report content
    alert_svc = get_alert_service()
    with alert_svc._get_connection() as conn:
        row = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert["id"],)).fetchone()
        assert row is not None, "Alert event not found in database"
        alert_event = dict(row)

    full_report = alert_event["full_report"]
    print("\n--- GENERATED MEDIUM RISK EMAIL REPORT ---\n", full_report)

    # 7. Verify email recipient
    assert alert_event["email_sent"] == 1

    # 8. Verify email content elements
    assert "Safety Risk Level:      MEDIUM" in full_report, "Risk level missing in report"
    assert f"Risk Value / Score:     {data['risk_value']:.1f} / 100" in full_report, "Risk value missing in report"
    assert "Predicted Future Temp:" in full_report, "Predicted temperature missing in report"
    assert f"{data['predicted_temperature']:.1f} °C" in full_report, "Predicted temperature value missing"
    assert "State of Charge (SOC):      82.0 %" in full_report, "SOC missing in report"
    assert "Operating Voltage:          405.0 V" in full_report, "Voltage missing in report"
    assert "Charging Current:           35.0 A" in full_report, "Current missing in report"
    assert "Current Measured Temp:      40.0 °C" in full_report, "Measured Temp missing in report"
    assert "Battery Age:                18.0 Months" in full_report, "Battery age missing in report"
    assert "Cumulative Charge Cycles:   450" in full_report, "Charging cycles missing in report"
    assert "--- 3. WHY IS IT MEDIUM? ---" in full_report, "'WHY IS IT MEDIUM?' section heading missing"
    assert "Dynamic Risk Assessment Reason:" in full_report, "Dynamic reason section missing"
    
    # Verify dynamic reasons are present (e.g. High State of Charge, Elevated future temp)
    factors = json.loads(alert_event["main_risk_factors"])
    assert len(factors) > 0, "Expected at least one dynamic risk factor"
    for factor in factors:
        assert factor in full_report, f"Dynamic factor '{factor}' missing in email report"


def test_customer_low_risk_no_email_sent():
    """
    LOW RISK TEST:
    1. Authenticate Customer
    2. Enter battery values producing LOW risk
    3. Run battery analysis
    4. Verify LOW risk is displayed
    5. Verify NO email is sent
    """
    auth_svc = get_auth_service()
    customer = auth_svc.get_user_by_email("revanyadevaraj@gmail.com")
    login_resp = client.post("/api/auth/customer/login", json={
        "email": "revanyadevaraj@gmail.com",
        "password": "password123" if not customer or customer["name"] == "Revanya Devaraj" else "revanya",
    })
    if login_resp.status_code != 200:
        login_resp = client.post("/api/auth/customer/login", json={
            "email": "revanyadevaraj@gmail.com",
            "password": "revanya",
        })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    low_telemetry = {
        "battery_id": "EV-TEST-LOW-PACK",
        "battery_temperature": 28.0,
        "current": 10.0,
        "voltage": 390.0,
        "soc": 45.0,
        "battery_age": 6.0,
        "charging_cycles": 100,
        "ambient_temperature": 25.0,
    }

    analyze_resp = client.post("/api/customer/battery/analyze", json=low_telemetry, headers=headers)
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()

    assert data["risk_level"] == "LOW", f"Expected LOW, got {data['risk_level']}"
    assert data["risk_value"] < 40.0, f"Expected risk score < 40, got {data['risk_value']}"
    assert data["alert"] is None, "Expected alert to be None for LOW risk"


def test_customer_high_risk_email_alert_flow():
    """
    HIGH RISK TEST:
    1. Authenticate Customer
    2. Enter battery values producing HIGH risk
    3. Run battery analysis
    4. Verify HIGH risk is detected
    5. Verify existing HIGH-risk email behavior works (acknowledgement triggers email report to recipient)
    6. Verify email recipient is thamaraiselvid14@gmail.com
    7. Verify email contains dynamic reason explaining why it is HIGH ("WHY IS IT HIGH?")
    """
    auth_svc = get_auth_service()
    customer = auth_svc.get_user_by_email("revanyadevaraj@gmail.com")
    login_resp = client.post("/api/auth/customer/login", json={
        "email": "revanyadevaraj@gmail.com",
        "password": "password123" if not customer or customer["name"] == "Revanya Devaraj" else "revanya",
    })
    if login_resp.status_code != 200:
        login_resp = client.post("/api/auth/customer/login", json={
            "email": "revanyadevaraj@gmail.com",
            "password": "revanya",
        })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    high_telemetry = {
        "battery_id": "EV-TEST-HIGH-PACK",
        "battery_temperature": 52.0,
        "current": 75.0,
        "voltage": 420.0,
        "soc": 95.0,
        "battery_age": 38.0,
        "charging_cycles": 900,
        "ambient_temperature": 35.0,
    }

    analyze_resp = client.post("/api/customer/battery/analyze", json=high_telemetry, headers=headers)
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()

    assert data["risk_level"] == "HIGH", f"Expected HIGH, got {data['risk_level']}"
    assert data["risk_value"] >= 70.0, f"Expected risk score >= 70, got {data['risk_value']}"
    
    alert = data.get("alert")
    assert alert is not None
    assert alert["risk_level"] == "HIGH"
    assert alert["status"] == "PENDING"
    assert alert["acknowledged"] is False

    # Acknowledge the alert within window
    alert_id = alert["id"]
    ack_resp = client.post(f"/api/customer/alerts/{alert_id}/acknowledge", headers=headers)
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()
    assert ack_data["success"] is True
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["email_sent"] is True

    # Check alert event in DB
    alert_svc = get_alert_service()
    with alert_svc._get_connection() as conn:
        row = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert_id,)).fetchone()
        assert row is not None
        alert_event = dict(row)

    full_report = alert_event["full_report"]
    print("\n--- GENERATED HIGH RISK EMAIL REPORT ---\n", full_report)

    assert "Safety Risk Level:      HIGH" in full_report
    assert f"Risk Value / Score:     {data['risk_value']:.1f} / 100" in full_report
    assert "--- 3. WHY IS IT HIGH? ---" in full_report
    assert "Dynamic Risk Assessment Reason:" in full_report

    factors = json.loads(alert_event["main_risk_factors"])
    assert len(factors) > 0
    for factor in factors:
        assert factor in full_report, f"Dynamic factor '{factor}' missing in email report"
