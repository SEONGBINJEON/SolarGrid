"""신안군 발전소 주소를 좌표로 바꾼다 (Kakao 로컬 주소 검색 API).

2026-10 고도화 내용
- 주소 정규화 규칙을 analysis/solargrid/address.py 로 옮기고, '번지·호·외'를 주소 전체에서
  지우던 부작용(내호리 → 내리, 889번지2호 → 8892)을 고쳤다.
- 복수 지번 주소는 첫 필지가 검색되지 않으면 다음 필지와 괄호 안 대체 필지를 차례로 검색한다.
- 서버 오류·네트워크 오류 같은 일시적 실패는 캐시에 남기지 않고 다음 실행 때 다시 시도한다.
- 읍면에 더해 리 단위까지 원본 주소와 검색 결과를 교차검증한다 (ri_check 열).
- --dry-run 으로 API를 호출하지 않고 새로 필요한 호출 수만 확인할 수 있다.

실행 (solar-dashboard 폴더에서)
    .venv\\Scripts\\python scripts\\geocode_shinan_plants.py --dry-run
    .venv\\Scripts\\python scripts\\geocode_shinan_plants.py
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "analysis"))

from solargrid.address import (  # noqa: E402
    extract_township,
    parcel_candidates,
    ri_name,
)
from solargrid.io import read_csv_any  # noqa: E402

DATA_DIR = ROOT_DIR / "public" / "data"
INPUT_CSV = DATA_DIR / "plants_shinan.csv"
OUTPUT_CSV = DATA_DIR / "plants_shinan_map.csv"
FAILED_CSV = DATA_DIR / "plants_shinan_geocode_failed.csv"
CACHE_JSON = DATA_DIR / "geocode_cache.json"

KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
TRANSIENT_STATUS = re.compile(r"^(request_error|http_429|http_5\d\d)$")

load_dotenv(ROOT_DIR / ".env")
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")


def load_cache() -> dict:
    if CACHE_JSON.exists():
        with open(CACHE_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE_JSON, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def to_number(value, default=0.0):
    if pd.isna(value):
        return default
    text = re.sub(r"[^0-9.\-]", "", str(value).replace(",", ""))
    try:
        return float(text) if text else default
    except ValueError:
        return default


def make_demo_risk(capacity_kw: float):
    """MVP용 임시 위험도: 용량이 클수록 출력제어 영향이 크다는 가정 (실측 모델 아님)."""
    risk_score = 0.35 + min(capacity_kw / 5000, 1.0) * 0.5
    if risk_score >= 0.75:
        return round(risk_score, 4), "위험", "12:00~15:00"
    if risk_score >= 0.5:
        return round(risk_score, 4), "주의", "13:00~14:00"
    return round(risk_score, 4), "정상", "-"


def _result(status, message="", lat="", lng="", matched_address="", matched_township=""):
    return {"status": status, "lat": lat, "lng": lng, "matched_address": matched_address,
            "matched_township": matched_township, "message": message}


class Geocoder:
    def __init__(self, cache: dict, dry_run: bool, sleep_sec: float):
        self.cache, self.dry_run, self.sleep_sec = cache, dry_run, sleep_sec
        self.api_calls = 0
        self.pending = set()

    def _request(self, address: str, analyze_type: str):
        self.api_calls += 1
        time.sleep(self.sleep_sec)  # API 과속 방지 (실제 호출할 때만 대기)
        return requests.get(KAKAO_ADDRESS_URL, headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
                            params={"query": address, "analyze_type": analyze_type}, timeout=10)

    def lookup(self, address: str) -> dict:
        if not address:
            return _result("empty_address", "주소 없음")
        cached = self.cache.get(address)
        if cached and not TRANSIENT_STATUS.match(cached.get("status", "")):
            return cached
        if self.dry_run:
            self.pending.add(address)
            return _result("not_queried", "dry-run")
        try:
            documents = []
            for analyze_type in ("exact", "similar"):   # exact 실패 시 similar로 한 번 더
                response = self._request(address, analyze_type)
                if response.status_code != 200:
                    return _result(f"http_{response.status_code}", response.text[:300])  # 일시적일 수 있어 캐시 안 함
                documents = response.json().get("documents", [])
                if documents:
                    break
        except requests.RequestException as error:
            return _result("request_error", str(error))
        if not documents:
            result = _result("no_result", "검색 결과 없음")
        else:
            doc = documents[0]
            info = doc.get("address") or {}
            result = _result("ok", lat=doc.get("y", ""), lng=doc.get("x", ""),
                             matched_address=doc.get("address_name", ""),
                             matched_township=info.get("region_3depth_h_name") or info.get("region_3depth_name") or "")
        self.cache[address] = result
        return result


def geocode_row(original_address: str, geocoder: Geocoder):
    """정규화 주소와 대체 필지를 차례로 검색해 첫 성공 결과를 돌려준다."""
    candidates = parcel_candidates(original_address)
    if not candidates:
        return "", geocoder.lookup(""), 0, 0
    first = None
    for rank, candidate in enumerate(candidates, start=1):
        geo = geocoder.lookup(candidate)
        first = first or geo
        if geo["status"] == "ok":
            return candidate, geo, rank, len(candidates)
    return candidates[0], first, 0, len(candidates)


def cross_check(expected, matched):
    if not expected or not matched:
        return "unchecked"
    return "ok" if expected == matched else "mismatch"


def main():
    parser = argparse.ArgumentParser(description="신안군 발전소 주소 좌표화")
    parser.add_argument("--dry-run", action="store_true", help="API를 호출하지 않고 새로 필요한 호출만 집계")
    parser.add_argument("--sleep", type=float, default=0.1, help="API 호출 사이 대기 시간(초)")
    args = parser.parse_args()

    if not args.dry_run and not KAKAO_REST_API_KEY:
        raise RuntimeError("KAKAO_REST_API_KEY가 없습니다. 프로젝트 루트의 .env 파일을 확인하세요.")
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"입력 파일이 없습니다: {INPUT_CSV}")

    df = read_csv_any(INPUT_CSV)
    geocoder = Geocoder(load_cache(), args.dry_run, args.sleep)
    rows = []

    for idx, row in df.iterrows():
        plant_id = row.get("순번", row.get("Unnamed: 0", idx + 1))
        capacity_kw = to_number(row.get("허가용량(킬로와트)", 0))
        original_address = str(row.get("발전소 설치장소", "")).strip()
        used_address, geo, parcel_rank, n_candidates = geocode_row(original_address, geocoder)
        risk_score, risk_level, curtailment_time = make_demo_risk(capacity_kw)
        status = geo["status"]
        is_ok = status == "ok"
        rows.append({
            "plant_id": plant_id,
            "plant_name": row.get("발전소명", f"발전소_{plant_id}"),
            "region": "전라남도",
            "sub_region": "신안군",
            "township": extract_township(used_address),
            "lat": geo.get("lat", ""),
            "lng": geo.get("lng", ""),
            "solar_capacity": capacity_kw,
            "solar_generation": round(capacity_kw * 0.7, 2),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "peak_hour": 13,
            "curtailment_time": curtailment_time,
            "address": used_address,
            "original_address": original_address,
            "matched_address": geo.get("matched_address", ""),
            "matched_township": geo.get("matched_township", ""),
            "township_check": cross_check(extract_township(used_address), geo.get("matched_township", "")) if is_ok else "unchecked",
            "ri_check": cross_check(ri_name(original_address), ri_name(geo.get("matched_address", ""))) if is_ok else "unchecked",
            "geocode_status": status,
            "parcel_rank": parcel_rank,
            "parcel_candidates": n_candidates,
            "power_type": row.get("원동력", "태양광"),
            "data_date": row.get("데이터 기준일", ""),
            "is_coordinate_real": is_ok,
        })
        if not args.dry_run and (idx + 1) % 200 == 0:
            print(f"{idx + 1}/{len(df)} 처리 · API 호출 {geocoder.api_calls}회")
            save_cache(geocoder.cache)

    result = pd.DataFrame(rows)
    ok = result["geocode_status"] == "ok"
    mismatch = (result["township_check"] == "mismatch") | (result["ri_check"] == "mismatch")

    if args.dry_run:
        print(f"[dry-run] 새로 조회할 주소 {len(geocoder.pending)}개 (exact·similar 최대 {2 * len(geocoder.pending)}회 호출)")
        for address in sorted(geocoder.pending)[:15]:
            print("  -", address)
        return

    save_cache(geocoder.cache)
    result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    result[~ok | mismatch].to_csv(FAILED_CSV, index=False, encoding="utf-8-sig")
    print("완료")
    print(f"전체 {len(result)} · 성공 {ok.sum()} ({ok.mean() * 100:.1f}%) · 실패 {(~ok).sum()} · API 호출 {geocoder.api_calls}회")
    print(f"대체 필지로 성공 {(result['parcel_rank'] > 1).sum()} · 읍면/리 불일치 {mismatch.sum()}")
    print(f"출력: {OUTPUT_CSV.name}, {FAILED_CSV.name}")


if __name__ == "__main__":
    main()
