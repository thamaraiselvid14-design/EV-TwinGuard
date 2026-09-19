import os
import json
import time
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

import sys
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, base_dir)

from app.services.alert_service import get_alert_service
from app.services.auth_service import get_auth_service, create_jwt_token
from app.services.prediction_service import get_prediction_service
from app.services.risk_service import get_risk_service
load_dotenv(os.path.join(base_dir, ".env"), override=True)
load_dotenv(os.path.join(os.path.dirname(base_dir), ".env"), override=True)

alert_service = get_alert_service()
auth_service = get_auth_service()
pred_service = get_prediction_service()
risk_service = get_risk_service()

def run_tests():
    results = {}

    # 1. Check Twilio Config Loaded
    sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    tok = os.getenv("TWILIO_AUTH_TOKEN", "")
    phone = os.getenv("TWILIO_PHONE_NUMBER", "")
    
    twilio_loaded = bool(
        sid and not sid.startswith("your_") and
        tok and not tok.startswith("your_") and
        phone and not phone.startswith("your_")
    )
    results["Twilio configuration loaded"] = "PASS" if twilio_loaded else "FAIL"

    # Get or create customer
    customer_email = os.getenv("ALERT_RECIPIENT_EMAIL", "thamaraiselvid14@gmail.com")
    customer = auth_service.get_user_by_email("test_call_flow@evtwinguard.io")
    if not customer:
        customer = auth_service.create_customer(
            full_name="Emergency Test User",
            email="test_call_flow@evtwinguard.io",
            password="Password123!",
            mobile_number=os.getenv("TWILIO_TO_PHONE", "+1-800-555-0199"),
            vehicle_model="Tesla Model 3 Performance",
            battery_id="EV-CRITICAL-CALL-01"
        )

    # -------------------------------------------------------------
    # CASE A: HIGH risk -> Acknowledge before 60 seconds
    # -------------------------------------------------------------
    print("\n--- Testing Case A: HIGH Risk + Acknowledge (Call Cancelled, Email Sent) ---")
    analysis_id_a = alert_service.save_battery_analysis(
        user_id=customer["id"],
        temperature=54.5,
        current=58.0,
        voltage=425.0,
        soc=95.0,
        battery_age=45.0,
        cycles=920,
        predicted_temperature=57.2,
        risk_value=95.0,
        risk_level="HIGH",
    )
    alert_info_a = alert_service.create_customer_alert(
        analysis_id=analysis_id_a,
        user_id=customer["id"],
        battery_id="EV-PACK-ACK-01",
        risk_score=95.0,
        risk_level="HIGH",
        predicted_temperature=57.2,
        current_temperature=54.5,
        soc=95.0,
        charging_current=58.0,
        voltage=425.0,
        battery_age=45.0,
        charging_cycles=920,
        main_risk_factors=["Critical thermal runaway risk (>50°C)", "High State of Charge (SOC > 80%)"],
        recommendations=["Simulate disconnect immediately"],
    )
    alert_id_a = alert_info_a["id"]

    # Customer acknowledges
    ack_res = alert_service.acknowledge_customer_alert(alert_id=alert_id_a, user_id=customer["id"])
    
    # Check that alert is ACKNOWLEDGED, call_triggered is False, and email_sent is True
    with alert_service._get_connection() as conn:
        row = conn.execute("SELECT status, call_triggered, email_sent FROM alert_events WHERE id = ?", (alert_id_a,)).fetchone()
        case_a_pass = bool(row and row["status"] == "ACKNOWLEDGED" and not row["call_triggered"] and row["email_sent"])
    results["HIGH + acknowledge"] = "PASS" if case_a_pass else "FAIL"

    # -------------------------------------------------------------
    # CASE B: HIGH risk -> No Acknowledge (Wait 60s / Expire -> Auto Call + Email)
    # -------------------------------------------------------------
    print("\n--- Testing Case B: HIGH Risk + No Acknowledge (Auto Call + Email Escalation) ---")
    analysis_id_b = alert_service.save_battery_analysis(
        user_id=customer["id"],
        temperature=56.0,
        current=62.0,
        voltage=430.0,
        soc=96.0,
        battery_age=48.0,
        cycles=960,
        predicted_temperature=59.5,
        risk_value=98.0,
        risk_level="HIGH",
    )
    alert_info_b = alert_service.create_customer_alert(
        analysis_id=analysis_id_b,
        user_id=customer["id"],
        battery_id="EV-PACK-TIMEOUT-01",
        risk_score=98.0,
        risk_level="HIGH",
        predicted_temperature=59.5,
        current_temperature=56.0,
        soc=96.0,
        charging_current=62.0,
        voltage=430.0,
        battery_age=48.0,
        charging_cycles=960,
        main_risk_factors=["Critical thermal runaway risk (>50°C)", "High State of Charge (SOC > 80%)", "High charging current"],
        recommendations=["Emergency cutoff required"],
    )
    alert_id_b = alert_info_b["id"]

    # Fast forward deadline to past to simulate 60s elapsed
    past_time = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
    with alert_service._get_connection() as conn:
        conn.execute("UPDATE alert_events SET acknowledgement_deadline = ? WHERE id = ?", (past_time, alert_id_b))
        conn.commit()

    # Trigger background escalation
    escalated_count = alert_service.check_and_escalate_pending_alerts()
    print(f"Escalated alerts count: {escalated_count}")

    with alert_service._get_connection() as conn:
        row_b = conn.execute("SELECT status, call_triggered, email_sent FROM alert_events WHERE id = ?", (alert_id_b,)).fetchone()
        case_b_pass = bool(row_b and row_b["status"] == "ESCALATED" and row_b["call_triggered"] == 1 and row_b["email_sent"] == 1)
        emergency_call_pass = bool(row_b and row_b["call_triggered"] == 1)
        email_pass = bool(row_b and row_b["email_sent"] == 1)

    results["HIGH + no acknowledge"] = "PASS" if case_b_pass else "FAIL"
    results["Email"] = "PASS" if email_pass else "FAIL"
    results["Emergency call"] = "PASS" if emergency_call_pass else "FAIL"

    return results

if __name__ == "__main__":
    res = run_tests()
    print("\n--- FINAL TEST RESULTS ---")
    for k, v in res.items():
        print(f"- {k}: {v}")
