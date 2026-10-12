import sys
from pathlib import Path

import pytest

ANALYSIS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSIS_DIR))

from solargrid.io import BASELINE_DIR, load_sources, read_csv_any  # noqa: E402


@pytest.fixture(scope="session")
def sources():
    return load_sources()


@pytest.fixture(scope="session")
def baseline_map():
    return read_csv_any(BASELINE_DIR / "plants_shinan_map_hackathon.csv")
