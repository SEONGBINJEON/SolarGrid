"""설비 구조·위험 패턴 분석 (파레토/ABC, 히트맵, 순위상관, 관리 한계 경보)."""
from __future__ import annotations

import pandas as pd

WARN_LIMIT = 0.05     # 경고 한계 (주의 등급 시작)
ACTION_LIMIT = 0.4    # 조치 한계 (위험 등급 시작)
SUSTAIN_HOURS = 3     # 경고 한계 이상이 이 시간 이상 이어지면 '지속 경보'

OCAP = {
    "정상": "정상 운영 · ESS 충전 우선, EV 충전 보조",
    "주의": "선제 대응 · ESS·EV 충전 + P2H 50% 전환",
    "위험": "적극 분산 · P2H 전환 우선, EV 충전 제한",
}


def risk_level(score: float) -> str:
    if score >= ACTION_LIMIT:
        return "위험"
    if score >= WARN_LIMIT:
        return "주의"
    return "정상"


# ---------------------------------------------------------------- 설비 구조
def capacity_pareto(capacity_kw: pd.Series, step: int = 2) -> dict:
    cap = capacity_kw.astype(float).sort_values(ascending=False).reset_index(drop=True)
    share = cap.cumsum() / cap.sum()
    n = len(cap)

    def at(pct):
        k = max(1, round(n * pct / 100))
        return round(float(share.iloc[k - 1]) * 100, 2)

    curve = [{"plant_pct": 0, "capacity_pct": 0.0}] + [
        {"plant_pct": p, "capacity_pct": at(p)} for p in range(step, 101, step)]
    before = share.shift(fill_value=0)
    abc = pd.Series("C", index=cap.index)
    abc[before < 0.95] = "B"
    abc[before < 0.80] = "A"
    classes = []
    for grade in "ABC":
        mask = abc == grade
        classes.append({"grade": grade, "plants": int(mask.sum()), "plant_pct": round(mask.mean() * 100, 1),
                        "capacity_mw": round(cap[mask].sum() / 1000, 1),
                        "capacity_pct": round(cap[mask].sum() / cap.sum() * 100, 1)})
    return {"total_mw": round(cap.sum() / 1000, 1), "plants": n, "curve": curve,
            "top20_pct": at(20), "top40_pct": at(40), "abc": classes}


def size_classes(capacity_kw: pd.Series) -> list[dict]:
    cap = capacity_kw.astype(float)
    bins = [(0, 100, "100kW 미만"), (100, 500, "100~500kW"), (500, 1000, "500kW~1MW"), (1000, 1e12, "1MW 이상")]
    out = []
    for lo, hi, label in bins:
        mask = (cap >= lo) & (cap < hi)
        if mask.any():
            out.append({"class": label, "plants": int(mask.sum()), "plant_pct": round(mask.mean() * 100, 1),
                        "capacity_pct": round(cap[mask].sum() / cap.sum() * 100, 1)})
    return out


def township_breakdown(plants_map: pd.DataFrame) -> list[dict]:
    df = plants_map.assign(township=plants_map["township"].fillna("미상").replace("", "미상"))
    g = df.groupby("township").agg(plants=("plant_id", "size"), capacity_kw=("solar_capacity", "sum"))
    g = g.sort_values("capacity_kw", ascending=False)
    g["cum_pct"] = g["capacity_kw"].cumsum() / g["capacity_kw"].sum() * 100
    return [{"township": t, "plants": int(r.plants), "capacity_mw": round(r.capacity_kw / 1000, 1),
             "cum_pct": round(r.cum_pct, 1)} for t, r in g.iterrows()]


def permit_vintage(plants_raw: pd.DataFrame) -> dict:
    cap = plants_raw["허가용량(킬로와트)"].astype(float)
    started = pd.to_datetime(plants_raw["사업개시일"], errors="coerce").notna()
    year = pd.to_datetime(plants_raw["허가증교부일"], errors="coerce").dt.year
    group = year.where(year.isna() | (year >= 2017), other=2016)
    df = pd.DataFrame({"g": group, "started": started, "cap": cap}).dropna(subset=["g"])
    rows = []
    for g, part in df.groupby("g"):
        rows.append({"label": "~2016" if g == 2016 else str(int(g)),
                     "operating_mw": round(part.loc[part.started, "cap"].sum() / 1000, 2),
                     "pending_mw": round(part.loc[~part.started, "cap"].sum() / 1000, 2)})
    return {"years": rows, "pending_share_pct": round(cap[~started].sum() / cap.sum() * 100, 1),
            "pending_mw": round(cap[~started].sum() / 1000, 1), "operating_mw": round(cap[started].sum() / 1000, 1)}


# ---------------------------------------------------------------- 시간·지역 위험 패턴
def hourly_profile(jeonnam_time: pd.DataFrame) -> dict:
    t = jeonnam_time.copy()
    t["hour"] = t["시간"].astype(str).str.extract(r"(\d+)")[0].astype(int)
    t["mw"] = pd.to_numeric(t["발전량"], errors="coerce").fillna(0)
    total = t.groupby("hour")["mw"].sum().reindex(range(24), fill_value=0)
    return {"hours": list(range(24)), "total_mw": [round(float(v), 1) for v in total],
            "share_11_15_pct": round(float(total.loc[11:15].sum() / total.sum() * 100), 1),
            "cities": int(t["도시"].nunique())}


def risk_heatmap(forecast: pd.DataFrame) -> dict:
    piv = forecast.pivot(index="region", columns="hour", values="risk_score")
    piv = piv.loc[piv.max(axis=1).sort_values(ascending=False).index]
    return {"regions": piv.index.tolist(), "hours": [int(h) for h in piv.columns],
            "scores": [[round(float(v), 4) for v in row] for row in piv.values]}


def risk_correlations(forecast: pd.DataFrame) -> dict:
    day = forecast[forecast["irradiance"] > 0]
    factors = [("irradiance", "일사량"), ("temperature", "기온"), ("solar_generation", "발전량"),
               ("cloud_total", "운량"), ("humidity", "습도")]
    rows = [{"factor": f, "label": label,
             "spearman": round(float(day["risk_score"].rank().corr(day[f].rank())), 3)} for f, label in factors]
    return {"daytime_rows": int(len(day)), "factors": sorted(rows, key=lambda r: r["spearman"], reverse=True)}


def hourly_level_counts(forecast: pd.DataFrame) -> list[dict]:
    counts = forecast.assign(level=forecast["risk_score"].map(risk_level)) \
        .pivot_table(index="hour", columns="level", values="region", aggfunc="count", fill_value=0)
    return [{"hour": int(h), **{lv: int(row.get(lv, 0)) for lv in ("정상", "주의", "위험")}} for h, row in counts.iterrows()]


def alarm_events(forecast: pd.DataFrame) -> list[dict]:
    """지역별로 경고 한계 이상이 이어진 구간을 하나의 이벤트로 묶는다."""
    events = []
    for region, part in forecast.sort_values("hour").groupby("region"):
        run = []
        for hour, score in zip(part["hour"], part["risk_score"]):
            if score >= WARN_LIMIT:
                run.append((int(hour), float(score)))
                continue
            if run:
                events.append(_event(region, run))
                run = []
        if run:
            events.append(_event(region, run))
    return sorted(events, key=lambda e: (-e["peak_score"], e["start_hour"]))


def _event(region: str, run: list[tuple[int, float]]) -> dict:
    peak_hour, peak = max(run, key=lambda x: x[1])
    level = risk_level(peak)
    duration = len(run)
    return {"region": region, "start_hour": run[0][0], "end_hour": run[-1][0], "duration_h": duration,
            "peak_hour": peak_hour, "peak_score": round(peak, 4), "peak_level": level,
            "action_limit_exceeded": peak >= ACTION_LIMIT, "sustained": duration >= SUSTAIN_HOURS,
            "action": OCAP[level]}
