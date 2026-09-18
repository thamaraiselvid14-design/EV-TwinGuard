from pathlib import Path
import pytest
import pandas as pd
from app.data.loader import DatasetLoader
from app.data.dataset_service import DatasetService

FIXTURE_PATH = str(Path(__file__).parent / "fixtures" / "sample_battery_dataset.csv")


def test_dataset_loader_cleans_and_preserves_columns():
    loader = DatasetLoader(chunk_size=10)
    cleaned_chunks = []
    stats_list = []

    for chunk, stats in loader.stream_cleaned_chunks(FIXTURE_PATH):
        cleaned_chunks.append(chunk)
        stats_list.append(stats)

    full_cleaned = pd.concat(cleaned_chunks, ignore_index=True)

    # Check that invalid rows were filtered out:
    # 1. Missing battery_id row dropped
    assert "" not in full_cleaned["battery_id"].values
    assert not full_cleaned["battery_id"].isna().any()

    # 2. Corrupted voltage ('invalid_num') dropped
    assert (full_cleaned["voltage"] > 0).all()

    # 3. Outlier SOC (150.0) dropped
    assert (full_cleaned["soc"] <= 100.0).all()
    assert (full_cleaned["soc"] >= 0.0).all()

    # 4. Outlier cycles (-15) dropped
    assert (full_cleaned["charging_cycles"] >= 0).all()

    # 5. Duplicates dropped: EV-PACK-202 was duplicated in fixture
    pack_202_records = full_cleaned[full_cleaned["battery_id"] == "EV-PACK-202"]
    assert len(pack_202_records) == 1

    # 6. Extra metadata/sensor columns PRESERVED
    assert "sensor_serial" in full_cleaned.columns
    assert "coolant_flow_rate_lpm" in full_cleaned.columns
    assert "SN-90812" in full_cleaned["sensor_serial"].values

    # Clean valid records remaining should be 4:
    # EV-PACK-101 (row 1), EV-PACK-101 (row 2), EV-PACK-202 (1 unique), EV-PACK-606
    assert len(full_cleaned) == 4


def test_missing_canonical_column_raises_error(tmp_path):
    # Create CSV without SOC column
    bad_csv = tmp_path / "missing_col.csv"
    bad_csv.write_text(
        "battery_id,voltage,charging_current,battery_temperature,ambient_temperature,battery_age,charging_cycles\n"
        "EV001,400.0,15.0,30.0,25.0,12.0,100\n"
    )

    loader = DatasetLoader()
    with pytest.raises(ValueError, match="missing required canonical battery columns"):
        list(loader.stream_cleaned_chunks(str(bad_csv)))


def test_dataset_service_sampling():
    service = DatasetService(dataset_path=FIXTURE_PATH, chunk_size=5)
    sample_2 = service.sample_records(n=2)
    assert len(sample_2) == 2
    assert "battery_id" in sample_2[0]
    assert "soc" in sample_2[0]
    assert "sensor_serial" in sample_2[0]  # Extra column preserved in sample


def test_dataset_service_get_by_battery_id():
    service = DatasetService(dataset_path=FIXTURE_PATH)
    records = service.get_records_by_battery_id("EV-PACK-101")
    assert len(records) == 2
    for r in records:
        assert r["battery_id"] == "EV-PACK-101"

    non_existent = service.get_records_by_battery_id("NON_EXISTENT")
    assert len(non_existent) == 0


def test_dataset_service_query_records():
    service = DatasetService(dataset_path=FIXTURE_PATH)

    # Filter: SOC >= 86.0
    high_soc = service.query_records(filters={"min_soc": 86.0})
    assert len(high_soc) == 2
    for r in high_soc:
        assert r["soc"] >= 86.0

    # Filter: SOC range + battery_id
    filtered = service.query_records(filters={
        "battery_id": "EV-PACK-101",
        "min_soc": 85.0,
        "max_soc": 86.0,
    })
    assert len(filtered) == 1
    assert filtered[0]["soc"] == 85.5
