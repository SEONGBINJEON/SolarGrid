"""잉여전력 분배 시뮬레이터.

해커톤 규칙(적용순위 ESS → P2H → EV, P2H는 잉여의 r을 전환)을 재현하고,
배터리 충전 상태(SOC) 제약, 민감도, 목표 활용률에 필요한 설비 용량을 계산한다.

- P2H는 매시간 잉여의 r(기본 50%)을 전환한다 (P2H 시간당 한도 이내).
- ESS는 남은 잉여를 용량까지 충전한다. soc=True면 잉여 시간 사이에 방전하지 않는다고 보고
  누적 충전량을 용량으로 제한한다 (discharge_in_gaps=True면 잉여가 없는 시간에 완전 방전).
- EV는 남은 잉여를 시간당 수용량까지 충전한다. 나머지는 잔여 출력제한이다.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, replace

import pandas as pd


@dataclass(frozen=True)
class Resources:
    ess_mwh: float = 0.996          # ESS 용량 (안좌스마트팜앤쏠라시티)
    ev_mwh_per_h: float = 0.1       # EV 시간당 수용량 (안좌한전 충전소)
    p2h_mwh_per_h: float = 69.8648  # P2H 시간당 한도 (안좌면 행정복지센터)
    p2h_ratio: float = 0.5          # 주의 등급 규칙: 잉여의 50%를 열로 전환


ESS_MODES = {"ESS 제한 없음": None, "ESS 피크 1회": 1, "ESS 피크 2회": 2}


def surplus_from_sector(sector: pd.DataFrame) -> dict[int, float]:
    """sector_coupling.csv의 첫 시나리오(24행)에서 잉여가 있는 시간만 뽑는다."""
    case1 = sector.iloc[:24]
    hours = case1["시간"].astype(int)
    surplus = case1["발전소_추정잉여전력_MWh"].astype(float)
    return {int(h): float(s) for h, s in zip(hours, surplus) if s > 0}


def resources_from_sector(sector: pd.DataFrame, p2h_ratio: float | None = None) -> Resources:
    row = sector.iloc[0]
    ratio = p2h_ratio
    if ratio is None:
        positive = sector[sector["발전소_추정잉여전력_MWh"] > 0].iloc[0]
        ratio = float(positive["P2H_분배량_MWh"]) / float(positive["발전소_추정잉여전력_MWh"])
    return Resources(float(row["ESS_수용가능량_MWh"]), float(row["EV_수용가능량_MWh"]),
                     float(row["P2H_수용가능량_MWh"]), round(ratio, 6))


def peak_hours(surplus: dict[int, float], n: int | None) -> set[int] | None:
    """잉여가 큰 상위 n개 시간 (None이면 모든 잉여 시간에서 ESS 사용)."""
    if n is None:
        return None
    return set(sorted(surplus, key=surplus.get, reverse=True)[:n])


def simulate(surplus: dict[int, float], res: Resources = Resources(), ess_hours: set[int] | None = None,
             soc: bool = False, discharge_in_gaps: bool = False) -> dict:
    hourly, stored, prev = [], 0.0, None
    for hour in sorted(surplus):
        s = surplus[hour]
        if discharge_in_gaps and prev is not None and hour - prev > 1:
            stored = 0.0
        prev = hour
        p2h = min(res.p2h_ratio * s, res.p2h_mwh_per_h)
        room = s - p2h
        allowed = ess_hours is None or hour in ess_hours
        limit = res.ess_mwh - stored if soc else res.ess_mwh
        ess = max(0.0, min(room, limit)) if allowed else 0.0
        stored += ess
        ev = max(0.0, min(res.ev_mwh_per_h, room - ess))
        hourly.append({"hour": hour, "surplus": s, "p2h": p2h, "ess": ess, "ev": ev,
                       "remaining": s - p2h - ess - ev, "ess_soc": stored if soc else None})
    total = sum(surplus.values())
    sums = {k: sum(h[k] for h in hourly) for k in ("p2h", "ess", "ev", "remaining")}
    absorbed = sums["p2h"] + sums["ess"] + sums["ev"]
    return {
        "hourly": hourly,
        "surplus_mwh": total,
        **{f"{k}_mwh": v for k, v in sums.items()},
        "absorbed_mwh": absorbed,
        "utilization_pct": absorbed / total * 100 if total else 0.0,
        "ess_uses": sum(1 for h in hourly if h["ess"] > 1e-9),
    }


def run_cases(surplus: dict[int, float], res: Resources, soc: bool = False, discharge_in_gaps: bool = False) -> dict:
    return {name: simulate(surplus, res, peak_hours(surplus, n), soc, discharge_in_gaps)
            for name, n in ESS_MODES.items()}


def sensitivity(surplus: dict[int, float], res: Resources, delta: float = 0.1, soc: bool = True) -> list[dict]:
    """설계 변수를 ±delta 만큼 바꿨을 때 활용률 변화(%p). 토네이도 차트 입력."""
    base = simulate(surplus, res, soc=soc)["utilization_pct"]
    out = []
    for field, label in (("p2h_ratio", "P2H 전환비율"), ("ess_mwh", "ESS 용량"), ("ev_mwh_per_h", "EV 수용량")):
        value = getattr(res, field)
        low = simulate(surplus, replace(res, **{field: value * (1 - delta)}), soc=soc)["utilization_pct"]
        high = simulate(surplus, replace(res, **{field: value * (1 + delta)}), soc=soc)["utilization_pct"]
        out.append({"factor": field, "label": label, "base_value": value,
                    "low_pp": low - base, "high_pp": high - base})
    return out


def _bisect(fn, target: float, lo: float, hi: float, iterations: int = 60) -> float | None:
    if fn(hi) < target:
        return None
    for _ in range(iterations):
        mid = (lo + hi) / 2
        lo, hi = (lo, mid) if fn(mid) >= target else (mid, hi)
    return hi


def required_ess(surplus: dict[int, float], res: Resources, target_pct: float, soc: bool = True,
                 max_mwh: float = 500.0) -> float | None:
    """목표 활용률을 맞추는 최소 ESS 용량 (CAPA 역산)."""
    return _bisect(lambda e: simulate(surplus, replace(res, ess_mwh=e), soc=soc)["utilization_pct"],
                   target_pct, 0.0, max_mwh)


def required_p2h_ratio(surplus: dict[int, float], res: Resources, target_pct: float, soc: bool = True) -> float | None:
    """목표 활용률을 맞추는 최소 P2H 전환비율."""
    return _bisect(lambda r: simulate(surplus, replace(res, p2h_ratio=r), soc=soc)["utilization_pct"],
                   target_pct, 0.0, 1.0)


def ess_sizing_curve(surplus: dict[int, float], res: Resources, sizes=(1, 5, 10, 20, 30, 40, 50, 60),
                     ratios=(0.5, 0.6, 0.7), soc: bool = True) -> dict:
    return {
        "sizes_mwh": list(sizes),
        "series": {f"{int(r * 100)}%": [round(simulate(surplus, replace(res, ess_mwh=e, p2h_ratio=r), soc=soc)
                                             ["utilization_pct"], 3) for e in sizes] for r in ratios},
    }


def resources_dict(res: Resources) -> dict:
    return asdict(res)
