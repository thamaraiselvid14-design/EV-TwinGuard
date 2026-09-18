# EV TwinGuard - Backend API

FastAPI-powered backend service for the EV TwinGuard AI Digital Twin platform.

## Architecture

```
backend/
│
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py         # Primary API endpoints and router definitions
│   │
│   ├── models/
│   │   └── __init__.py        # AI/ML model architectures & database models (future phases)
│   │
│   ├── services/
│   │   └── __init__.py        # Core business logic (prediction, alerts, simulation)
│   │
│   ├── schemas/
│   │   └── __init__.py        # Pydantic data schemas
│   │
│   ├── data/
│   │   └── .gitkeep           # Storage directory for battery datasets
│   │
│   ├── __init__.py
│   └── main.py                # FastAPI entrypoint, middleware, and CORS configuration
│
├── requirements.txt           # Python dependencies
├── .env.example               # Environment variable template
└── README.md
```

## Setup Instructions

### 1. Create Virtual Environment
```powershell
python -m venv venv
```

### 2. Activate Virtual Environment
```powershell
.\venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 4. Configure Environment
```powershell
Copy-Item .env.example .env
```

### 5. Run API Server
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Endpoints

- `GET /api/health` - Health check status endpoint:
  ```json
  {
    "status": "ok"
  }
  ```
- `POST /api/battery/manual-input` - Accepts and validates manual EV battery telemetry against `BatteryInput` schema:
  ```json
  {
    "battery_id": "EV001",
    "soc": 75.5,
    "voltage": 400.2,
    "charging_current": 18.0,
    "battery_temperature": 32.5,
    "ambient_temperature": 28.0,
    "battery_age": 18.0,
    "charging_cycles": 450
  }
  ```
- Interactive Swagger documentation: `http://127.0.0.1:8000/docs`

## Automated Tests

Run the test suite with `pytest`:
```powershell
.\venv\Scripts\pytest.exe -v
```

## Dataset Loader (1,000,000+ Records)

Located in `app/data/`:
- `loader.py`: Streaming chunk reader with automated cleaning and outlier rejection.
- `dataset_service.py`: High-level queries, sampling (`sample_records`), and battery ID lookups.
- Place user CSV files at `data/ev_battery_dataset.csv` or configure `DATASET_PATH` in `.env`.
