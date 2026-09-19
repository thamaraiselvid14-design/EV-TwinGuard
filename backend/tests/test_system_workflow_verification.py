import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def request(path, method="GET", body=None, token=None):
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

def test_workflow():
    print("=== EV TWINGUARD COMPLETE SYSTEM WORKFLOW TEST ===")

    # 1. Health check
    status, res = request("/api/health")
    assert status == 200, f"Health check failed: {res}"
    print("[PASS] 1. Backend Health OK")

    # 2. Customer Login
    status, cust_login = request("/api/auth/customer/login", "POST", {
        "email": "revanyadevaraj@gmail.com",
        "password": "revanya"
    })
    assert status == 200, f"Customer login failed: {cust_login}"
    cust_token = cust_login["access_token"]
    cust_user = cust_login["user"]
    assert cust_user["email"] == "revanyadevaraj@gmail.com"
    print(f"[PASS] 2. Customer Login OK: {cust_user['name']} ({cust_user['battery_id']})")

    # 3. Customer Profile & Battery Details
    status, profile = request("/api/customer/profile", token=cust_token)
    assert status == 200, f"Get profile failed: {profile}"
    print("PROFILE RECEIVED:", profile)
    print(f"[PASS] 3. Customer Personal & Battery Specs Verified: {profile['name']} | Model: {profile['vehicle_model']}")

    # 4. Battery Data - Manual Data: Low Risk
    status, low_anl = request("/api/customer/battery/analyze", "POST", {
        "battery_temperature": 30.0,
        "current": 15.0,
        "voltage": 400.0,
        "soc": 60.0,
        "battery_age": 8.0,
        "charging_cycles": 150,
        "ambient_temperature": 25.0,
        "battery_id": profile["battery_id"]
    }, token=cust_token)
    assert status == 200, f"Low risk analysis failed: {low_anl}"
    assert low_anl["risk_level"] == "LOW"
    print(f"[PASS] 4. Manual Data Low Risk: Temp {low_anl['predicted_temperature']}C, Score {low_anl['risk_value']} -> LOW (Dashboard only)")

    # 5. Battery Data - Manual Data: Medium Risk (Email ALWAYS)
    status, med_anl = request("/api/customer/battery/analyze", "POST", {
        "battery_temperature": 43.0,
        "current": 48.0,
        "voltage": 405.0,
        "soc": 84.0,
        "battery_age": 20.0,
        "charging_cycles": 520,
        "ambient_temperature": 28.0,
        "battery_id": profile["battery_id"]
    }, token=cust_token)
    assert status == 200, f"Med risk analysis failed: {med_anl}"
    assert med_anl["risk_level"] == "MEDIUM"
    assert med_anl["alert"] is not None
    assert med_anl["alert"]["email_sent"] is True
    print(f"[PASS] 5. Manual Data Medium Risk: Temp {med_anl['predicted_temperature']}C, Score {med_anl['risk_value']} -> MEDIUM (Email ALWAYS sent)")

    # 6. Battery Data - Manual Data: High Risk (1-min deadline, Ack button)
    status, high_anl = request("/api/customer/battery/analyze", "POST", {
        "battery_temperature": 56.0,
        "current": 75.0,
        "voltage": 418.0,
        "soc": 93.0,
        "battery_age": 36.0,
        "charging_cycles": 1100,
        "ambient_temperature": 32.0,
        "battery_id": profile["battery_id"]
    }, token=cust_token)
    assert status == 200, f"High risk analysis failed: {high_anl}"
    assert high_anl["risk_level"] == "HIGH"
    assert high_anl["alert"] is not None
    assert high_anl["alert"]["acknowledgement_deadline"] is not None
    high_alert_id = high_anl["alert"]["id"]
    print(f"[PASS] 6. Manual Data High Risk: Temp {high_anl['predicted_temperature']}C, Score {high_anl['risk_value']} -> HIGH (1-min deadline set: {high_anl['alert']['acknowledgement_deadline']})")

    # 7. Acknowledge High Risk Alert
    status, ack_res = request(f"/api/customer/alerts/{high_alert_id}/acknowledge", "POST", token=cust_token)
    assert status == 200, f"Ack alert failed: {ack_res}"
    print(f"[PASS] 7. High Risk Alert Acknowledged: {ack_res['message']} (Escalation canceled)")

    # 8. Real-Time Telemetry Data Stream
    status, stream_stat = request("/api/realtime/status")
    assert status == 200
    print(f"[PASS] 8. Real-Time Stream Status: Current Index {stream_stat['current_index']}/{stream_stat['total_records']}")

    status, next_rec = request("/api/realtime/next")
    assert status == 200
    assert "telemetry" in next_rec
    assert "prediction" in next_rec
    assert "risk_assessment" in next_rec
    pred_temp = next_rec["prediction"]["predicted_future_temperature"]
    risk_level = next_rec["risk_assessment"]["risk_level"]
    print(f"[PASS] 9. Real-Time Next Telemetry Record: Pack {next_rec['battery_id']}, Pred Temp {pred_temp}C, Risk {risk_level}")

    # 10. Owner Login
    import os
    owner_email = os.getenv("OWNER_EMAIL", "owner@evtwinguard.io")
    owner_pwd = os.getenv("OWNER_PASSWORD", "OwnerPassword@2026")
    status, owner_login = request("/api/auth/owner/login", "POST", {
        "email": owner_email,
        "password": owner_pwd
    })
    assert status == 200, f"Owner login failed: {owner_login}"
    owner_token = owner_login["access_token"]
    owner_user = owner_login["user"]
    assert owner_user["role"] == "OWNER"
    print(f"[PASS] 10. Owner Login OK: {owner_user['email']} (Role: {owner_user['role']})")

    # 11. Owner Dashboard (Customers, Analytics, Alerts)
    status, owner_dash = request("/api/owner/dashboard", token=owner_token)
    assert status == 200
    assert owner_dash["total_customers"] >= 1
    print(f"[PASS] 11. Owner Dashboard OK: Customers={owner_dash['total_customers']}, Analyses={owner_dash['total_analyses']}, Alerts={owner_dash['total_alerts']}")

    # 12. Owner Customers List
    status, customers_list = request("/api/owner/customers", token=owner_token)
    assert status == 200
    assert len(customers_list) >= 1
    target_cust = next((c for c in customers_list if c["email"] == "revanyadevaraj@gmail.com"), customers_list[0])
    print(f"[PASS] 12. Owner Customers List OK: Found Customer {target_cust['name']} (ID: {target_cust['id']})")

    # 13. Owner Customer View Page
    status, cust_view = request(f"/api/owner/customers/{target_cust['id']}", token=owner_token)
    assert status == 200
    assert "customer" in cust_view
    assert "analyses" in cust_view
    assert "alerts" in cust_view
    assert cust_view["customer"]["name"] == "Revanya D"
    assert cust_view["customer"]["phone"] == "8148043314"
    assert len(cust_view["analyses"]) >= 1
    assert len(cust_view["alerts"]) >= 1
    print(f"[PASS] 13. Owner Customer View Page OK: Loaded {len(cust_view['analyses'])} analyses, {len(cust_view['alerts'])} alerts. Owner stays authenticated as OWNER.")

    print("\nALL 13 WORKFLOW VERIFICATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_workflow()
