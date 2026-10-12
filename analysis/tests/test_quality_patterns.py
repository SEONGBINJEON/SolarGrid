import pandas as pd
import pytest

from solargrid.patterns import alarm_events, capacity_pareto, risk_level
from solargrid.quality import run_checks, summarize


@pytest.mark.parametrize("score, level", [(0.0, "정상"), (0.0499, "정상"), (0.05, "주의"), (0.3999, "주의"), (0.4, "위험")])
def test_risk_level_boundaries(score, level):
    assert risk_level(score) == level


def test_quality_gate_has_no_failures(sources):
    checks = run_checks(sources)
    assert summarize(checks)["fail"] == 0, [c for c in checks if c["status"] == "fail"]


def test_alarm_events_detect_sustained_runs():
    hours = list(range(1, 9))
    scores = [0.01, 0.06, 0.07, 0.45, 0.02, 0.06, 0.01, 0.01]
    df = pd.DataFrame({"region": "가", "hour": hours, "risk_score": scores})
    events = alarm_events(df)
    assert [(e["start_hour"], e["end_hour"]) for e in events] == [(2, 4), (6, 6)]
    first = events[0]
    assert first["sustained"] and first["action_limit_exceeded"] and first["peak_level"] == "위험"
    assert not events[1]["sustained"]


def test_capacity_pareto_abc_shares_sum_to_100():
    pareto = capacity_pareto(pd.Series([500, 300, 100, 50, 30, 20]))
    assert sum(c["capacity_pct"] for c in pareto["abc"]) == pytest.approx(100, abs=0.2)
    assert pareto["curve"][-1]["capacity_pct"] == pytest.approx(100)
