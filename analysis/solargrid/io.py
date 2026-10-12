"""데이터 파일 경로와 CSV 읽기."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[2]          # solar-dashboard/
DATA_DIR = ROOT_DIR / "public" / "data"
BASELINE_DIR = ROOT_DIR / "analysis" / "baseline"


def read_csv_any(path: Path | str, **kwargs) -> pd.DataFrame:
    """UTF-8 → CP949 → EUC-KR 순서로 인코딩을 판별해 읽는다 (공공데이터 원천 대응)."""
    last_error = None
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return pd.read_csv(path, encoding=encoding, **kwargs)
        except UnicodeDecodeError as error:
            last_error = error
    raise last_error


def load_sources(data_dir: Path = DATA_DIR) -> dict[str, pd.DataFrame]:
    """대시보드가 쓰는 원천 CSV를 한 번에 읽는다."""
    time = read_csv_any(data_dir / "time_data.csv")
    return {
        "plants_raw": read_csv_any(data_dir / "plants_shinan.csv"),
        "plants_map": read_csv_any(data_dir / "plants_shinan_map.csv"),
        "forecast": read_csv_any(data_dir / "future_curtailment_risk_result.csv"),
        "jeonnam_time": time.iloc[1:].reset_index(drop=True),   # 2행은 단위 표기 행
        "sector": read_csv_any(data_dir / "sector_coupling.csv"),
        "sector_compare": read_csv_any(data_dir / "sector_coupling_compare.csv"),
    }
