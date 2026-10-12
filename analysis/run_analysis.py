"""분석 파이프라인: 원천 CSV → 품질 검사·패턴 분석·분배 시뮬레이션 → 대시보드용 JSON + 보고서.

실행 (solar-dashboard 폴더에서)
    .venv\\Scripts\\python analysis\\run_analysis.py

출력
    public/data/analytics.json          대시보드 '공정 분석' 화면이 읽는 결과
    analysis/reports/analysis_report.md 사람이 읽는 분석 보고서
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from solargrid import address as addr  # noqa: E402
from solargrid import allocation as alloc  # noqa: E402
from solargrid import patterns, quality  # noqa: E402
from solargrid.io import BASELINE_DIR, DATA_DIR, ROOT_DIR, load_sources, read_csv_any  # noqa: E402

OUT_JSON = DATA_DIR / "analytics.json"
OUT_REPORT = ROOT_DIR / "analysis" / "reports" / "analysis_report.md"
BASELINE_MAP = BASELINE_DIR / "plants_shinan_map_hackathon.csv"


def r(x, d=3):
    return None if x is None else round(float(x), d)


# ---------------------------------------------------------------- 좌표화 품질 (Measure)
def address_defect_pareto(raw) -> tuple[list[dict], int]:
    a = raw["발전소 설치장소"].astype(str)
    tw = "(?:" + "|".join(addr.TOWNSHIPS) + ")"
    rules = [("복수 지번 기재", a.str.contains(",")),
             ("'리'+번지 붙여쓰기", a.str.contains(r"[가-힣]리(?:산?\d)")),
             ("읍면 붙여쓰기", a.str.contains(tw + r"[가-힣0-9]")),
             ("'외·번지·괄호' 표기", a.str.contains(r"외|번지|\(")),
             ("오타 (압헤읍)", a.str.contains("압헤읍"))]
    rows = sorted(({"type": name, "count": int(mask.sum())} for name, mask in rules), key=lambda x: -x["count"])
    total, cum = sum(x["count"] for x in rows), 0
    for x in rows:
        cum += x["count"]
        x["cum_pct"] = round(cum / total * 100, 1)
    any_issue = rules[0][1]
    for _, mask in rules[1:]:
        any_issue = any_issue | mask
    return rows, int(any_issue.sum())


def failure_causes(df) -> Counter:
    failed = df[df["geocode_status"] != "ok"]
    return Counter(addr.classify_failure(o, u, s) for o, u, s in
                   zip(failed["original_address"], failed["address"], failed["geocode_status"]))


def geocode_section(src) -> dict:
    after = src["plants_map"]
    before = read_csv_any(BASELINE_MAP) if BASELINE_MAP.exists() else after
    ok_b, ok_a = before["geocode_status"] == "ok", after["geocode_status"] == "ok"
    cb, ca = failure_causes(before), failure_causes(after)
    causes = [{"cause": c, "before": cb.get(c, 0), "after": ca.get(c, 0), "rule_defect": c in addr.RULE_CAUSES}
              for c in sorted(set(cb) | set(ca), key=lambda c: (-cb.get(c, 0), -ca.get(c, 0)))]
    recovered = (~ok_b.values) & ok_a.values
    by_alt = int((recovered & (after["parcel_rank"].values > 1)).sum()) if "parcel_rank" in after else 0
    defects, defect_rows = address_defect_pareto(src["plants_raw"])
    ri_ok = int((after.get("ri_check") == "ok").sum()) if "ri_check" in after else 0
    remaining = after[~ok_a]
    return {
        "plants": int(len(after)),
        "defect_rows": defect_rows,
        "defect_pareto": defects,
        "funnel": [
            {"step": "원천 발전소", "value": int(len(after))},
            {"step": "정규화 고유 주소", "value": int(after["address"].nunique())},
            {"step": "좌표화 성공", "value": int(ok_a.sum())},
            {"step": "리 단위 검증 일치", "value": ri_ok},
        ],
        "before": {"success": int(ok_b.sum()), "failed": int((~ok_b).sum()), "yield_pct": r(ok_b.mean() * 100, 2)},
        "after": {"success": int(ok_a.sum()), "failed": int((~ok_a).sum()), "yield_pct": r(ok_a.mean() * 100, 2)},
        "recovered": {"total": int(recovered.sum()), "by_rule_fix": int(recovered.sum()) - by_alt,
                      "by_alternate_parcel": by_alt},
        "causes": causes,
        "remaining": [{"plant_id": int(p), "plant_name": n, "original_address": o,
                       "cause": addr.classify_failure(o, u, s)}
                      for p, n, o, u, s in zip(remaining["plant_id"], remaining["plant_name"],
                                               remaining["original_address"], remaining["address"],
                                               remaining["geocode_status"])],
    }


# ---------------------------------------------------------------- 분배 시뮬레이션 (Improve)
def allocation_section(src) -> dict:
    sc = src["sector"]
    surplus, res = alloc.surplus_from_sector(sc), alloc.resources_from_sector(sc)

    def compact(sim):
        return {"utilization_pct": r(sim["utilization_pct"]), "p2h_mwh": r(sim["p2h_mwh"]),
                "ess_mwh": r(sim["ess_mwh"]), "ev_mwh": r(sim["ev_mwh"]),
                "remaining_mwh": r(sim["remaining_mwh"]), "ess_uses": sim["ess_uses"]}

    variants = {"team_rule": alloc.run_cases(surplus, res),
                "soc": alloc.run_cases(surplus, res, soc=True),
                "soc_gap_discharge": alloc.run_cases(surplus, res, soc=True, discharge_in_gaps=True)}
    case1 = sc.iloc[:24]
    hourly = [{"hour": int(h), "generation_mwh": r(g), "surplus_mwh": r(s), "risk_score": r(rs, 4), "risk_level": lv}
              for h, g, s, rs, lv in zip(case1["시간"], case1["발전소_예측발전량_MWh"], case1["발전소_추정잉여전력_MWh"],
                                         case1["출력제한_위험점수"], case1["출력제한_위험_등급"])]
    return {
        "resources": alloc.resources_dict(res),
        "surplus_total_mwh": r(sum(surplus.values())),
        "hourly": hourly,
        "cases": {v: {k: compact(sim) for k, sim in cases.items()} for v, cases in variants.items()},
        "sensitivity": [{**x, "low_pp": r(x["low_pp"], 4), "high_pp": r(x["high_pp"], 4)}
                        for x in alloc.sensitivity(surplus, res)],
        "sizing": alloc.ess_sizing_curve(surplus, res),
        "capa": [{"target_pct": t, "ess_mwh": r(alloc.required_ess(surplus, res, t), 1),
                  "p2h_ratio_pct": r((alloc.required_p2h_ratio(surplus, res, t) or 0) * 100, 1)}
                 for t in (60, 70, 80, 90)],
    }


def build() -> dict:
    src = load_sources()
    fc = src["forecast"]
    checks = quality.run_checks(src)
    geo = geocode_section(src)
    allocation = allocation_section(src)
    events = patterns.alarm_events(fc)
    return {
        "meta": {"generated_at": datetime.now().isoformat(timespec="seconds"),
                 "forecast_date": str(fc["date"].iloc[0]),
                 "sources": {k: int(len(v)) for k, v in src.items()},
                 "limits": {"warn": patterns.WARN_LIMIT, "action": patterns.ACTION_LIMIT,
                            "sustain_hours": patterns.SUSTAIN_HOURS}},
        "quality": {"checks": checks, "summary": quality.summarize(checks)},
        "geocode": geo,
        "capacity": {**patterns.capacity_pareto(src["plants_raw"]["허가용량(킬로와트)"]),
                     "size_classes": patterns.size_classes(src["plants_raw"]["허가용량(킬로와트)"]),
                     "townships": patterns.township_breakdown(src["plants_map"]),
                     "permits": patterns.permit_vintage(src["plants_raw"])},
        "risk": {"heatmap": patterns.risk_heatmap(fc), "correlations": patterns.risk_correlations(fc),
                 "hourly_levels": patterns.hourly_level_counts(fc), "events": events,
                 "jeonnam_profile": patterns.hourly_profile(src["jeonnam_time"]),
                 "ocap": patterns.OCAP},
        "allocation": allocation,
    }


# ---------------------------------------------------------------- 보고서
def _table(header, rows):
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(str(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def write_report(a: dict):
    g, al, cap, risk = a["geocode"], a["allocation"], a["capacity"], a["risk"]
    status_ko = {"pass": "통과", "warn": "주의", "fail": "실패"}
    team, soc = al["cases"]["team_rule"], al["cases"]["soc"]
    sens = {s["factor"]: s for s in al["sensitivity"]}
    md = [
        "# SolarGrid 분석 보고서",
        "",
        f"자동 생성: {a['meta']['generated_at']} · 예측일 {a['meta']['forecast_date']} · "
        "생성 명령 `.venv\\Scripts\\python analysis\\run_analysis.py`",
        "",
        "## 1. 데이터 품질 게이트",
        "",
        _table(["구분", "검사", "기준", "결과", "판정"],
               [[c["category"], c["name"], c["target"], c["actual"], status_ko[c["status"]]] for c in a["quality"]["checks"]]),
        "",
        "## 2. 발전소 좌표화 수율과 근본원인",
        "",
        f"- 수율: {g['before']['yield_pct']}% → **{g['after']['yield_pct']}%** "
        f"(실패 {g['before']['failed']}기 → {g['after']['failed']}기)",
        f"- 회복 {g['recovered']['total']}기: 정규화 규칙 수정 {g['recovered']['by_rule_fix']}기, "
        f"대체 필지 검색 {g['recovered']['by_alternate_parcel']}기",
        "",
        _table(["원인", "수정 전", "수정 후", "규칙 결함"],
               [[c["cause"], c["before"], c["after"], "예" if c["rule_defect"] else ""] for c in g["causes"]]),
        "",
        "## 3. 설비 구조 (파레토 · ABC)",
        "",
        f"- 신안군 {cap['plants']:,}기 · {cap['total_mw']} MW, 상위 20% 발전소가 용량의 {cap['top20_pct']}%, "
        f"상위 40%가 {cap['top40_pct']}%",
        "",
        _table(["등급", "발전소 수", "발전소 비중", "용량 MW", "용량 비중"],
               [[c["grade"], c["plants"], f"{c['plant_pct']}%", c["capacity_mw"], f"{c['capacity_pct']}%"]
                for c in cap["abc"]]),
        "",
        "## 4. 위험 패턴과 관리 한계 경보",
        "",
        f"- 경고 한계 {a['meta']['limits']['warn']}, 조치 한계 {a['meta']['limits']['action']}, "
        f"{a['meta']['limits']['sustain_hours']}시간 이상 연속 경고는 '지속 경보'",
        "",
        _table(["지역", "구간", "지속(h)", "최고점", "등급", "지속 경보", "조치"],
               [[e["region"], f"{e['start_hour']}~{e['end_hour']}시", e["duration_h"], e["peak_score"], e["peak_level"],
                 "예" if e["sustained"] else "", e["action"]] for e in risk["events"][:12]]),
        "",
        "순위상관(주간): " + ", ".join(f"{x['label']} {x['spearman']:+.2f}" for x in risk["correlations"]["factors"]),
        "",
        "## 5. 잉여전력 분배 시뮬레이션",
        "",
        _table(["운전 전략", "팀 규칙 활용률", "SOC 반영 활용률", "ESS 가동"],
               [[k, f"{team[k]['utilization_pct']:.2f}%", f"{soc[k]['utilization_pct']:.2f}%", f"{team[k]['ess_uses']}회"]
                for k in team]),
        "",
        f"- 민감도(±10%, SOC 반영): P2H 전환비율 ±{sens['p2h_ratio']['high_pp']:.2f}%p, "
        f"ESS 용량 ±{sens['ess_mwh']['high_pp']:.3f}%p, EV ±{sens['ev_mwh_per_h']['high_pp']:.3f}%p",
        "",
        _table(["목표 활용률", "필요 ESS (P2H 50%)", "필요 P2H 비율 (ESS 현행)"],
               [[f"{c['target_pct']}%", "-" if c["ess_mwh"] is None else f"{c['ess_mwh']} MWh", f"{c['p2h_ratio_pct']}%"]
                for c in al["capa"]]),
        "",
    ]
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.write_text("\n".join(md), encoding="utf-8")


def main():
    analytics = build()
    OUT_JSON.write_text(json.dumps(analytics, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    write_report(analytics)
    s = analytics["quality"]["summary"]
    g = analytics["geocode"]
    print(f"품질 검사: 통과 {s['pass']} · 주의 {s['warn']} · 실패 {s['fail']}")
    print(f"좌표화 수율: {g['before']['yield_pct']}% → {g['after']['yield_pct']}%")
    print(f"출력: {OUT_JSON.relative_to(ROOT_DIR)}, {OUT_REPORT.relative_to(ROOT_DIR)}")


if __name__ == "__main__":
    main()
