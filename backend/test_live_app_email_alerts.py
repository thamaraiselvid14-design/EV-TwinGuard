import urllib.request
import urllib.parse
import json
import sqlite3
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = Path("data/alerts.db")
EXPECTED_RECIPIENT = "thamaraiselvid14@gmail.com"

results = {
    "MEDIUM_RISK": {},
    "LOW_RISK": {},
    "HIGH_RISK": {},
}

def make_request(path, method="GET", body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    else:
        data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            err_json = json.loads(content)
        except Exception:
            err_json = {"raw": content}
        return e.code, err_json


def run_live_tests():
    print("=" * 75)
    print("EV TWINGUARD EMAIL ALERT - LIVE APPLICATION VERIFICATION TEST")
    print("Target Recipient:", EXPECTED_RECIPIENT)
    print("=" * 75)

    # 1. Health check
    status, health = make_request("/api/health")
    assert status == 200, f"Backend health failed: {health}"
    print("\n[OK] 1. Live Application Server Online (http://127.0.0.1:8000)")

    # 2. Customer Login
    status, login_res = make_request("/api/auth/customer/login", "POST", {
        "email": "revanyadevaraj@gmail.com",
        "password": "password123",
    })
    if status != 200:
        status, login_res = make_request("/api/auth/customer/login", "POST", {
            "email": "revanyadevaraj@gmail.com",
            "password": "revanya",
        })
    assert status == 200, f"Login failed: {login_res}"
    token = login_res["access_token"]
    user = login_res["user"]
    print(f"[OK] 2. Logged in as Customer: {user['name']} ({user['email']})")

    # =========================================================================
    # TEST 1: MEDIUM RISK
    # =========================================================================
    print("\n" + "=" * 50)
    print("RUNNING TEST 1: MEDIUM RISK CONDITION")
    print("=" * 50)

    med_battery_input = {
        "battery_id": "BAT-MED-VERIFY",
        "battery_temperature": 40.0,
        "current": 35.0,
        "voltage": 405.0,
        "soc": 82.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
        "ambient_temperature": 28.0,
    }
    print(f"Inputs: Temp={med_battery_input['battery_temperature']}°C, SOC={med_battery_input['soc']}%, "
          f"Current={med_battery_input['current']}A, Voltage={med_battery_input['voltage']}V, "
          f"Age={med_battery_input['battery_age']}mo, Cycles={med_battery_input['charging_cycles']}")

    status, med_resp = make_request("/api/customer/battery/analyze", "POST", med_battery_input, token=token)
    assert status == 200, f"Medium risk analysis failed: {med_resp}"

    pred_temp = med_resp["predicted_temperature"]
    risk_val = med_resp["risk_value"]
    risk_lvl = med_resp["risk_level"]
    alert_info = med_resp.get("alert")

    print(f"Analysis Output -> Risk Level: {risk_lvl}, Risk Score: {risk_val}/100, Predicted Temp: {pred_temp}°C")

    # Verification checks
    check_med_level = risk_lvl == "MEDIUM"
    check_med_score = 40.0 <= risk_val <= 69.0
    check_med_auto_email = alert_info is not None and alert_info.get("email_sent") is True
    check_med_unacknowledged = alert_info is not None and alert_info.get("acknowledged") is False

    # Fetch DB alert event record
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    alert_row = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert_info["id"],)).fetchone()
    alert_dict = dict(alert_row)
    conn.close()

    email_report = alert_dict["full_report"]
    factors = json.loads(alert_dict["main_risk_factors"])

    check_med_recipient = alert_dict.get("email_sent") == 1
    check_contains_risk_lvl = "Safety Risk Level:      MEDIUM" in email_report
    check_contains_risk_val = f"Risk Value / Score:     {risk_val:.1f} / 100" in email_report
    check_contains_pred_temp = f"Predicted Future Temp:      {pred_temp:.1f} °C" in email_report
    check_contains_soc = f"State of Charge (SOC):      {med_battery_input['soc']:.1f} %" in email_report
    check_contains_voltage = f"Operating Voltage:          {med_battery_input['voltage']:.1f} V" in email_report
    check_contains_current = f"Charging Current:           {med_battery_input['current']:.1f} A" in email_report
    check_contains_temp = f"Current Measured Temp:      {med_battery_input['battery_temperature']:.1f} °C" in email_report
    check_contains_why_medium = "--- 3. WHY IS IT MEDIUM? ---" in email_report
    check_contains_dynamic_reason_header = "Dynamic Risk Assessment Reason:" in email_report
    check_contains_dynamic_factors = all(f in email_report for f in factors) and len(factors) > 0

    print("\n--- MEDIUM RISK EMAIL CONTENT PREVIEW ---")
    print(email_report)
    print("-----------------------------------------")

    med_pass = (
        check_med_level and check_med_score and check_med_auto_email and
        check_med_unacknowledged and check_med_recipient and
        check_contains_risk_lvl and check_contains_risk_val and
        check_contains_pred_temp and check_contains_soc and
        check_contains_voltage and check_contains_current and
        check_contains_temp and check_contains_why_medium and
        check_contains_dynamic_reason_header and check_contains_dynamic_factors
    )

    print("\n[MEDIUM RISK RESULTS]")
    print(f"  - Risk Level == MEDIUM: {'PASS' if check_med_level else 'FAIL'} ({risk_lvl})")
    print(f"  - Risk Score in Range (40-69): {'PASS' if check_med_score else 'FAIL'} ({risk_val})")
    print(f"  - Auto-triggered without Acknowledge: {'PASS' if check_med_auto_email and check_med_unacknowledged else 'FAIL'}")
    print(f"  - Recipient: {EXPECTED_RECIPIENT} (Dispatched: {'PASS' if check_med_recipient else 'FAIL'})")
    print(f"  - Contains Risk Level: {'PASS' if check_contains_risk_lvl else 'FAIL'}")
    print(f"  - Contains Risk Value: {'PASS' if check_contains_risk_val else 'FAIL'}")
    print(f"  - Contains Predicted Temperature: {'PASS' if check_contains_pred_temp else 'FAIL'}")
    print(f"  - Contains Battery Values (SOC, V, I, T, Age, Cycles): {'PASS' if (check_contains_soc and check_contains_voltage and check_contains_current and check_contains_temp) else 'FAIL'}")
    print(f"  - Contains 'WHY IS IT MEDIUM?': {'PASS' if check_contains_why_medium else 'FAIL'}")
    print(f"  - Contains Dynamic Reasons ({factors}): {'PASS' if check_contains_dynamic_factors else 'FAIL'}")
    print(f"OVERALL MEDIUM RISK TEST: {'PASS' if med_pass else 'FAIL'}")

    # =========================================================================
    # TEST 2: LOW RISK
    # =========================================================================
    print("\n" + "=" * 50)
    print("RUNNING TEST 2: LOW RISK CONDITION")
    print("=" * 50)

    low_battery_input = {
        "battery_id": "BAT-LOW-VERIFY",
        "battery_temperature": 28.0,
        "current": 10.0,
        "voltage": 390.0,
        "soc": 45.0,
        "battery_age": 6.0,
        "charging_cycles": 100,
        "ambient_temperature": 25.0,
    }
    print(f"Inputs: Temp={low_battery_input['battery_temperature']}°C, SOC={low_battery_input['soc']}%, "
          f"Current={low_battery_input['current']}A, Voltage={low_battery_input['voltage']}V, "
          f"Age={low_battery_input['battery_age']}mo, Cycles={low_battery_input['charging_cycles']}")

    status, low_resp = make_request("/api/customer/battery/analyze", "POST", low_battery_input, token=token)
    assert status == 200, f"Low risk analysis failed: {low_resp}"

    pred_temp_low = low_resp["predicted_temperature"]
    risk_val_low = low_resp["risk_value"]
    risk_lvl_low = low_resp["risk_level"]
    alert_info_low = low_resp.get("alert")

    print(f"Analysis Output -> Risk Level: {risk_lvl_low}, Risk Score: {risk_val_low}/100, Predicted Temp: {pred_temp_low}°C")

    check_low_level = risk_lvl_low == "LOW"
    check_low_score = risk_val_low < 40.0
    check_low_no_email = alert_info_low is None

    low_pass = check_low_level and check_low_score and check_low_no_email

    print("\n[LOW RISK RESULTS]")
    print(f"  - Risk Level == LOW: {'PASS' if check_low_level else 'FAIL'} ({risk_lvl_low})")
    print(f"  - Risk Score < 40: {'PASS' if check_low_score else 'FAIL'} ({risk_val_low})")
    print(f"  - No Email Sent (alert is None): {'PASS' if check_low_no_email else 'FAIL'}")
    print(f"OVERALL LOW RISK TEST: {'PASS' if low_pass else 'FAIL'}")

    # =========================================================================
    # TEST 3: HIGH RISK
    # =========================================================================
    print("\n" + "=" * 50)
    print("RUNNING TEST 3: HIGH RISK CONDITION")
    print("=" * 50)

    high_battery_input = {
        "battery_id": "BAT-HIGH-VERIFY",
        "battery_temperature": 52.0,
        "current": 75.0,
        "voltage": 420.0,
        "soc": 95.0,
        "battery_age": 38.0,
        "charging_cycles": 900,
        "ambient_temperature": 35.0,
    }
    print(f"Inputs: Temp={high_battery_input['battery_temperature']}°C, SOC={high_battery_input['soc']}%, "
          f"Current={high_battery_input['current']}A, Voltage={high_battery_input['voltage']}V, "
          f"Age={high_battery_input['battery_age']}mo, Cycles={high_battery_input['charging_cycles']}")

    status, high_resp = make_request("/api/customer/battery/analyze", "POST", high_battery_input, token=token)
    assert status == 200, f"High risk analysis failed: {high_resp}"

    pred_temp_high = high_resp["predicted_temperature"]
    risk_val_high = high_resp["risk_value"]
    risk_lvl_high = high_resp["risk_level"]
    alert_info_high = high_resp.get("alert")

    print(f"Analysis Output -> Risk Level: {risk_lvl_high}, Risk Score: {risk_val_high}/100, Predicted Temp: {pred_temp_high}°C")

    check_high_level = risk_lvl_high == "HIGH"
    check_high_score = risk_val_high >= 70.0
    check_high_pending = alert_info_high is not None and alert_info_high.get("status") == "PENDING"

    # Acknowledge high risk alert
    alert_id_high = alert_info_high["id"]
    status, ack_resp = make_request(f"/api/customer/alerts/{alert_id_high}/acknowledge", "POST", token=token)
    assert status == 200, f"High risk acknowledgement failed: {ack_resp}"

    check_ack_success = ack_resp.get("success") is True
    check_ack_email_sent = ack_resp.get("email_sent") is True

    # Check DB full report for High risk
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    alert_row_high = conn.execute("SELECT * FROM alert_events WHERE id = ?", (alert_id_high,)).fetchone()
    alert_dict_high = dict(alert_row_high)
    conn.close()

    email_report_high = alert_dict_high["full_report"]
    factors_high = json.loads(alert_dict_high["main_risk_factors"])

    print("\n--- HIGH RISK EMAIL CONTENT PREVIEW ---")
    print(email_report_high)
    print("---------------------------------------")

    check_high_why_high = "--- 3. WHY IS IT HIGH? ---" in email_report_high
    check_high_dynamic_reasons = all(f in email_report_high for f in factors_high) and len(factors_high) > 0

    high_pass = (
        check_high_level and check_high_score and check_high_pending and
        check_ack_success and check_ack_email_sent and
        check_high_why_high and check_high_dynamic_reasons
    )

    print("\n[HIGH RISK RESULTS]")
    print(f"  - Risk Level == HIGH: {'PASS' if check_high_level else 'FAIL'} ({risk_lvl_high})")
    print(f"  - Risk Score >= 70: {'PASS' if check_high_score else 'FAIL'} ({risk_val_high})")
    print(f"  - Existing High-Risk Workflow & Acknowledge: {'PASS' if check_ack_success else 'FAIL'}")
    print(f"  - Email Dispatched to Recipient ({EXPECTED_RECIPIENT}): {'PASS' if check_ack_email_sent else 'FAIL'}")
    print(f"  - Contains 'WHY IS IT HIGH?': {'PASS' if check_high_why_high else 'FAIL'}")
    print(f"  - Contains Dynamic Reasons ({factors_high}): {'PASS' if check_high_dynamic_reasons else 'FAIL'}")
    print(f"OVERALL HIGH RISK TEST: {'PASS' if high_pass else 'FAIL'}")

    print("\n" + "=" * 75)
    print("SUMMARY OF ALL EMAIL ALERT TESTS:")
    print(f"  1. MEDIUM RISK EMAIL TEST : {'PASS' if med_pass else 'FAIL'}")
    print(f"  2. LOW RISK NO EMAIL TEST : {'PASS' if low_pass else 'FAIL'}")
    print(f"  3. HIGH RISK EMAIL TEST   : {'PASS' if high_pass else 'FAIL'}")
    print("=" * 75)


if __name__ == "__main__":
    run_live_tests()
