import os
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from app.data.loader import DatasetLoader

logger = logging.getLogger("ev_twinguard.dataset_service")

DEFAULT_DATASET_PATH = os.getenv("DATASET_PATH", "data/ev_battery_dataset.csv")


class DatasetService:
    """
    High-level service interface for querying, sampling, and inspecting EV battery datasets.
    """

    def __init__(self, dataset_path: Optional[str] = None, chunk_size: int = 50000):
        self.dataset_path = dataset_path or DEFAULT_DATASET_PATH
        self.chunk_size = chunk_size
        self.loader = DatasetLoader(chunk_size=chunk_size)

    def _resolve_path(self, path_str: Optional[str]) -> str:
        p_str = path_str or self.dataset_path
        p = Path(p_str)
        if p.exists():
            return str(p)
        # Check backend relative
        backend_dir = Path(__file__).resolve().parent.parent.parent
        p_backend = backend_dir / p_str
        if p_backend.exists():
            return str(p_backend)
        # Check fixture fallback
        fixture_p = backend_dir / "tests" / "fixtures" / "sample_battery_dataset.csv"
        if fixture_p.exists():
            return str(fixture_p)
        return str(p)

    def load_dataset(self, file_path: Optional[str] = None) -> List[pd.DataFrame]:
        """
        Streams all cleaned chunks from the dataset file.
        Returns a list of cleaned chunk DataFrames.
        """
        target_path = self._resolve_path(file_path)
        cleaned_chunks: List[pd.DataFrame] = []
        for chunk, _ in self.loader.stream_cleaned_chunks(target_path):
            if not chunk.empty:
                cleaned_chunks.append(chunk)
        return cleaned_chunks

    def sample_records(
        self,
        n: int = 10,
        file_path: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves a sample of N clean records from the dataset.
        Stops as soon as N records are collected to conserve memory and time.
        """
        target_path = self._resolve_path(file_path)
        collected: List[Dict[str, Any]] = []

        for chunk, _ in self.loader.stream_cleaned_chunks(target_path):
            if not chunk.empty:
                needed = n - len(collected)
                sample = chunk.head(needed).to_dict(orient="records")
                collected.extend(sample)
                if len(collected) >= n:
                    break

        return collected

    def get_records_by_battery_id(
        self,
        battery_id: str,
        file_path: Optional[str] = None,
        max_records: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Searches and returns records matching the specified battery_id.
        """
        target_path = file_path or self.dataset_path
        target_id = str(battery_id).strip()
        matched: List[Dict[str, Any]] = []

        for chunk, _ in self.loader.stream_cleaned_chunks(target_path):
            if not chunk.empty and "battery_id" in chunk.columns:
                sub = chunk[chunk["battery_id"].str.lower() == target_id.lower()]
                if not sub.empty:
                    needed = max_records - len(matched)
                    matched.extend(sub.head(needed).to_dict(orient="records"))
                    if len(matched) >= max_records:
                        break

        return matched

    def query_records(
        self,
        filters: Dict[str, Any],
        file_path: Optional[str] = None,
        max_records: int = 500,
    ) -> List[Dict[str, Any]]:
        """
        Query records based on filter criteria:
        filters supported:
          - battery_id: str
          - min_soc: float, max_soc: float
          - min_voltage: float, max_voltage: float
          - min_current: float, max_current: float
          - min_battery_temp: float, max_battery_temp: float
          - min_ambient_temp: float, max_ambient_temp: float
          - min_age: float, max_age: float
          - min_cycles: int, max_cycles: int
        """
        target_path = file_path or self.dataset_path
        results: List[Dict[str, Any]] = []

        for chunk, _ in self.loader.stream_cleaned_chunks(target_path):
            if chunk.empty:
                continue

            filtered = chunk.copy()

            if "battery_id" in filters and filters["battery_id"]:
                bid = str(filters["battery_id"]).strip().lower()
                filtered = filtered[filtered["battery_id"].str.lower() == bid]

            if "min_soc" in filters and filters["min_soc"] is not None:
                filtered = filtered[filtered["soc"] >= float(filters["min_soc"])]
            if "max_soc" in filters and filters["max_soc"] is not None:
                filtered = filtered[filtered["soc"] <= float(filters["max_soc"])]

            if "min_voltage" in filters and filters["min_voltage"] is not None:
                filtered = filtered[filtered["voltage"] >= float(filters["min_voltage"])]
            if "max_voltage" in filters and filters["max_voltage"] is not None:
                filtered = filtered[filtered["voltage"] <= float(filters["max_voltage"])]

            if "min_current" in filters and filters["min_current"] is not None:
                filtered = filtered[filtered["charging_current"] >= float(filters["min_current"])]
            if "max_current" in filters and filters["max_current"] is not None:
                filtered = filtered[filtered["charging_current"] <= float(filters["max_current"])]

            if "min_battery_temp" in filters and filters["min_battery_temp"] is not None:
                filtered = filtered[filtered["battery_temperature"] >= float(filters["min_battery_temp"])]
            if "max_battery_temp" in filters and filters["max_battery_temp"] is not None:
                filtered = filtered[filtered["battery_temperature"] <= float(filters["max_battery_temp"])]

            if "min_cycles" in filters and filters["min_cycles"] is not None:
                filtered = filtered[filtered["charging_cycles"] >= int(filters["min_cycles"])]
            if "max_cycles" in filters and filters["max_cycles"] is not None:
                filtered = filtered[filtered["charging_cycles"] <= int(filters["max_cycles"])]

            if "min_age" in filters and filters["min_age"] is not None:
                filtered = filtered[filtered["battery_age"] >= float(filters["min_age"])]
            if "max_age" in filters and filters["max_age"] is not None:
                filtered = filtered[filtered["battery_age"] <= float(filters["max_age"])]

            if not filtered.empty:
                needed = max_records - len(results)
                results.extend(filtered.head(needed).to_dict(orient="records"))
                if len(results) >= max_records:
                    break

        return results

_default_service = DatasetService()


def get_dataset_service() -> DatasetService:
    return _default_service


def load_dataset(file_path: Optional[str] = None) -> List[pd.DataFrame]:
    return _default_service.load_dataset(file_path)


def sample_records(n: int = 10, file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    return _default_service.sample_records(n=n, file_path=file_path)


def get_records_by_battery_id(battery_id: str, file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    return _default_service.get_records_by_battery_id(battery_id=battery_id, file_path=file_path)


def query_records(filters: Dict[str, Any], file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    return _default_service.query_records(filters=filters, file_path=file_path)

