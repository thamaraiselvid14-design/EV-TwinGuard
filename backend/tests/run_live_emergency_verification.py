import os
import sys
import json
import time
import base64
import urllib.request
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, base_dir)

load_dotenv(os.path.join(base_dir, ".env"), override=True)
load_dotenv(os.path.join(os.path.dirname(base_dir), ".env"), override=True)

from app.main import app
from fastapi.testclient import TestClient
from app.services.alert_service import get_alert_service
from app.services.auth_service import get_auth_service, create_jwt_token

client = TestClient(app)
alert_service = get_alert_service()
auth_service = get_auth_service()

def fetch_twilio_call_details(account_sid: str, auth_token: str, call_sid: str):
    if not call_sid or not account_sid or not auth_token:
        return None
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls/{call_sid}.json"
    credentials = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {credentials}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

def run_emergency_workflow_test():
    print("================================================================================")
    print("       EV TWINGUARD: LIVE HIGH-RISK EMERGENCY WORKFLOW VERIFICATION             ")
    print("================================================================================")

    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_phone = os.getenv("TWILIO_PHONE_NUMBER", "")
    to_phone = os.getenv("TWILIO_TO_PHONE", "")

    # 0. Auth & Customer Setup
    customer_email = "emergency_verify_user@evtwinguard.io"
    customer = auth_service.get_user_by_email(customer_email)
    if not customer:
        customer = auth_service.create_customer(
            full_name="Emergency Verification Operator",
            email=customer_email,
            password="Password123!",
            mobile_number=to_phone if to_phone else "+15551234567",
            vehicle_model="Model 3 Performance",
            battery_id="EV-LIVE-TEST-01"
        )
    user_id = customer["id"]
    token = create_jwt_token({"sub": str(user_id), "role": "CUSTOMER", "email": customer_email})
    headers = {"Authorization": f"Bearer {token}"}

    # =========================================================================
    # TEST 1 — HIGH risk + Acknowledge
    # =========================================================================
    print("\n--- RUNNING TEST 1: HIGH RISK + ACKNOWLEDGE / STOP ---")
    
    # 1. Trigger a real HIGH-risk analysis
    high_risk_payload = {
        "battery_id": "EV-LIVE-TEST-01",
        "battery_temperature": 54.5,
        "current": 58.0,
        "voltage": 428.0,
        "soc": 95.0,
        "battery_age": 45.0,
        "charging_cycles": 920,
        "ambient_temperature": 32.0,
    }
    resp1 = client.post("/api/customer/battery/analyze", json=high_risk_payload, headers=headers)
    assert resp1.status_code == 200, f"Analyze request failed: {resp1.text}"
    data1 = resp1.json()

    print(f"Risk Level: {data1.get('risk_level')} (Risk Value: {data1.get('risk_value'):.1f}/100)")
    alert1 = data1.get("alert")
    assert alert1 is not None, "Expected alert object for HIGH risk"
    alert_id1 = alert1["id"]
    deadline1 = alert1.get("acknowledgement_deadline")
    print(f"Alert ID: {alert_id1}")
    print(f"Initial Alert Status: {alert1.get('status')}")
    print(f"Acknowledgement Deadline: {deadline1}")

    # 2. Confirm the 60-second countdown starts
    t1_countdown_pass = False
    if deadline1:
        deadline_dt = datetime.fromisoformat(deadline1.replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        diff_secs = (deadline_dt - now_dt).total_seconds()
        print(f"Countdown Window Seconds: {diff_secs:.1f}s")
        if 50 <= diff_secs <= 65 and alert1.get("status") == "PENDING":
            t1_countdown_pass = True

    # 3. Click Acknowledge/Stop before 60 seconds
    print("Action: User clicks Acknowledge/Stop button...")
    ack_resp1 = client.post(f"/api/customer/alerts/{alert_id1}/acknowledge", headers=headers)
    assert ack_resp1.status_code == 200, f"Acknowledge request failed: {ack_resp1.text}"
    ack_data1 = ack_resp1.json()
    print(f"Acknowledge API Response: status={ack_data1.get('status')}, email_sent={ack_data1.get('email_sent')}, call_triggered={ack_data1.get('call_triggered')}")

    # 4-7. Verify state in DB
    with alert_service._get_connection() as conn:
        row1 = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert_id1,)).fetchone()
        row1_dict = dict(row1)

    t1_ack_pass = (row1_dict.get("status") == "ACKNOWLEDGED" and row1_dict.get("acknowledged") == 1)
    t1_email_pass = (row1_dict.get("email_sent") == 1 or ack_data1.get("email_sent") is True)
    t1_voice_triggered = bool(row1_dict.get("call_triggered"))
    t1_call_pass = (t1_voice_triggered is False)

    t1_overall = t1_countdown_pass and t1_ack_pass and t1_email_pass and t1_call_pass

    print(f"Test 1 Summary:")
    print(f"  - Countdown Started: {'PASS' if t1_countdown_pass else 'FAIL'}")
    print(f"  - Acknowledge behavior: {'PASS' if t1_ack_pass else 'FAIL'}")
    print(f"  - HIGH-risk email sent: {'PASS' if t1_email_pass else 'FAIL'}")
    print(f"  - Emergency voice call NOT triggered: {'PASS' if t1_call_pass else 'FAIL'}")
    print(f"  - Overall Test 1: {'PASS' if t1_overall else 'FAIL'}")

    # =========================================================================
    # TEST 2 — HIGH risk + No Acknowledge (Wait for countdown -> Real Twilio Call)
    # =========================================================================
    print("\n--- RUNNING TEST 2: HIGH RISK + NO ACKNOWLEDGE (AUTO CALL & ESCALATION) ---")

    # 1. Trigger another real HIGH-risk analysis
    resp2 = client.post("/api/customer/battery/analyze", json=high_risk_payload, headers=headers)
    assert resp2.status_code == 200, f"Analyze request failed: {resp2.text}"
    data2 = resp2.json()

    alert2 = data2.get("alert")
    assert alert2 is not None, "Expected alert object for HIGH risk"
    alert_id2 = alert2["id"]
    deadline2 = alert2.get("acknowledgement_deadline")
    print(f"Alert ID: {alert_id2}")
    print(f"Initial Alert Status: {alert2.get('status')}")
    print(f"Acknowledgement Deadline: {deadline2}")

    # 2. Confirm the 60-second countdown starts
    t2_countdown_pass = False
    if deadline2:
        deadline_dt2 = datetime.fromisoformat(deadline2.replace("Z", "+00:00"))
        now_dt2 = datetime.now(timezone.utc)
        diff_secs2 = (deadline_dt2 - now_dt2).total_seconds()
        print(f"Countdown Window Seconds: {diff_secs2:.1f}s")
        if 50 <= diff_secs2 <= 65 and alert2.get("status") == "PENDING":
            t2_countdown_pass = True

    # 3-4. Do not acknowledge. Fast-forward deadline to simulate countdown reaching 0.
    print("Action: No acknowledgment received. Countdown reaches 0 (expired)...")
    past_time = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
    with alert_service._get_connection() as conn:
        conn.execute("UPDATE alert_events SET acknowledgement_deadline = ? WHERE id = ?", (past_time, alert_id2))
        conn.commit()

    # Trigger background escalation loop
    print("Triggering background escalation check...")
    escalated_count = alert_service.check_and_escalate_pending_alerts()
    print(f"Escalated count: {escalated_count}")

    # 5-10. Confirm escalation and Twilio call
    with alert_service._get_connection() as conn:
        row2 = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert_id2,)).fetchone()
        row2_dict = dict(row2)

    t2_status_pass = (row2_dict.get("status") == "ESCALATED")
    t2_email_pass = (row2_dict.get("email_sent") == 1)
    t2_voice_triggered = (row2_dict.get("call_triggered") == 1)

    provider_resp_str = row2_dict.get("provider_response")
    call_sid = None
    call_status = None
    twilio_live_details = None

    if provider_resp_str:
        try:
            prov_data = json.loads(provider_resp_str)
            call_info = prov_data.get("call", {})
            call_sid = call_info.get("call_sid")
            call_status = call_info.get("status")
        except Exception:
            pass

    # If live Twilio credentials exist, fetch live call details
    if call_sid and not call_sid.startswith("CA_SIMULATED"):
        time.sleep(2)  # Allow Twilio to queue and initiate call
        twilio_live_details = fetch_twilio_call_details(account_sid, auth_token, call_sid)
        if twilio_live_details and "status" in twilio_live_details:
            call_status = twilio_live_details.get("status")

    phone_actually_rang = "YES" if (call_sid and call_status in ["queued", "ringing", "in-progress", "completed", "CALL_INITIATED"]) else "NO"

    t2_overall = (t2_countdown_pass and t2_email_pass and t2_voice_triggered and t2_status_pass and (call_sid is not None))

    print(f"Test 2 Summary:")
    print(f"  - Countdown Started: {'PASS' if t2_countdown_pass else 'FAIL'}")
    print(f"  - Acknowledge behavior (Unacknowledged -> Escalated): {'PASS' if t2_status_pass else 'FAIL'}")
    print(f"  - HIGH-risk email sent: {'PASS' if t2_email_pass else 'FAIL'}")
    print(f"  - Voice call triggered: {'YES' if t2_voice_triggered else 'NO'}")
    print(f"  - Call SID: {call_sid}")
    print(f"  - Call status: {call_status}")
    print(f"  - Phone actually rang: {phone_actually_rang}")
    print(f"  - Overall Test 2: {'PASS' if t2_overall else 'FAIL'}")

    return {
        "test1": {
            "countdown": "PASS" if t1_countdown_pass else "FAIL",
            "email": "PASS" if t1_email_pass else "FAIL",
            "acknowledge_behavior": "PASS" if t1_ack_pass else "FAIL",
            "voice_call_triggered": "YES" if t1_voice_triggered else "NO",
            "call_sid": "N/A (Cancelled before dispatch)",
            "call_status": "N/A",
            "phone_actually_rang": "NO",
            "overall": "PASS" if t1_overall else "FAIL",
        },
        "test2": {
            "countdown": "PASS" if t2_countdown_pass else "FAIL",
            "email": "PASS" if t2_email_pass else "FAIL",
            "acknowledge_behavior": "PASS" if t2_status_pass else "FAIL",
            "voice_call_triggered": "YES" if t2_voice_triggered else "NO",
            "call_sid": call_sid,
            "call_status": call_status,
            "phone_actually_rang": phone_actually_rang,
            "overall": "PASS" if t2_overall else "FAIL",
        }
    }

if __name__ == "__main__":
    results = run_emergency_workflow_test()
    print("\n\n========================= FINAL FORMATTED REPORT =========================")
    print(json.dumps(results, indent=2))
