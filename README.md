# EV TwinGuard

**AI-Powered EV Battery Digital Twin, Health Monitoring & Safety Alert Platform**

EV TwinGuard is an end-to-end digital twin ecosystem built for real-time Electric Vehicle (EV) battery health telemetry validation, machine learning steady-state temperature forecasting, multi-factor safety risk scoring, interactive "What-If" charging simulation, automated multi-channel safety alerting (Live Gmail SMTP Email + Twilio Emergency Calls + Simulated Contactor Disconnects), and persistent SQLite audit logging.

The system features dual role-based access control with dedicated **Customer** and **Fleet Owner** portals.

---

## 1. System Architecture & Workflow

```text
                               EV TWINGUARD ECOSYSTEM
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
 ┌──────────────┐                                                 ┌──────────────┐
 │ CUSTOMER APP │                                                 │  OWNER APP   │
 └──────┬───────┘                                                 └──────┬───────┘
        │                                                                │
        ├─► Register / Login                                             ├─► Owner Login
        │                                                                │
        ▼                                                                ▼
┌───────────────────┐                                            ┌───────────────────┐
│CUSTOMER DASHBOARD │                                            │  OWNER DASHBOARD  │
│ - Personal Info   │                                            │ - Fleet Overview  │
│ - Battery Specs   │                                            │ - Risk Analytics  │
└─────────┬─────────┘                                            │ - Customer List   │
          │                                                      └─────────┬─────────┘
   [ INPUT MODE ]                                                          │
   ├── 1. Manual Input (8 Telemetry Parameters & Presets)                  ▼
   └── 2. Real-Time Dataset Stream (Sequential Live Replay)      ┌───────────────────┐
          │                                                      │ CUSTOMER DEEP-DIVE│
          ▼                                                      │ - Battery History │
 ┌───────────────────┐                                           │ - Alert Audit Logs│
 │   AI PREDICTION   │                                           └───────────────────┘
 │  (Random Forest)  │ ──► Predicted Future Temp (°C)
 └────────┬──────────┘
          ▼
 ┌───────────────────┐
 │    RISK ENGINE    │ ──► Multi-Factor Score (0-100) & Dynamic Reasons
 └────────┬──────────┘
          │
          ├──► [ LOW RISK ] ────► Dashboard Display Only (Nominal Envelope)
          │
          ├──► [ MEDIUM RISK ] ──► Auto-dispatches Detailed Email Report (No Acknowledge needed)
          │
          └──► [ HIGH RISK ] ───► SIMULATED DISCONNECT + 60s Live Countdown Window
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
            [ ACKNOWLEDGED ≤ 60s ]                 [ UNACKNOWLEDGED > 60s ]
            - Dispatches Email Report               - Automated Escalation Worker
            - Cancels SMS & Phone Call             - Dispatches Email + SMS + Twilio Call
```

---

## 2. Implemented Core Features

### 1. Dual Role-Based Web Portals

#### A. Customer Portal
- **Authentication**: Customer registration and sign-in with PBKDF2-HMAC-SHA256 password encryption and JWT session tokens.
- **Customer Dashboard**: Displays customer profile, vehicle model, battery pack ID, and real-time battery status.
- **Two Input Modes**:
  1. **Manual Input Mode**: Enter 8 physical battery telemetry inputs (Voltage, Current, Battery Temp, Ambient Temp, SOC, Battery Age, Charge Cycles) with scenario presets (*Nominal Commute*, *Fast Charging*, *Thermal Stress*).
  2. **Real-Time Dataset Stream Mode**: Stream sequential live telemetry from backend datasets with configurable playback intervals (1s, 2s, 3s, 5s), play/pause controls, and historical timeline inspection.
- **AI Digital Twin Temperature Prediction**: Scikit-Learn Random Forest Regressor predicting battery steady-state temperature (+15 min continuous horizon).
- **Multi-Factor Risk Scoring Engine**: Calculates 0–100 risk values based on thermal delta, SOC saturation, charging current stress, battery age, and cycle degradation.
- **Interactive What-If Charging Simulator**: Simulates thermal behavior across varying charge currents (12A vs 18A vs 25A) with comparative Recharts graphs.
- **Customer Settings & Telemetry Center**: Inspect personal vehicle specs, prediction history, alert event logs, and notification status.

#### B. Fleet Owner Portal
- **Owner Login**: Administrative access for fleet managers.
- **Owner Dashboard**: Aggregated fleet metrics, total monitored vehicles, active battery packs, fleet risk breakdown (LOW / MEDIUM / HIGH), and recent system alert feeds.
- **Customer View (Deep Dive)**: Detailed view per customer showing vehicle specs, recent AI analyses, and safety audit logs.

---

### 2. Intelligent Safety & Alert Dispatch System

| Safety Risk Tier | Risk Score | Contactor State | Alerting Action | Email Delivery |
| :--- | :---: | :---: | :--- | :--- |
| **LOW** | $0 - 39.9$ | `● ACTIVE` | Nominal operating envelope. Displayed on dashboard only. | No email sent |
| **MEDIUM** | $40.0 - 69.9$ | `● CONNECTED` | Elevated monitoring. `[ ACKNOWLEDGE ALERT ]` button displayed. | **Automatically sent immediately** via Gmail SMTP with dynamic "WHY IS IT MEDIUM?" breakdown |
| **HIGH** | $70.0 - 100.0$ | `● SIMULATED DISCONNECT` | Critical safety trip. Contactor opens. **60-Second live countdown window** displayed. | **Acknowledged in time**: Full report emailed, emergency calls canceled.<br>**Timeout (>60s)**: Escalation worker fires Email + SMS + Twilio automated voice call. |

---

### 3. Live Email Dispatch Engine

- **Real SMTP Integration**: Connected to `smtp.gmail.com:587` with STARTTLS encryption and Google App Password authentication.
- **Dynamic Email Reports**: Formats and sends complete battery health reports containing:
  - Customer & Vehicle Details (Name, Email, Vehicle Model, Battery Pack ID)
  - Safety Risk Evaluation (Risk Level, Score / 100, Contactor State)
  - Physical Telemetry Parameters (SOC, Voltage, Current, Measured Temp, Ambient Temp, Age, Cycles)
  - AI Thermal Prediction (Predicted Future Temperature)
  - **Dynamic "WHY IS IT <LEVEL>?" Section**: Context-aware physical drivers explaining why the battery entered that risk state (e.g., *Thermal runaway risk*, *High current at saturation SOC*, *Cycle wear*).
  - BMS Recommended Mitigation Actions.
- **Strict Delivery Verification**: The backend verifies SMTP server acceptance before marking alerts as `email_sent = True`.

---

### 4. Automated Escalation Background Worker

- Built with FastAPI asynchronous lifespans (`lifespan`).
- Scans the SQLite database every 2 seconds for unacknowledged HIGH-risk alerts exceeding the 60-second deadline.
- Atomically escalates unacknowledged emergencies to prevent race conditions or duplicate dispatching.

---

## 3. Technology Stack

### Backend
- **Python 3.11+**
- **FastAPI** – High-performance asynchronous REST API framework
- **Uvicorn** – ASGI web server
- **Pydantic v2** – Physical boundary and telemetry schema validation
- **Scikit-Learn & Joblib** – Random Forest Regression model ($R^2 = 0.9940$, $\text{MAE} = 0.5356^\circ\text{C}$)
- **SQLite3** – Persistent storage for users, analyses, and alert event audit logs (`backend/data/alerts.db`)
- **Python smtplib & email** – Real Gmail SMTP email delivery with STARTTLS
- **Pytest** – Complete unit, integration, and E2E test suite (68 tests)

### Frontend
- **React 18** – Modern component architecture
- **Vite 5** – Fast build tooling and local dev server
- **Tailwind CSS** – Custom dark-mode EV cockpit interface
- **Recharts** – Temperature and risk visualization charts
- **Lucide React** – System and dashboard iconography

---

## 4. Application Routes & Portals

| Portal | Route | Description |
| :--- | :--- | :--- |
| **Customer Login** | `http://localhost:5173/customer/login` | Sign in with registered customer email and password |
| **Customer Register** | `http://localhost:5173/customer/register` | Register new customer account and vehicle/battery pack |
| **Customer Dashboard** | `http://localhost:5173/customer/dashboard` | Main telemetry cockpit, AI prediction, and alert center |
| **Customer Settings** | `http://localhost:5173/customer/settings` | Vehicle specifications, analysis history, and alerts |
| **Fleet Owner Login** | `http://localhost:5173/owner/login` | Fleet administrator login |
| **Owner Dashboard** | `http://localhost:5173/owner/dashboard` | Fleet risk overview and customer monitoring list |
| **Owner Customer View** | `http://localhost:5173/owner/customers/:id` | Dedicated fleet manager inspection per customer |
| **FastAPI Backend API** | `http://127.0.0.1:8000/docs` | Interactive Swagger API documentation |

---

## 5. Quick Start Guide

### 1. Environment Configuration

Copy the example template and create `.env` in `backend/`:

```powershell
cp .env.example backend/.env
```

Configure your environment variables in `backend/.env`:
```env
DATABASE_URL=sqlite:///./data/alerts.db
FRONTEND_URL=http://localhost:5173
DATASET_PATH=data/ev_battery_dataset.csv

# SMTP Email Alert Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_google_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_USE_TLS=true
ALERT_RECIPIENT_EMAIL=your_recipient_email@gmail.com

# Twilio Emergency Call Configuration (Optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Owner Portal Credentials
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD=your_owner_password
```

### 2. Start the Backend Server
```powershell
cd "backend"
.\venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Root: `http://127.0.0.1:8000`
- Swagger Docs: `http://127.0.0.1:8000/docs`

### 3. Start the Frontend Application
```powershell
cd "frontend"
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
- Web Application: `http://localhost:5173`

---

## 6. Running the Test Suite

Run the complete 68-test backend verification suite:

```powershell
cd "backend"
.\venv\Scripts\pytest.exe -v
```

### Test Coverage Summary
- **Sensor Validation & Boundary Checks**: Validates physical limits and 422 HTTP responses.
- **Random Forest ML Regression**: Validates temperature prediction accuracy.
- **Risk Assessment Formulas**: Tests LOW ($<40$), MEDIUM ($40-69$), and HIGH ($\ge 70$) risk classification.
- **Real-Time Dataset Streaming**: Validates stream state machine (start, pause, sequential stepping).
- **Email Alert Delivery**: Verifies live Gmail SMTP dispatch, recipient routing, and dynamic report content.
- **Emergency Escalation Worker**: Tests 60-second timeout escalation and unacknowledged incident triggers.
- **Simulated Contactor Disconnect**: Validates safety contactor trip during critical thermal scenarios.

---

## 7. Demonstration Scenarios

1. **Nominal Commute (LOW Risk)**:
   - Input: SOC `50%`, Voltage `395V`, Current `12A`, Temp `25°C`, Age `6 mo`, Cycles `100`.
   - Result: Predicted temp $\sim 28.5^\circ\text{C}$, Risk Score $< 30/100$, Risk Level `LOW`. Status: `● ACTIVE`, 0 alerts fired.

2. **Elevated Temperature Warning (MEDIUM Risk)**:
   - Input: SOC `82%`, Voltage `405V`, Current `35A`, Temp `40°C`, Age `18 mo`, Cycles `450`.
   - Result: Predicted temp $\sim 42.1^\circ\text{C}$, Risk Score `43.0/100`, Risk Level `MEDIUM`.
   - Status: **Email report automatically dispatched** to recipient with "WHY IS IT MEDIUM?" dynamic reasoning; contactor remains `CONNECTED`.

3. **Thermal Runaway Prevention (HIGH Risk)**:
   - Input: SOC `95%`, Voltage `420V`, Current `75A`, Temp `52°C`, Age `38 mo`, Cycles `900`.
   - Result: Predicted temp $> 65^\circ\text{C}$, Risk Score `100.0/100`, Risk Level `HIGH`.
   - Status: Contactor trips to `● SIMULATED DISCONNECT`. 60-second countdown timer starts. Acknowledging sends email report; timing out triggers automatic emergency escalation.
