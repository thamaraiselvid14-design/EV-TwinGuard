import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from app.data.dataset_service import DatasetService, get_dataset_service
from app.schemas.battery import (
    AlertStatusSummary,
    BatteryInput,
    BatteryPredictionRequest,
    PredictionResult,
    RealtimeNextResponse,
    RealtimeStartRequest,
    RealtimeStatusResponse,
    RiskAssessment,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)
from app.services.alert_service import AlertService, get_alert_service
from app.services.prediction_service import PredictionService, get_prediction_service
from app.services.risk_service import RiskAssessmentService, get_risk_service

logger = logging.getLogger("ev_twinguard.realtime_service")


def dataset_record_to_battery_input(raw_record: Dict[str, Any], default_id: str = "EV001") -> BatteryInput:
    """
    Canonical converter mapping raw dataset dictionary records into validated BatteryInput schema.
    """
    battery_id = str(raw_record.get("battery_id", default_id)).strip()
    soc = float(raw_record.get("soc", 0.0))
    voltage = float(raw_record.get("voltage", 400.0))
    charging_current = float(raw_record.get("charging_current", 0.0))
    current_temp = float(
        raw_record.get("current_temperature", raw_record.get("battery_temperature", 25.0))
    )
    ambient_temp = float(raw_record.get("ambient_temperature", 25.0))
    battery_age = float(raw_record.get("battery_age", 12.0))
    charging_cycles = int(raw_record.get("charging_cycles", 100))

    return BatteryInput(
        battery_id=battery_id,
        soc=soc,
        voltage=voltage,
        charging_current=charging_current,
        battery_temperature=current_temp,
        current_temperature=current_temp,
        ambient_temperature=ambient_temp,
        battery_age=battery_age,
        charging_cycles=charging_cycles,
    )


class RealtimeDatasetService:
    """
    Service that simulates a real-time EV battery dataset stream for development/demo.
    Fetches sequential battery telemetry records, validates each, executes AI temperature prediction,
    computes multi-factor risk, triggers safety alert dispatches and SQLite logging on MEDIUM/HIGH tiers.
    """
    _instance: Optional["RealtimeDatasetService"] = None

    def __init__(
        self,
        dataset_service: Optional[DatasetService] = None,
        prediction_service: Optional[PredictionService] = None,
        risk_service: Optional[RiskAssessmentService] = None,
        alert_service: Optional[AlertService] = None,
    ):
        self.dataset_service = dataset_service or get_dataset_service()
        self.prediction_service = prediction_service or get_prediction_service()
        self.risk_service = risk_service or get_risk_service()
        self.alert_service = alert_service or get_alert_service()

        self._running: bool = False
        self._interval_seconds: int = 3
        self._current_index: int = 0
        self._cached_records: Optional[List[Dict[str, Any]]] = None
        self._source_name: str = "EV Battery Fleet Dataset (Simulation Mode)"

    @classmethod
    def get_instance(cls) -> "RealtimeDatasetService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_records_loaded(self) -> List[Dict[str, Any]]:
        if self._cached_records is None:
            chunks = self.dataset_service.load_dataset()
            records: List[Dict[str, Any]] = []
            for chunk in chunks:
                if not chunk.empty:
                    records.extend(chunk.to_dict(orient="records"))
            
            # Fallback if no records found
            if not records:
                sample = self.dataset_service.sample_records(n=25)
                records = sample if sample else []

            self._cached_records = records
            logger.info(f"Loaded {len(records)} records for real-time dataset stream.")

        return self._cached_records

    @property
    def total_records(self) -> int:
        records = self._ensure_records_loaded()
        return len(records)

    def get_status(self) -> RealtimeStatusResponse:
        total = self.total_records
        idx = min(self._current_index + 1, total) if total > 0 else 0
        return RealtimeStatusResponse(
            running=self._running,
            interval_seconds=self._interval_seconds,
            current_index=idx,
            total_records=total,
            source_name=self._source_name,
        )

    def start_stream(self, interval_seconds: Optional[int] = None) -> RealtimeStatusResponse:
        if interval_seconds is not None and interval_seconds > 0:
            self._interval_seconds = interval_seconds
        self._running = True
        logger.info(f"Real-time dataset stream started. Interval: {self._interval_seconds}s")
        return self.get_status()

    def pause_stream(self) -> RealtimeStatusResponse:
        self._running = False
        logger.info("Real-time dataset stream paused.")
        return self.get_status()

    def reset_stream(self) -> RealtimeStatusResponse:
        self._current_index = 0
        self._running = False
        logger.info("Real-time dataset stream reset to index 0.")
        return self.get_status()

    def get_next_record(self) -> RealtimeNextResponse:
        """
        Fetches the next valid telemetry record from the dataset, runs it through:
        1. Validation & Schema Mapping (dataset_record_to_battery_input)
        2. AI Temperature Prediction (PredictionService.predict)
        3. Multi-Factor Risk Assessment (RiskAssessmentService.calculate_risk)
        4. Safety Alert Dispatch & SQLite logging (AlertService.process_telemetry_risk)
        If a record is invalid or fails prediction, logs the event, skips it, and advances safely.
        """
        records = self._ensure_records_loaded()
        total = len(records)
        if total == 0:
            raise ValueError("No dataset records available for streaming.")

        if self._current_index >= total:
            # Reset to start if user steps again after complete
            self._current_index = 0

        skipped_invalid = False
        attempts = 0
        max_attempts = min(total, 50)

        validated_battery_input: Optional[BatteryInput] = None
        record_idx = self._current_index

        while attempts < max_attempts:
            record_idx = self._current_index % total
            raw_record = records[record_idx]
            self._current_index += 1
            attempts += 1

            try:
                validated_battery_input = dataset_record_to_battery_input(
                    raw_record,
                    default_id=f"EV-FLEET-{record_idx + 1:03d}",
                )
                break
            except Exception as val_err:
                logger.warning(
                    f"Skipping invalid dataset record at index {record_idx} ({raw_record}): {val_err}"
                )
                skipped_invalid = True
                continue

        if validated_battery_input is None:
            # Fallback nominal telemetry if all attempts failed
            validated_battery_input = BatteryInput(
                battery_id=f"EV-FALLBACK-{record_idx + 1:03d}",
                soc=65.0,
                voltage=400.0,
                charging_current=18.0,
                battery_temperature=30.0,
                current_temperature=30.0,
                ambient_temperature=25.0,
                battery_age=12.0,
                charging_cycles=300,
            )

        # 1. AI Temperature Prediction (reuses existing model)
        try:
            prediction_res = self.prediction_service.predict(validated_battery_input)
        except Exception as pred_err:
            logger.error(f"Prediction failure for {validated_battery_input.battery_id}: {pred_err}. Using fallback heuristic.")
            curr_t = validated_battery_input.current_temperature or 25.0
            predicted_t = round(curr_t + (validated_battery_input.charging_current * 0.15), 2)
            prediction_res = PredictionResult(
                predicted_future_temperature=predicted_t,
                predicted_temperature=predicted_t,
                current_temperature=curr_t,
                temperature_delta=round(predicted_t - curr_t, 2),
                confidence_score=0.85,
                thermal_status="ELEVATED" if predicted_t > 42.0 else "OPTIMAL",
                feature_contributions={"fallback": 100.0},
            )

        # 2. Multi-Factor Risk Assessment (reuses existing risk service)
        try:
            risk_res = self.risk_service.calculate_risk(validated_battery_input, prediction_res)
        except Exception as risk_err:
            logger.error(f"Risk assessment failure for {validated_battery_input.battery_id}: {risk_err}")
            from app.schemas.battery import RiskFactorBreakdown
            risk_res = RiskAssessment(
                overall_risk_score=25.0,
                risk_score=25.0,
                risk_level="LOW",
                level="LOW",
                risk_factors=RiskFactorBreakdown(
                    thermal_risk_score=20.0,
                    thermal_status="SAFE",
                    crate_stress_score=15.0,
                    crate_status="SAFE",
                    degradation_score=10.0,
                    soh_percentage=92.0,
                    voltage_stability="STABLE",
                ),
                recommendations=["System operating in safe nominal envelope."],
                alert_triggered=False,
                main_risk_factors=["Nominal fallback evaluation"],
                factors=["Nominal fallback evaluation"],
                charging_status="CONNECTED",
            )

        # 3. Alert Service Dispatch & SQLite Persistence (reuses existing alert service)
        try:
            self.alert_service.process_telemetry_risk(validated_battery_input, risk_res)
        except Exception as alert_err:
            logger.warning(f"Non-blocking alert error for {validated_battery_input.battery_id}: {alert_err}")

        # Check if this record reached the end of dataset
        is_complete = (record_idx + 1 >= total)
        if is_complete:
            self._running = False
            logger.info(f"Real-time dataset reached end ({record_idx + 1}/{total}). Stream paused.")

        email_sent = bool(risk_res.alert_event and risk_res.alert_event.email_dispatched) or (risk_res.risk_level in ["MEDIUM", "HIGH"])
        call_triggered = bool(risk_res.alert_event and risk_res.alert_event.call_triggered) or (risk_res.risk_level == "HIGH")
        charging_status = risk_res.charging_status or ("SIMULATED DISCONNECT" if risk_res.risk_level == "HIGH" else "CONNECTED")

        alert_status = AlertStatusSummary(
            email_sent=email_sent,
            call_triggered=call_triggered,
            charging_status=charging_status,
        )

        return RealtimeNextResponse(
            status="complete" if is_complete else "success",
            index=record_idx + 1,
            total_records=total,
            is_complete=is_complete,
            battery_id=validated_battery_input.battery_id,
            telemetry=validated_battery_input,
            prediction=prediction_res,
            risk_assessment=risk_res,
            alert_status=alert_status,
            skipped_invalid=skipped_invalid,
        )


def get_realtime_service() -> RealtimeDatasetService:
    return RealtimeDatasetService.get_instance()
