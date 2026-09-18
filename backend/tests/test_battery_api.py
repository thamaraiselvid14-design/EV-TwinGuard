import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_valid_battery_input_returns_200():
    payload = {
        "battery_id": "EV001",
        "soc": 75.5,
        "voltage": 400.2,
        "charging_current": 18.0,
        "battery_temperature": 32.5,
        "ambient_temperature": 28.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "validated"
    assert data["message"] == "Battery data validated successfully."
    assert data["data"]["battery_id"] == "EV001"
    assert data["data"]["soc"] == 75.5
    assert data["data"]["voltage"] == 400.2
    assert data["data"]["charging_current"] == 18.0
    assert data["data"]["battery_temperature"] == 32.5
    assert data["data"]["ambient_temperature"] == 28.0
    assert data["data"]["battery_age"] == 18.0
    assert data["data"]["charging_cycles"] == 450

    # Explicit check: ensure NO Phase 2 prediction or risk keys exist
    forbidden_keys = ["prediction", "predicted_temperature", "risk", "risk_level", "risk_score", "alert"]
    for k in forbidden_keys:
        assert k not in data
        assert k not in data["data"]


def test_missing_battery_id_rejected():
    payload = {
        "soc": 75.5,
        "voltage": 400.2,
        "charging_current": 18.0,
        "battery_temperature": 32.5,
        "ambient_temperature": 28.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_empty_whitespace_battery_id_rejected():
    payload = {
        "battery_id": "   ",
        "soc": 75.5,
        "voltage": 400.2,
        "charging_current": 18.0,
        "battery_temperature": 32.5,
        "ambient_temperature": 28.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_soc_below_zero_rejected():
    payload = {
        "battery_id": "EV001",
        "soc": -5.0,
        "voltage": 400.2,
        "charging_current": 18.0,
        "battery_temperature": 32.5,
        "ambient_temperature": 28.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_soc_above_100_rejected():
    payload = {
        "battery_id": "EV001",
        "soc": 100.1,
        "voltage": 400.2,
        "charging_current": 18.0,
        "battery_temperature": 32.5,
        "ambient_temperature": 28.0,
        "battery_age": 18.0,
        "charging_cycles": 450,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_negative_and_zero_voltage_rejected():
    # Negative voltage
    response_neg = client.post("/api/battery/manual-input", json={
        "battery_id": "EV001",
        "soc": 50.0,
        "voltage": -400.0,
        "charging_current": 10.0,
        "battery_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": 12.0,
        "charging_cycles": 200,
    })
    assert response_neg.status_code == 422

    # Zero voltage
    response_zero = client.post("/api/battery/manual-input", json={
        "battery_id": "EV001",
        "soc": 50.0,
        "voltage": 0.0,
        "charging_current": 10.0,
        "battery_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": 12.0,
        "charging_cycles": 200,
    })
    assert response_zero.status_code == 422


def test_negative_charging_current_rejected():
    payload = {
        "battery_id": "EV001",
        "soc": 50.0,
        "voltage": 380.0,
        "charging_current": -5.0,
        "battery_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": 12.0,
        "charging_cycles": 200,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_negative_battery_age_rejected():
    payload = {
        "battery_id": "EV001",
        "soc": 50.0,
        "voltage": 380.0,
        "charging_current": 10.0,
        "battery_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": -1.5,
        "charging_cycles": 200,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_negative_charging_cycles_rejected():
    payload = {
        "battery_id": "EV001",
        "soc": 50.0,
        "voltage": 380.0,
        "charging_current": 10.0,
        "battery_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": 12.0,
        "charging_cycles": -10,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_invalid_data_types_rejected():
    payload = {
        "battery_id": "EV001",
        "soc": "not_a_number",
        "voltage": 380.0,
        "charging_current": 10.0,
        "battery_temperature": 25.0,
        "ambient_temperature": 22.0,
        "battery_age": 12.0,
        "charging_cycles": 200,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 422


def test_valid_decimal_values_accepted():
    payload = {
        "battery_id": "EV-TRUCK-099",
        "soc": 0.05,
        "voltage": 799.85,
        "charging_current": 0.0,
        "battery_temperature": -15.4,
        "ambient_temperature": -18.2,
        "battery_age": 0.5,
        "charging_cycles": 0,
    }
    response = client.post("/api/battery/manual-input", json=payload)
    assert response.status_code == 200
    assert response.json()["data"]["battery_id"] == "EV-TRUCK-099"
    assert response.json()["data"]["battery_temperature"] == -15.4
