import logging
from pathlib import Path
from typing import Dict, Optional, Union
import joblib
import numpy as np
import pandas as pd
from app.models.train import FEATURE_NAMES, MODEL_PATH, train_battery_temperature_model
from app.schemas.battery import BatteryInput, BatteryPredictionRequest, PredictionResult

logger = logging.getLogger("ev_twinguard.prediction_service")


class PredictionService:
    _instance: Optional["PredictionService"] = None
    _model = None

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or MODEL_PATH
        self._load_or_train_model()

    @classmethod
    def get_instance(cls) -> "PredictionService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_or_train_model(self):
        if self.model_path.exists():
            try:
                self._model = joblib.load(self.model_path)
                logger.info(f"Loaded existing trained model from {self.model_path}")
                return
            except Exception as e:
                logger.warning(f"Failed to load model from {self.model_path} ({e}). Retraining...")

        logger.info("Training fresh battery temperature model...")
        pipeline, _ = train_battery_temperature_model(save_path=self.model_path)
        self._model = pipeline

    def predict(self, telemetry: Union[BatteryPredictionRequest, BatteryInput, dict]) -> PredictionResult:
        """
        Runs ML model inference to predict future battery temperature from 7 physical parameters:
        SOC, Voltage, Charging Current, Current Temperature, Ambient Temperature, Battery Age, Charging Cycles.
        """
        if self._model is None:
            self._load_or_train_model()

        # Extract parameters supporting both objects and dicts
        if isinstance(telemetry, dict):
            soc = float(telemetry["soc"])
            voltage = float(telemetry["voltage"])
            charging_current = float(telemetry["charging_current"])
            current_temp = float(telemetry.get("current_temperature", telemetry.get("battery_temperature", 25.0)))
            ambient_temp = float(telemetry["ambient_temperature"])
            battery_age = float(telemetry["battery_age"])
            charging_cycles = int(telemetry["charging_cycles"])
        else:
            soc = telemetry.soc
            voltage = telemetry.voltage
            charging_current = telemetry.charging_current
            current_temp = getattr(telemetry, "current_temperature", None)
            if current_temp is None:
                current_temp = getattr(telemetry, "battery_temperature", 25.0)
            ambient_temp = telemetry.ambient_temperature
            battery_age = telemetry.battery_age
            charging_cycles = telemetry.charging_cycles

        input_df = pd.DataFrame([{
            "soc": soc,
            "voltage": voltage,
            "charging_current": charging_current,
            "current_temperature": current_temp,
            "ambient_temperature": ambient_temp,
            "battery_age": battery_age,
            "charging_cycles": charging_cycles,
        }])

        pred_val = float(self._model.predict(input_df)[0])
        pred_val = round(pred_val, 2)
        delta = round(pred_val - current_temp, 2)

        # Thermal condition categorization
        if pred_val > 52.0:
            thermal_status = "CRITICAL"
        elif pred_val > 42.0:
            thermal_status = "ELEVATED"
        else:
            thermal_status = "OPTIMAL"

        # Model confidence calculation
        confidence = 0.98
        if charging_current > 75.0:
            confidence -= 0.05
        if ambient_temp > 42.0 or ambient_temp < -5.0:
            confidence -= 0.05
        if abs(delta) > 15.0:
            confidence -= 0.08
        confidence = max(0.65, min(0.99, round(confidence, 2)))

        # Feature contribution estimation
        feat_weights = {
            "current_temperature": round(current_temp * 1.5, 1),
            "ambient_temperature": round(abs(ambient_temp) * 0.8, 1),
            "charging_current": round((charging_current ** 1.3) * 0.45, 1),
            "voltage_stress": round(max(0.0, (voltage - 360.0) * 0.15), 1),
            "cycle_wear": round(min(30.0, (charging_cycles / 150.0)), 1),
            "battery_age": round(min(20.0, battery_age * 0.4), 1),
            "soc_polarization": round(max(0.0, (soc - 75.0) * 0.3), 1),
        }
        total_w = sum(feat_weights.values()) or 1.0
        feature_contributions = {k: round((v / total_w) * 100.0, 1) for k, v in feat_weights.items()}

        return PredictionResult(
            predicted_future_temperature=pred_val,
            predicted_temperature=pred_val,
            current_temperature=current_temp,
            temperature_delta=delta,
            confidence_score=confidence,
            thermal_status=thermal_status,
            feature_contributions=feature_contributions,
        )


def get_prediction_service() -> PredictionService:
    return PredictionService.get_instance()
