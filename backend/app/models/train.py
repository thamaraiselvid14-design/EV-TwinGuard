import logging
import os
from pathlib import Path
from typing import Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("ev_twinguard.model_training")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

MODEL_PATH = Path(__file__).resolve().parent / "battery_temp_model.joblib"
FEATURE_NAMES = [
    "soc",
    "voltage",
    "charging_current",
    "current_temperature",
    "ambient_temperature",
    "battery_age",
    "charging_cycles",
]
TARGET_NAME = "future_battery_temperature"


def generate_synthetic_battery_telemetry(n_samples: int = 15000, random_state: int = 42) -> pd.DataFrame:
    """
    Generates realistic electro-thermal battery physics telemetry for future temperature forecasting.
    Grounded in electro-chemical principles:
    - Internal Joule heating: P = I^2 * R
    - Internal resistance increases with battery age and charging cycles.
    - Higher ambient temperature shifts thermal dissipation balance.
    - High SOC combined with high charging current accelerates polarization heat.
    - Calculates future temperature progression from current battery temperature.
    """
    np.random.seed(random_state)

    soc = np.random.uniform(5.0, 98.0, n_samples)
    voltage = np.random.uniform(340.0, 420.0, n_samples)
    charging_current = np.random.exponential(scale=20.0, size=n_samples)
    charging_current = np.clip(charging_current, 0.0, 100.0)

    ambient_temp = np.random.normal(loc=25.0, scale=8.0, size=n_samples)
    ambient_temp = np.clip(ambient_temp, -15.0, 48.0)

    battery_age = np.random.uniform(0.5, 48.0, n_samples)  # months
    charging_cycles = (battery_age * np.random.uniform(15.0, 30.0, n_samples) + np.random.normal(0, 20, n_samples))
    charging_cycles = np.clip(charging_cycles, 0, 2500)

    # Effective internal resistance R (Ohms) increases with degradation
    internal_resistance = 0.028 + (battery_age / 120.0) * 0.035 + (charging_cycles / 2000.0) * 0.045

    # Current battery temperature (starting baseline)
    current_temp = ambient_temp + (charging_current * 0.15) + np.random.normal(2.0, 3.0, n_samples)
    current_temp = np.clip(current_temp, -10.0, 70.0)

    # Joule heat dissipated (Watts): I^2 * R
    joule_heat = (charging_current ** 2) * internal_resistance

    # Additional polarization heat at high SOC (> 80%)
    polarization_factor = np.where(soc > 80.0, (soc - 80.0) * 0.25, 0.0)
    total_heat = (joule_heat * 0.035) + (polarization_factor * charging_current * 0.03)

    # Ambient cooling / dissipation delta
    dissipation = (current_temp - ambient_temp) * 0.08
    voltage_factor = (voltage - 360.0) * 0.02

    # Future temperature delta over forward horizon (e.g. +15 min continuous charging/operation)
    future_temp = current_temp + total_heat - dissipation + voltage_factor + np.random.normal(0, 0.5, n_samples)
    future_temp = np.clip(future_temp, -10.0, 95.0)

    df = pd.DataFrame({
        "battery_id": [f"EV-SYN-{i:05d}" for i in range(n_samples)],
        "soc": np.round(soc, 2),
        "voltage": np.round(voltage, 2),
        "charging_current": np.round(charging_current, 2),
        "current_temperature": np.round(current_temp, 2),
        "ambient_temperature": np.round(ambient_temp, 2),
        "battery_age": np.round(battery_age, 1),
        "charging_cycles": np.round(charging_cycles).astype(int),
        "future_battery_temperature": np.round(future_temp, 2),
    })
    return df


def train_battery_temperature_model(
    dataset_path: Path | str | None = None,
    save_path: Path | str | None = None,
) -> Tuple[Pipeline, dict]:
    """
    Trains a Scikit-learn Pipeline for battery future temperature prediction.
    Strictly follows ML Best Practices:
    - Splits training and testing sets (80/20) BEFORE fitting any preprocessing/scalers.
    - Fits StandardScaler and RandomForestRegressor within a unified Pipeline.
    - Evaluates on an independent holdout test set with MAE, RMSE, and R2.
    - Logs and prints evaluation metrics.
    - Serializes pipeline to disk using Joblib.
    """
    output_path = Path(save_path) if save_path else MODEL_PATH

    # 1. Load data
    data = None
    if dataset_path and Path(dataset_path).exists():
        try:
            logger.info(f"Loading dataset from provided path: {dataset_path}")
            df = pd.read_csv(dataset_path)
            # Map canonical column variants
            if "battery_temperature" in df.columns and "current_temperature" not in df.columns:
                df["current_temperature"] = df["battery_temperature"]
            if all(col in df.columns for col in FEATURE_NAMES + [TARGET_NAME]):
                data = df[FEATURE_NAMES + [TARGET_NAME]].dropna()
                logger.info(f"Loaded {len(data)} records from {dataset_path}")
        except Exception as e:
            logger.warning(f"Could not load custom dataset ({e}). Generating calibrated physics dataset.")

    if data is None or len(data) < 500:
        logger.info("Generating calibrated physics baseline battery dataset (15,000 samples)...")
        data = generate_synthetic_battery_telemetry(n_samples=15000)

    X = data[FEATURE_NAMES]
    y = data[TARGET_NAME]

    # 2. Featurization ordering: Train / Test Split BEFORE fitting scaler
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    logger.info(f"Dataset split: {len(X_train)} training samples, {len(X_test)} testing samples.")

    # 3. Pipeline creation: StandardScaler + RandomForestRegressor
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RandomForestRegressor(
            n_estimators=100,
            max_depth=16,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )),
    ])

    # 4. Fit pipeline strictly on training data
    logger.info("Fitting Random Forest Regression pipeline on training set...")
    pipeline.fit(X_train, y_train)

    # 5. Evaluate on holdout test set
    y_pred = pipeline.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    metrics = {
        "test_mae": round(mae, 4),
        "test_rmse": round(rmse, 4),
        "test_r2": round(r2, 4),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
    }

    print("\n" + "=" * 50)
    print("EV TWINGUARD: BATTERY TEMPERATURE REGRESSION EVALUATION")
    print("=" * 50)
    print(f"Features: {FEATURE_NAMES}")
    print(f"Target:   {TARGET_NAME}")
    print(f"Holdout Samples: {len(X_test)}")
    print(f"Mean Absolute Error (MAE):    {mae:.4f} °C")
    print(f"Root Mean Squared Error (RMSE): {rmse:.4f} °C")
    print(f"R-squared (R² Score):          {r2:.4f}")
    print("=" * 50 + "\n")

    logger.info(f"Model Evaluation: Test MAE={mae:.4f}°C, RMSE={rmse:.4f}°C, R²={r2:.4f}")

    # 6. Save model pipeline using Joblib
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, output_path)
    logger.info(f"Model successfully saved to {output_path}")

    return pipeline, metrics


if __name__ == "__main__":
    train_battery_temperature_model()
