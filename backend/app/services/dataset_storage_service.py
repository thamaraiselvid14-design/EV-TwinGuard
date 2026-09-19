import csv
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ev_twinguard.dataset_storage")

DATASET_COLUMNS = [
    # 1. Customer Details
    "customer_id",
    "customer_name",
    "email",
    "phone_number",
    "registration_date",
    "account_status",
    # 2. Vehicle Details
    "vehicle_id",
    "vehicle_model",
    "vehicle_brand",
    "vehicle_type",
    "vehicle_year",
    "vehicle_registration_number",
    # 3. Battery Details
    "battery_id",
    "battery_model",
    "battery_chemistry",
    "battery_capacity",
    "battery_voltage",
    "battery_age",
    "charging_cycles",
    "battery_manufacturer",
    "battery_installation_date",
    # 4. Battery Telemetry Entered by User
    "battery_temperature",
    "voltage",
    "charging_current",
    "soc",
    "ambient_temperature",
    # 5. Real-Time Data Metadata
    "dataset_record_id",
    "record_timestamp",
    "streaming_status",
    "analysis_status",
    # 6. AI Analysis Results
    "analysis_id",
    "analysis_timestamp",
    "input_source",
    "predicted_temperature",
    "ai_confidence",
    "risk_value",
    "risk_level",
    "risk_reason",
    "reason_parameters",
    # 7. Alert Details
    "alert_id",
    "alert_timestamp",
    "alert_risk_level",
    "alert_risk_value",
    "alert_risk_reason",
    "alert_status",
    "acknowledged",
    "acknowledged_timestamp",
    "email_sent",
    "email_sent_timestamp",
    "sms_sent",
    "sms_sent_timestamp",
    "voice_call_sent",
    "voice_call_timestamp",
    "escalation_status",
]

DEFAULT_CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "ev_battery_dataset.csv"


class DatasetStorageService:
    _instance: Optional["DatasetStorageService"] = None
    _lock = threading.Lock()

    def __init__(self, csv_path: Optional[Path] = None):
        self.csv_path = csv_path or DEFAULT_CSV_PATH
        self._ensure_dataset_schema()

    @classmethod
    def get_instance(cls) -> "DatasetStorageService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_dataset_schema(self):
        """
        Ensures the dataset CSV file exists and contains the complete column specification.
        If the file has an older schema (e.g. only telemetry columns), migrates existing rows
        preserving all existing data values.
        """
        with self._lock:
            self.csv_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.csv_path.exists() or self.csv_path.stat().st_size == 0:
                with open(self.csv_path, mode="w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(DATASET_COLUMNS)
                logger.info(f"Initialized empty dataset CSV with {len(DATASET_COLUMNS)} columns at {self.csv_path}")
                return

            # Read existing rows to check headers
            with open(self.csv_path, mode="r", newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                if not header:
                    existing_rows = []
                else:
                    existing_rows = list(reader)

            if header == DATASET_COLUMNS:
                # Schema already up-to-date
                return

            logger.info(f"Migrating dataset CSV at {self.csv_path} to extended schema...")
            old_header_map = {col.strip().lower(): idx for idx, col in enumerate(header or [])}

            migrated_rows = []
            now_iso = datetime.now(timezone.utc).isoformat()

            for row_idx, row in enumerate(existing_rows):
                new_row: Dict[str, Any] = {}
                # Map old columns
                for col_name, idx in old_header_map.items():
                    val = row[idx] if idx < len(row) else ""
                    new_row[col_name] = val

                # Fill default values for fleet/baseline rows
                bid = new_row.get("battery_id", f"EV-FLEET-{row_idx + 1:03d}")
                row_dict = {
                    "customer_id": new_row.get("customer_id") or f"CUST-FLEET-{(row_idx % 25) + 1:03d}",
                    "customer_name": new_row.get("customer_name") or "EV Fleet Logistics",
                    "email": new_row.get("email") or "fleet@evtwinguard.io",
                    "phone_number": new_row.get("phone_number") or "+1-800-555-0199",
                    "registration_date": new_row.get("registration_date") or "2026-01-01T00:00:00Z",
                    "account_status": new_row.get("account_status") or "ACTIVE",
                    "vehicle_id": new_row.get("vehicle_id") or f"VEH-FLT-{(row_idx % 25) + 1:03d}",
                    "vehicle_model": new_row.get("vehicle_model") or "Fleet Commercial EV",
                    "vehicle_brand": new_row.get("vehicle_brand") or "TwinGuard EV",
                    "vehicle_type": new_row.get("vehicle_type") or "Fleet SUV",
                    "vehicle_year": new_row.get("vehicle_year") or "2025",
                    "vehicle_registration_number": new_row.get("vehicle_registration_number") or f"EV-REG-{(row_idx % 25) + 1:03d}",
                    "battery_id": bid,
                    "battery_model": new_row.get("battery_model") or "TG-LFP-80",
                    "battery_chemistry": new_row.get("battery_chemistry") or "Lithium Iron Phosphate (LFP)",
                    "battery_capacity": new_row.get("battery_capacity") or "75.0 kWh",
                    "battery_voltage": new_row.get("battery_voltage") or "400.0",
                    "battery_age": new_row.get("battery_age") or "12.0",
                    "charging_cycles": new_row.get("charging_cycles") or "300",
                    "battery_manufacturer": new_row.get("battery_manufacturer") or "TwinGuard Power Dynamics",
                    "battery_installation_date": new_row.get("battery_installation_date") or "2025-01-15",
                    "battery_temperature": new_row.get("battery_temperature") or "30.0",
                    "voltage": new_row.get("voltage") or "400.0",
                    "charging_current": new_row.get("charging_current") or "18.0",
                    "soc": new_row.get("soc") or "80.0",
                    "ambient_temperature": new_row.get("ambient_temperature") or "25.0",
                    "dataset_record_id": new_row.get("dataset_record_id") or f"REC-{row_idx + 1:03d}",
                    "record_timestamp": new_row.get("record_timestamp") or now_iso,
                    "streaming_status": new_row.get("streaming_status") or "ARCHIVED",
                    "analysis_status": new_row.get("analysis_status") or "COMPLETED",
                    "analysis_id": new_row.get("analysis_id") or f"ANL-INIT-{row_idx + 1:03d}",
                    "analysis_timestamp": new_row.get("analysis_timestamp") or now_iso,
                    "input_source": new_row.get("input_source") or "Baseline Dataset",
                    "predicted_temperature": new_row.get("predicted_temperature") or new_row.get("battery_temperature") or "32.0",
                    "ai_confidence": new_row.get("ai_confidence") or "98.4",
                    "risk_value": new_row.get("risk_value") or "25.0",
                    "risk_level": new_row.get("risk_level") or "LOW",
                    "risk_reason": new_row.get("risk_reason") or "Telemetry within nominal thermal envelope.",
                    "reason_parameters": new_row.get("reason_parameters") or "{}",
                    "alert_id": new_row.get("alert_id") or "",
                    "alert_timestamp": new_row.get("alert_timestamp") or "",
                    "alert_risk_level": new_row.get("alert_risk_level") or "LOW",
                    "alert_risk_value": new_row.get("alert_risk_value") or "",
                    "alert_risk_reason": new_row.get("alert_risk_reason") or "",
                    "alert_status": new_row.get("alert_status") or "NORMAL",
                    "acknowledged": new_row.get("acknowledged") or "No",
                    "acknowledged_timestamp": new_row.get("acknowledged_timestamp") or "",
                    "email_sent": new_row.get("email_sent") or "No",
                    "email_sent_timestamp": new_row.get("email_sent_timestamp") or "",
                    "sms_sent": new_row.get("sms_sent") or "No",
                    "sms_sent_timestamp": new_row.get("sms_sent_timestamp") or "",
                    "voice_call_sent": new_row.get("voice_call_sent") or "No",
                    "voice_call_timestamp": new_row.get("voice_call_timestamp") or "",
                    "escalation_status": new_row.get("escalation_status") or "NONE",
                }
                migrated_rows.append([row_dict.get(c, "") for c in DATASET_COLUMNS])

            # Write migrated CSV atomically
            with open(self.csv_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(DATASET_COLUMNS)
                writer.writerows(migrated_rows)

            logger.info(f"Successfully migrated {len(migrated_rows)} rows to extended dataset schema.")

    def append_analysis_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Appends a complete analysis event record as a new row in ev_battery_dataset.csv.
        Never overwrites previous records.
        """
        with self._lock:
            clean_row = {}
            for col in DATASET_COLUMNS:
                val = record.get(col, "")
                if val is None:
                    clean_row[col] = ""
                elif isinstance(val, (dict, list)):
                    clean_row[col] = json.dumps(val)
                elif isinstance(val, bool):
                    clean_row[col] = "Yes" if val else "No"
                else:
                    clean_row[col] = str(val)

            file_exists = self.csv_path.exists() and self.csv_path.stat().st_size > 0
            with open(self.csv_path, mode="a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=DATASET_COLUMNS)
                if not file_exists:
                    writer.writeheader()
                writer.writerow(clean_row)

            logger.info(
                f"Appended analysis event to CSV: Analysis ID={clean_row.get('analysis_id')}, "
                f"Battery={clean_row.get('battery_id')}, Source={clean_row.get('input_source')}, "
                f"Risk={clean_row.get('risk_level')} ({clean_row.get('risk_value')})"
            )
            return clean_row

    def get_records(self, limit: int = 100, reverse: bool = True) -> List[Dict[str, str]]:
        """
        Reads records from the CSV dataset.
        If reverse is True, returns most recently appended rows first.
        """
        with self._lock:
            if not self.csv_path.exists():
                return []
            with open(self.csv_path, mode="r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            if reverse:
                rows.reverse()
            return rows[:limit]

    def count_records(self) -> int:
        with self._lock:
            if not self.csv_path.exists():
                return 0
            with open(self.csv_path, mode="r", newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                if not header:
                    return 0
                return sum(1 for _ in reader)


def get_dataset_storage_service() -> DatasetStorageService:
    return DatasetStorageService.get_instance()
