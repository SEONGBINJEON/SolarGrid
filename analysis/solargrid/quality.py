"""데이터 품질 게이트: 대시보드에 들어가기 전에 원천·가공 데이터를 검사한다.

각 검사는 통과(pass) · 주의(warn) · 실패(fail) 중 하나로 판정한다.
"""
from __future__ import annotations

import re

import pandas as pd

from .allocation import resources_from_sector, run_cases, simulate, surplus_from_sector
from .patterns import ACTION_LIMIT, WARN_LIMIT, risk_level

# 대시보드(useSolarData.js)가 요구하는 필수 컬럼
REQUIRED_COLUMNS = {
    "future_curtailment_risk_result.csv": ["date", "hour", "region", "solar_generation", "solar_capacity",
                                           "generation_ratio", "temperature", "rainfall", "humidity", "irradiance",
                                           "cloud_total", "risk_score", "risk_level"],
    "plants_shinan_map.csv": ["plant_id", "plant_name", "region", "sub_region", "township", "lat", "lng",
                              "solar_capacity", "solar_generation", "risk_score", "risk_level", "curtailment_time",
                              "address"],
    "time_data.csv": ["시간", "도시", "발전량", "누적발전량", "기온", "risk_score", "risk_level"],
    "sector_coupling.csv": ["예측일자", "시간", "출력제한_위험_등급", "출력제한_위험점수", "온도_C",
                            "발전소_예측발전량_MWh", "발전소_추정잉여전력_MWh", "적용순위", "ESS_제한_방식",
                            "ESS_수용가능량_MWh", "EV_수용가능량_MWh", "P2H_수용가능량_MWh", "ESS_분배량_MWh",
                            "EV_분배량_MWh", "P2H_분배량_MWh", "잔여_출력제한_MWh", "분배후_활용률_%"],
}
SHINAN_BBOX = {"lat": (33.9, 35.3), "lng": (124.9, 126.6)}   # 흑산·가거도까지 포함하는 신안군 범위
YIELD_TARGET = 95.0


def _check(cid, category, name, target, actual, status, detail=""):
    return {"id": cid, "category": category, "name": name, "target": target, "actual": actual,
            "status": status, "detail": detail}


def run_checks(src: dict[str, pd.DataFrame]) -> list[dict]:
    checks = []
    frames = {"future_curtailment_risk_result.csv": src["forecast"], "plants_shinan_map.csv": src["plants_map"],
              "time_data.csv": src["jeonnam_time"], "sector_coupling.csv": src["sector"]}

    # 1. 스키마
    missing = {f: [c for c in cols if c not in frames[f].columns] for f, cols in REQUIRED_COLUMNS.items()}
    bad = {f: m for f, m in missing.items() if m}
    checks.append(_check("schema", "스키마", "대시보드 필수 컬럼", f"{len(REQUIRED_COLUMNS)}개 파일 누락 0",
                         f"누락 {sum(len(m) for m in bad.values())}개", "fail" if bad else "pass",
                         ", ".join(f"{f}: {m}" for f, m in bad.items())))

    # 2. 완전성
    fc = src["forecast"]
    expected = fc["region"].nunique() * 24
    dup = int(fc.duplicated(["region", "hour"]).sum())
    checks.append(_check("forecast_complete", "완전성", "시도×시간 예측 행 완전성",
                         f"{fc['region'].nunique()}개 시도 × 24시간 = {expected}행, 중복 0",
                         f"{len(fc)}행, 중복 {dup}", "pass" if len(fc) == expected and dup == 0 else "fail"))

    # 3. 범위
    out_of_range = int(((fc["risk_score"] < 0) | (fc["risk_score"] > 1)).sum())
    negative = int((fc[["solar_generation", "irradiance"]] < 0).sum().sum())
    checks.append(_check("risk_range", "범위", "위험점수 0~1, 발전량·일사량 ≥ 0", "위반 0건",
                         f"위반 {out_of_range + negative}건", "pass" if out_of_range + negative == 0 else "fail"))

    # 4. 등급 정합성
    mismatch = int((fc["risk_score"].map(risk_level) != fc["risk_level"]).sum())
    checks.append(_check("level_consistency", "정합성", f"위험 등급 경계 일관성 ({WARN_LIMIT} / {ACTION_LIMIT})",
                         "불일치 0건", f"불일치 {mismatch}건 / {len(fc)}행", "pass" if mismatch == 0 else "fail"))

    # 5~8. 좌표화 품질
    pm = src["plants_map"]
    ok = pm["geocode_status"] == "ok"
    yield_pct = ok.mean() * 100
    checks.append(_check("geocode_yield", "수율", "발전소 좌표화 수율", f"≥ {YIELD_TARGET:.0f}%",
                         f"{yield_pct:.1f}% ({ok.sum():,}/{len(pm):,})", "pass" if yield_pct >= YIELD_TARGET else "fail"))
    for col, label in (("township_check", "읍면"), ("ri_check", "리")):
        if col in pm.columns:
            n_mis = int((pm[col] == "mismatch").sum())
            n_chk = int((pm[col] == "ok").sum()) + n_mis
            checks.append(_check(f"{col}", "정합성", f"원본 주소 ↔ 검색 결과 {label} 교차검증", "불일치 0건",
                                 f"불일치 {n_mis}건 / 검증 {n_chk:,}건", "pass" if n_mis == 0 else "fail"))
    lat = pd.to_numeric(pm.loc[ok, "lat"], errors="coerce")
    lng = pd.to_numeric(pm.loc[ok, "lng"], errors="coerce")
    outside = int((~lat.between(*SHINAN_BBOX["lat"]) | ~lng.between(*SHINAN_BBOX["lng"])).sum())
    checks.append(_check("bbox", "범위", "좌표가 신안군 범위 안에 있는가", "범위 밖 0건", f"범위 밖 {outside}건",
                         "pass" if outside == 0 else "fail"))
    source_defects = int(pm["original_address"].astype(str).map(lambda a: bool(re.search(r"\d{6,}", a))).sum())
    checks.append(_check("source_defect", "원천", "원천 주소 표기 오류 (구분자 누락 지번)", "0건 · 발견 시 수기 검토",
                         f"{source_defects}건", "warn" if source_defects else "pass",
                         "자동 분할은 오류 위험이 커서 수기 검토 대상으로 분리"))

    # 9~10. 분배 결과의 수지·제약
    sc = src["sector"]
    balance = (sc["ESS_분배량_MWh"] + sc["EV_분배량_MWh"] + sc["P2H_분배량_MWh"] + sc["잔여_출력제한_MWh"]
               - sc["발전소_추정잉여전력_MWh"]).abs()
    checks.append(_check("energy_balance", "수지", "에너지 수지: 분배 + 잔여 = 잉여", "오차 ≤ 0.001 MWh",
                         f"최대 오차 {balance.max():.6f} MWh", "pass" if balance.max() <= 1e-3 else "fail"))
    over = int(((sc["ESS_분배량_MWh"] > sc["ESS_수용가능량_MWh"] + 1e-9) |
                (sc["EV_분배량_MWh"] > sc["EV_수용가능량_MWh"] + 1e-9) |
                (sc["P2H_분배량_MWh"] > sc["P2H_수용가능량_MWh"] + 1e-9)).sum())
    checks.append(_check("capacity_limit", "제약", "시간별 분배량 ≤ 자원 용량", "위반 0건", f"위반 {over}건",
                         "pass" if over == 0 else "fail"))

    # 11. 재현성
    surplus, res = surplus_from_sector(sc), resources_from_sector(sc)
    sim = run_cases(surplus, res)
    ref = src["sector_compare"].set_index("구분")["분배후_활용률_%"]
    diff = max(abs(sim[k]["utilization_pct"] - float(ref[k])) for k in sim)
    checks.append(_check("reproduce", "재현성", "분배 시뮬레이터가 팀 결과(Case 1~3)를 재현", "오차 ≤ 0.01%p",
                         f"최대 오차 {diff:.4f}%p", "pass" if diff <= 0.01 else "fail"))

    # 12. 실현 가능성 (충전 상태)
    needed = sim["ESS 제한 없음"]["ess_mwh"]
    feasible_c1 = needed <= res.ess_mwh + 1e-9
    soc_c2 = simulate(surplus, res, ess_hours={max(surplus, key=surplus.get)}, soc=True)["utilization_pct"]
    checks.append(_check("soc_feasibility", "실현성", "ESS 운전 계획이 충전 상태(SOC) 한도를 지키는가",
                         f"누적 충전 ≤ {res.ess_mwh} MWh",
                         f"Case 1 누적 {needed:.3f} MWh · Case 2 {res.ess_mwh} MWh",
                         "pass" if feasible_c1 else "warn",
                         f"Case 1은 방전 없이 불가능 → Case 2 운영(활용률 {soc_c2:.2f}%)을 기준으로 채택"))
    return checks


def summarize(checks: list[dict]) -> dict:
    return {s: sum(1 for c in checks if c["status"] == s) for s in ("pass", "warn", "fail")}
