# EV Battery Real-World Dataset Guide

Place your real-world EV battery CSV dataset in this directory (or configure any custom path via the `DATASET_PATH` environment variable).

## Default File Location
`backend/data/ev_battery_dataset.csv`

Configure via `.env`:
```env
DATASET_PATH=data/ev_battery_dataset.csv
```

## Supported Columns & Canonical Mapping

The dataset loader supports 1,000,000+ rows through streaming chunked processing (`pd.read_csv(..., chunksize=50000)`).
The loader automatically maps common column name variations to canonical fields and **preserves all extra metadata or sensor columns**.

| Canonical Field | Type | Expected Unit | Recognized Aliases (Case-Insensitive) |
| :--- | :--- | :--- | :--- |
| `battery_id` | `str` | Text ID | `Battery_ID`, `batteryId`, `pack_id`, `cell_id`, `id` |
| `soc` | `float` | Percentage (`0 - 100%`) | `SOC`, `state_of_charge`, `state_of_charge_%`, `soc_%` |
| `voltage` | `float` | Volts (`V > 0`) | `Voltage`, `pack_voltage`, `voltage_v`, `volts` |
| `charging_current` | `float` | Amperes (`A >= 0`) | `Current`, `charging_current_a`, `charge_current`, `current_a` |
| `battery_temperature` | `float` | °C (`-50 to 120°C`) | `Battery_Temperature`, `temperature`, `temp`, `battery_temp`, `cell_temperature` |
| `ambient_temperature` | `float` | °C (`-50 to 70°C`) | `Ambient_Temperature`, `ambient_temp`, `amb_temp`, `environment_temp` |
| `battery_age` | `float` | Months (`>= 0`) | `battery_age`, `age`, `age_months`, `battery_age_months` |
| `charging_cycles` | `int` | Count (`>= 0`) | `Charging_Cycles`, `cycles`, `cycle_count`, `total_cycles` |

*Any additional sensor readings or telemetry channels (e.g. `coolant_flow_rate`, `internal_resistance`, `cell_voltages`) will be retained unchanged.*

## Automated Data Cleaning Rules
1. **Missing Identifiers**: Rows without a valid `battery_id` are discarded.
2. **Missing / Corrupted Measurements**: Non-numeric or NaN values in required battery parameters are dropped safely.
3. **Outliers**: Physically impossible states (e.g. SOC < 0 or > 100, negative cycles, negative age, non-positive voltage) are filtered out.
4. **Duplicate Records**: Exact duplicate telemetry entries are removed while preserving multi-timestamp readings for the same battery pack.

## Python Usage
```python
from app.data import DatasetService, load_dataset, sample_records, get_records_by_battery_id, query_records

service = DatasetService("data/ev_battery_dataset.csv", chunk_size=50000)

# Sample 10 clean records
sample = service.sample_records(n=10)

# Query records for a specific battery ID
records = service.get_records_by_battery_id("EV-PACK-001")

# Query with parametric filters
filtered = service.query_records(filters={"min_soc": 20.0, "max_soc": 80.0, "min_temp": 15.0})
```
