# EV TwinGuard

**AI-Powered EV Battery Digital Twin & Safety Monitoring System**

EV TwinGuard is a full-stack digital twin platform designed for real-time Electric Vehicle (EV) battery health telemetry validation, machine learning steady-state temperature forecasting, multi-factor safety risk scoring, interactive What-If charging simulation, automated multi-channel safety alerting (Email + Emergency Calls + Simulated Disconnects), and persistent SQLite alert audit logging.

---

## 1. End-to-End System Workflow

```text
MANUAL BATTERY INPUT ────────┐
(ID, SOC, V, I, T, Env, Age) │
                             ▼
                  VALIDATE SENSOR VALUES
                             │
                             ▼
                 AI TEMPERATURE PREDICTION
              (Random Forest Regressor, R²=0.994)
                             │
                             ▼
                  MULTI-FACTOR RISK ENGINE
               (0–100 Weighted Composite Score)
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
   LOW (0–39)          MEDIUM (40–69)        HIGH (70–100)
       │                     │                     │
       ▼                     ▼                     ▼
• Dashboard display   • Email report dispatch• Email report dispatch
• Contactor CONNECTED • SQLite alert logged  • Emergency call triggered
• No alerts triggered • Contactor CONNECTED  • SIMULATED DISCONNECT
                                             • SQLite alert logged

DATASET-SOURCED TELEMETRY ──► SAME VALIDATION ──► SAME PREDICTION ──► SAME RISK & ALERTS

WHAT-IF CHARGING SIMULATOR:
• 12A Scenario ──► AI Prediction ──► Risk Score & Level ──┐
• 18A Scenario ──► AI Prediction ──► Risk Score & Level ──┼──► Recharts Comparison
• 25A Scenario ──► AI Prediction ──► Risk Score & Level ──┘
```

---

## 2. Technology Stack

### Backend
- **Python 3.11+**
- **FastAPI** – High-performance asynchronous REST API framework
- **Uvicorn** – ASGI web server
- **Pydantic v2** – Strict physical boundary schema validation
- **Scikit-learn & Joblib** – Random Forest regression model ($R^2 = 0.9940$, $\text{MAE} = 0.5356^\circ\text{C}$)
- **SQLite3** – Persistent storage for audit-grade safety incident logs (`backend/data/alerts.db`)
- **Pytest** – Full end-to-end integration and unit test suite (39 tests)

### Frontend
- **React 18** – Modular user interface
- **Vite** – Fast build tooling and dev server
- **Tailwind CSS** – Dark-mode EV cockpit styling
- **Recharts** – Temperature and risk comparison graphs
- **Lucide React** – System iconography

---

## 3. Project Structure

```text
EV-TwinGuard/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── battery.py        # All battery telemetry, prediction, risk, simulation & alert routes
│   │   │   └── routes.py         # System health routes
│   │   ├── models/
│   │   │   ├── battery_temp_model.joblib # Serialized Scikit-learn Random Forest model
│   │   │   └── train.py          # Physics-grounded training pipeline
│   │   ├── services/
│   │   │   ├── prediction_service.py # 7-feature AI inference & confidence attribution
│   │   │   ├── risk_service.py       # Configurable weighted risk engine
│   │   │   ├── alert_service.py      # SQLite logger, SMTP email, and Twilio/mock call dispatcher
│   │   │   └── simulation_service.py # What-If (12A/18A/25A) & time-series simulation service
│   │   ├── schemas/
│   │   │   └── battery.py        # Pydantic schemas
│   │   ├── data/
│   │   │   ├── loader.py         # Chunked streaming CSV dataset loader
│   │   │   └── dataset_service.py# Sampling & fleet data queries
│   │   └── main.py               # FastAPI entrypoint, CORS, and root endpoints
│   ├── data/
│   │   ├── alerts.db             # SQLite safety alert events database
│   │   └── ev_battery_dataset.csv# Demonstration fleet dataset
│   ├── tests/
│   │   ├── test_e2e_integration_flow.py # Complete LOW, MEDIUM, HIGH, dataset & What-If tests
│   │   ├── test_battery_api.py   # Validation & bounds tests
│   │   ├── test_prediction_and_risk.py  # Model inference & risk formula tests
│   │   ├── test_charging_simulator.py  # What-If simulator tests
│   │   ├── test_alert_system.py        # Alert persistence & disconnect tests
│   │   ├── test_dataset_loader.py      # Data loader tests
│   │   └── test_simulation_and_alerts.py # Parametric time-series tests
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── BatteryInformation.jsx      # 8-parameter live telemetry grid & presets
    │   │   ├── AIPredictionCard.jsx        # Predicted temp, delta, risk score & tier
    │   │   ├── RiskFactors.jsx             # Driving factors & stress sub-scores
    │   │   ├── WhatIfChargingSimulator.jsx # 12A vs 18A vs 25A cards & Recharts graph
    │   │   ├── AlertStatus.jsx             # Email, call, and simulated disconnect status
    │   │   ├── AlertHistory.jsx            # SQLite alert_events log with Refresh
    │   │   ├── DigitalTwinSimulator.jsx    # Parametric time-series simulator
    │   │   ├── DatasetExplorer.jsx         # Fleet big data explorer
    │   │   └── AlertCenter.jsx             # Live incident management
    │   ├── pages/
    │   │   └── Dashboard.jsx               # Main cockpit layout
    │   ├── services/
    │   │   └── api.js                      # Centralized API service
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
```

---

## 4. Quick Start & Execution

### 1. Start the Backend Server (FastAPI)
```powershell
cd "backend"
.\venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Root: `http://127.0.0.1:8000`
- Swagger Docs: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend Application (Vite + React)
```powershell
cd "frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```
- Dashboard UI: `http://127.0.0.1:5173`

---

## 5. Running the Complete Automated Test Suite

Run all 39 tests across the 7 backend test suites:

```powershell
cd "backend"
.\venv\Scripts\pytest.exe -v
```

All 39 unit and integration tests validate:
- Sensor validation and bounds rejection (422 responses).
- Random Forest ML regression accuracy.
- Multi-factor risk scoring across LOW, MEDIUM, HIGH thresholds.
- What-If charging current physical scaling (12A, 18A, 25A).
- SQLite alert logging and history retrieval.
- Automated email and simulated phone call dispatches.
- SIMULATED DISCONNECT safety trip logic.

---

## 6. Hackathon Demonstration Scenarios

1. **Nominal City Commute (LOW Risk)**:
   - Select preset or enter: SOC `50%`, Voltage `395V`, Current `12A`, Temp `25°C`.
   - Click **Analyze Battery**.
   - Result: Predicted temp $\sim 28.5^\circ\text{C}$, Risk Score $< 30 / 100$, Risk Level `LOW`. Status: `● ACTIVE`, no alerts fired.

2. **Highway Fast Charging (MEDIUM Risk)**:
   - Select preset or enter: SOC `78%`, Voltage `405V`, Current `45A`, Temp `38°C`.
   - Click **Analyze Battery**.
   - Result: Predicted temp $\sim 44.2^\circ\text{C}$, Risk Score $\sim 58 / 100$, Risk Level `MEDIUM`. Status: Email report generated, alert logged in SQLite, contactor remains `CONNECTED`.

3. **Thermal Stress & Runaway Prevention (HIGH Risk)**:
   - Select preset or enter: SOC `93%`, Voltage `418V`, Current `75A`, Temp `52°C`.
   - Click **Analyze Battery**.
   - Result: Predicted temp $> 55^\circ\text{C}$, Risk Score $> 75 / 100$, Risk Level `HIGH`. Status: Email sent, emergency phone call triggered, contactor trips to `● SIMULATED DISCONNECT`, event logged in SQLite alert history.
