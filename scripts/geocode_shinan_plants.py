import os
import re
import json
import time
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "public" / "data"

INPUT_CSV = DATA_DIR / "plants_shinan.csv"
OUTPUT_CSV = DATA_DIR / "plants_shinan_map.csv"
FAILED_CSV = DATA_DIR / "plants_shinan_geocode_failed.csv"
CACHE_JSON = DATA_DIR / "geocode_cache.json"

KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"

load_dotenv(ROOT_DIR / ".env")
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")


TOWNSHIPS = [
    "지도읍",
    "압해읍",
    "증도면",
    "임자면",
    "자은면",
    "비금면",
    "도초면",
    "흑산면",
    "하의면",
    "신의면",
    "장산면",
    "안좌면",
    "팔금면",
    "암태면",
]


def read_csv_with_fallback(path: Path) -> pd.DataFrame:
    for encoding in ["utf-8-sig", "cp949", "euc-kr"]:
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("CSV 인코딩을 읽을 수 없습니다.", b"", 0, 1, "encoding error")


def load_cache() -> dict:
    if CACHE_JSON.exists():
        with open(CACHE_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE_JSON, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def normalize_address(address: str) -> str:
    if pd.isna(address):
        return ""

    address = str(address).strip()
    address = re.sub(r"\s+", " ", address)

    # 불필요한 표현 제거
    address = address.replace("번지", "")
    address = address.replace("호", "")
    address = address.replace("외", "")
    address = address.replace("(건물)", "")
    address = re.sub(r"\([^)]*\)", "", address)

    # 오타 보정
    address = address.replace("압헤읍", "압해읍")

    # 여러 필지가 한 칸에 들어간 경우 첫 번째 필지만 사용
    if "," in address:
        address = address.split(",")[0].strip()

    # 주소가 전라남도로 시작하지 않으면 보정
    if address and not address.startswith("전라남도"):
        if address.startswith("신안군"):
            address = "전라남도 " + address
        else:
            address = "전라남도 신안군 " + address

    # 읍/면 뒤 공백 보정
    # 예: 지도읍광정리143 → 지도읍 광정리143
    for township in TOWNSHIPS:
        address = address.replace(township, township + " ")

    # 리/동 뒤 번지가 바로 붙은 경우 공백 보정
    # 예: 광정리143 → 광정리 143
    # 예: 대초리산4-1 → 대초리 산4-1
    address = re.sub(r"([가-힣]+리)(산?\s*\d)", r"\1 \2", address)
    address = re.sub(r"([가-힣]+동)(산?\s*\d)", r"\1 \2", address)

    # 산 번지 공백 보정
    # 예: 산4-1 → 산 4-1
    address = re.sub(r"산\s*(\d)", r"산 \1", address)

    # 숫자 뒤에 붙은 불필요한 한글 제거 방지용 정리
    address = re.sub(r"\s+", " ", address).strip()

    return address


def extract_township(address: str) -> str:
    if not address:
        return ""

    for township in TOWNSHIPS:
        if township in str(address):
            return township

    return ""


def to_number(value, default=0.0):
    if pd.isna(value):
        return default

    text = str(value)
    text = text.replace(",", "")
    text = re.sub(r"[^0-9.\-]", "", text)

    if text == "":
        return default

    try:
        return float(text)
    except ValueError:
        return default


def make_demo_risk(capacity_kw: float):
    # MVP용 임시 위험도 계산
    # 용량이 큰 발전소일수록 출력제어 영향이 클 수 있다는 가정
    risk_score = 0.35 + min(capacity_kw / 5000, 1.0) * 0.5

    if risk_score >= 0.75:
        risk_level = "위험"
        curtailment_time = "12:00~15:00"
    elif risk_score >= 0.5:
        risk_level = "주의"
        curtailment_time = "13:00~14:00"
    else:
        risk_level = "정상"
        curtailment_time = "-"

    return round(risk_score, 4), risk_level, curtailment_time


def geocode_address(address: str, cache: dict):
    if not address:
        return {
            "status": "empty_address",
            "lat": "",
            "lng": "",
            "matched_address": "",
            "matched_township": "",
            "message": "주소 없음",
        }

    if address in cache:
        return cache[address]

    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }

    params = {
        "query": address,
        "analyze_type": "exact",
    }

    try:
        response = requests.get(
            KAKAO_ADDRESS_URL,
            headers=headers,
            params=params,
            timeout=10,
        )
    except requests.RequestException as e:
        result = {
            "status": "request_error",
            "lat": "",
            "lng": "",
            "matched_address": "",
            "matched_township": "",
            "message": str(e),
        }
        cache[address] = result
        return result

    if response.status_code != 200:
        result = {
            "status": f"http_{response.status_code}",
            "lat": "",
            "lng": "",
            "matched_address": "",
            "matched_township": "",
            "message": response.text[:300],
        }
        cache[address] = result
        return result

    data = response.json()
    documents = data.get("documents", [])

    # exact 검색 실패 시 similar로 한 번 더 시도
    if not documents:
        params["analyze_type"] = "similar"
        response = requests.get(
            KAKAO_ADDRESS_URL,
            headers=headers,
            params=params,
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            documents = data.get("documents", [])

    if not documents:
        result = {
            "status": "no_result",
            "lat": "",
            "lng": "",
            "matched_address": "",
            "matched_township": "",
            "message": "검색 결과 없음",
        }
        cache[address] = result
        return result

    doc = documents[0]

    matched_address = doc.get("address_name", "")
    lng = doc.get("x", "")
    lat = doc.get("y", "")

    address_info = doc.get("address") or {}
    matched_township = address_info.get("region_3depth_h_name") or address_info.get("region_3depth_name") or ""

    result = {
        "status": "ok",
        "lat": lat,
        "lng": lng,
        "matched_address": matched_address,
        "matched_township": matched_township,
        "message": "",
    }

    cache[address] = result
    return result


def main():
    if not KAKAO_REST_API_KEY:
        raise RuntimeError("KAKAO_REST_API_KEY가 없습니다. 프로젝트 루트의 .env 파일을 확인하세요.")

    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"입력 파일이 없습니다: {INPUT_CSV}")

    df = read_csv_with_fallback(INPUT_CSV)
    cache = load_cache()

    results = []
    failed = []

    total = len(df)

    for idx, row in df.iterrows():
        plant_id = row.get("순번", idx + 1)
        plant_name = row.get("발전소명", f"발전소_{plant_id}")
        power_type = row.get("원동력", "태양광")
        capacity_kw = to_number(row.get("허가용량(킬로와트)", 0))
        original_address = str(row.get("발전소 설치장소", "")).strip()
        data_date = row.get("데이터 기준일", "")

        normalized_address = normalize_address(original_address)
        raw_township = extract_township(normalized_address)

        geo = geocode_address(normalized_address, cache)

        risk_score, risk_level, curtailment_time = make_demo_risk(capacity_kw)

        geocode_status = geo["status"]
        matched_township = geo.get("matched_township", "")

        township_check = "unchecked"
        if geocode_status == "ok":
            if raw_township and matched_township and raw_township != matched_township:
                township_check = "mismatch"
            else:
                township_check = "ok"

        output_row = {
            "plant_id": plant_id,
            "plant_name": plant_name,
            "region": "전라남도",
            "sub_region": "신안군",
            "township": raw_township,
            "lat": geo.get("lat", ""),
            "lng": geo.get("lng", ""),
            "solar_capacity": capacity_kw,
            "solar_generation": round(capacity_kw * 0.7, 2),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "peak_hour": 13,
            "curtailment_time": curtailment_time,
            "address": normalized_address,
            "original_address": original_address,
            "matched_address": geo.get("matched_address", ""),
            "matched_township": matched_township,
            "township_check": township_check,
            "geocode_status": geocode_status,
            "power_type": power_type,
            "data_date": data_date,
            "is_coordinate_real": geocode_status == "ok",
        }

        results.append(output_row)

        if geocode_status != "ok" or township_check == "mismatch":
            failed.append(output_row)

        if (idx + 1) % 50 == 0:
            print(f"{idx + 1}/{total} 처리 완료")
            save_cache(cache)

        # API 호출 과속 방지
        time.sleep(0.1)

    result_df = pd.DataFrame(results)
    failed_df = pd.DataFrame(failed)

    result_df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    failed_df.to_csv(FAILED_CSV, index=False, encoding="utf-8-sig")

    save_cache(cache)

    success_count = len(result_df[result_df["geocode_status"] == "ok"])
    fail_count = total - success_count
    mismatch_count = len(result_df[result_df["township_check"] == "mismatch"])

    print("완료")
    print(f"전체: {total}")
    print(f"성공: {success_count}")
    print(f"실패: {fail_count}")
    print(f"읍면 불일치 의심: {mismatch_count}")
    print(f"출력 파일: {OUTPUT_CSV}")
    print(f"실패/검토 파일: {FAILED_CSV}")


if __name__ == "__main__":
    main()