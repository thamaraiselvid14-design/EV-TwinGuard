import logging
import os
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Set, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger("ev_twinguard.data_loader")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Canonical fields required by BatteryInput schema
CANONICAL_COLUMNS: Set[str] = {
    "battery_id",
    "soc",
    "voltage",
    "charging_current",
    "battery_temperature",
    "ambient_temperature",
    "battery_age",
    "charging_cycles",
}

# Configurable alias mappings (case-insensitive)
DEFAULT_COLUMN_ALIASES: Dict[str, str] = {
    # battery_id variants
    "battery_id": "battery_id",
    "batteryid": "battery_id",
    "battery_number": "battery_id",
    "pack_id": "battery_id",
    "cell_id": "battery_id",
    "id": "battery_id",
    # soc variants
    "soc": "soc",
    "state_of_charge": "soc",
    "state_of_charge_%": "soc",
    "soc_%": "soc",
    "soc_percent": "soc",
    # voltage variants
    "voltage": "voltage",
    "voltage_v": "voltage",
    "pack_voltage": "voltage",
    "volts": "voltage",
    "cell_voltage": "voltage",
    # charging_current variants
    "charging_current": "charging_current",
    "charging_current_a": "charging_current",
    "current": "charging_current",
    "current_a": "charging_current",
    "charge_current": "charging_current",
    # battery_temperature variants
    "battery_temperature": "battery_temperature",
    "battery_temp": "battery_temperature",
    "batt_temp": "battery_temperature",
    "cell_temperature": "battery_temperature",
    "cell_temp": "battery_temperature",
    "temperature": "battery_temperature",
    "temp": "battery_temperature",
    # ambient_temperature variants
    "ambient_temperature": "ambient_temperature",
    "ambient_temp": "ambient_temperature",
    "amb_temp": "ambient_temperature",
    "environment_temperature": "ambient_temperature",
    "env_temp": "ambient_temperature",
    # battery_age variants
    "battery_age": "battery_age",
    "battery_age_months": "battery_age",
    "age": "battery_age",
    "age_months": "battery_age",
    # charging_cycles variants
    "charging_cycles": "charging_cycles",
    "charge_cycles": "charging_cycles",
    "cycles": "charging_cycles",
    "cycle_count": "charging_cycles",
    "total_cycles": "charging_cycles",
}

# Physical boundary constraints for validation & cleaning
PHYSICAL_BOUNDS = {
    "soc": (0.0, 100.0),
    "voltage": (0.001, 1500.0),  # strictly > 0, up to high-voltage EV max
    "charging_current": (0.0, 1000.0),  # non-negative charging current
    "battery_temperature": (-50.0, 120.0),
    "ambient_temperature": (-50.0, 70.0),
    "battery_age": (0.0, 360.0),  # up to 30 years in months
    "charging_cycles": (0, 100000),
}


class DatasetLoader:
    """
    High-performance, chunk-based CSV dataset loader and cleaning pipeline
    designed for 1,000,000+ EV battery telemetry records.
    """

    def __init__(
        self,
        custom_aliases: Optional[Dict[str, str]] = None,
        chunk_size: int = 50000,
    ):
        """
        Initialize the loader with optional alias overrides and chunk size.
        """
        self.chunk_size = chunk_size
        self.column_aliases = dict(DEFAULT_COLUMN_ALIASES)
        if custom_aliases:
            for k, v in custom_aliases.items():
                self.column_aliases[k.strip().lower()] = v

    def resolve_columns(self, raw_columns: List[str]) -> Tuple[Dict[str, str], Set[str]]:
        """
        Map dataset columns to canonical names while preserving unknown extra columns.
        Returns:
            rename_map: dict of {raw_column_name: canonical_or_raw_name}
            missing_canonicals: set of canonical columns that could not be mapped
        """
        rename_map: Dict[str, str] = {}
        mapped_canonicals: Set[str] = set()

        for col in raw_columns:
            normalized = col.strip().lower()
            if normalized in self.column_aliases:
                canonical = self.column_aliases[normalized]
                rename_map[col] = canonical
                mapped_canonicals.add(canonical)
            else:
                # Preserve unknown extra columns as-is
                rename_map[col] = col

        missing_canonicals = CANONICAL_COLUMNS - mapped_canonicals
        return rename_map, missing_canonicals

    def clean_chunk(self, chunk: pd.DataFrame, rename_map: Dict[str, str]) -> Tuple[pd.DataFrame, dict]:
        """
        Clean an individual DataFrame chunk:
        1. Apply column renaming (preserving extra columns).
        2. Clean battery_id (drop missing or empty strings).
        3. Convert numeric types safely.
        4. Drop rows with NaN in required canonical fields.
        5. Filter out physically impossible outliers.
        6. Drop duplicate rows.
        """
        initial_count = len(chunk)
        stats = {
            "initial_rows": initial_count,
            "dropped_missing_id": 0,
            "dropped_type_errors": 0,
            "dropped_outliers": 0,
            "dropped_duplicates": 0,
            "cleaned_rows": 0,
        }

        # 1. Rename columns
        df = chunk.rename(columns=rename_map).copy()

        # 2. Battery ID validation
        if "battery_id" in df.columns:
            df["battery_id"] = df["battery_id"].astype(str).str.strip()
            # Mark invalid IDs ('', 'nan', 'none', 'null')
            invalid_id_mask = (
                df["battery_id"].isna()
                | (df["battery_id"] == "")
                | (df["battery_id"].str.lower().isin(["nan", "none", "null"]))
            )
            stats["dropped_missing_id"] = int(invalid_id_mask.sum())
            df = df[~invalid_id_mask]
        else:
            return pd.DataFrame(), stats

        # 3. Numeric conversion and NaN handling for canonical numeric fields
        numeric_fields = [
            "soc",
            "voltage",
            "charging_current",
            "battery_temperature",
            "ambient_temperature",
            "battery_age",
            "charging_cycles",
        ]

        for field in numeric_fields:
            if field in df.columns:
                df[field] = pd.to_numeric(df[field], errors="coerce")

        before_nan = len(df)
        df = df.dropna(subset=[f for f in numeric_fields if f in df.columns])
        stats["dropped_type_errors"] = before_nan - len(df)

        # 4. Outlier Filtering (Physical Feasibility Check)
        before_outliers = len(df)
        valid_mask = pd.Series(True, index=df.index)

        for field, (min_val, max_val) in PHYSICAL_BOUNDS.items():
            if field in df.columns:
                valid_mask = valid_mask & (df[field] >= min_val) & (df[field] <= max_val)

        stats["dropped_outliers"] = int((~valid_mask).sum())
        df = df[valid_mask]

        # 5. Type casting integer fields
        if "charging_cycles" in df.columns:
            df["charging_cycles"] = df["charging_cycles"].astype(int)

        # 6. Duplicate record removal
        before_dup = len(df)
        df = df.drop_duplicates()
        stats["dropped_duplicates"] = before_dup - len(df)

        stats["cleaned_rows"] = len(df)
        return df, stats

    def stream_cleaned_chunks(
        self,
        file_path: str,
        chunk_size: Optional[int] = None,
    ) -> Iterator[Tuple[pd.DataFrame, dict]]:
        """
        Generates cleaned chunks from the CSV file without loading entire file in memory.
        """
        c_size = chunk_size or self.chunk_size
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Dataset file not found at: {file_path}")

        logger.info(f"Opening dataset stream: {file_path} (Chunk size: {c_size})")

        # Read only header first to inspect and validate column mappings
        header_sample = pd.read_csv(file_path, nrows=0)
        rename_map, missing_canonicals = self.resolve_columns(header_sample.columns.tolist())

        if missing_canonicals:
            raise ValueError(
                f"CSV dataset is missing required canonical battery columns: {sorted(list(missing_canonicals))}. "
                f"Available mapped columns: {list(rename_map.values())}"
            )

        chunk_idx = 0
        total_cleaned = 0
        total_dropped = 0

        for chunk in pd.read_csv(file_path, chunksize=c_size, low_memory=False):
            chunk_idx += 1
            cleaned_chunk, stats = self.clean_chunk(chunk, rename_map)
            total_cleaned += stats["cleaned_rows"]
            total_dropped += (stats["initial_rows"] - stats["cleaned_rows"])

            logger.info(
                f"Processed Chunk {chunk_idx}: {stats['cleaned_rows']} valid rows, "
                f"{stats['initial_rows'] - stats['cleaned_rows']} dropped."
            )
            yield cleaned_chunk, stats

        logger.info(
            f"Dataset streaming finished for {file_path}. Total valid: {total_cleaned}, Total dropped: {total_dropped} across {chunk_idx} chunks."
        )
