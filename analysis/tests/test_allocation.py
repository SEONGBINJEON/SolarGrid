from dataclasses import replace

import pytest

from solargrid.allocation import (
    Resources,
    peak_hours,
    required_ess,
    required_p2h_ratio,
    resources_from_sector,
    run_cases,
    sensitivity,
    simulate,
    surplus_from_sector,
)


@pytest.fixture(scope="module")
def setup(sources):
    return surplus_from_sector(sources["sector"]), resources_from_sector(sources["sector"])


def test_reproduces_team_results(sources, setup):
    """팀이 해커톤에서 낸 Case 1~3 활용률을 0.01%p 이내로 재현한다 (회귀 기준)."""
    surplus, res = setup
    reference = sources["sector_compare"].set_index("구분")["분배후_활용률_%"]
    for name, sim in run_cases(surplus, res).items():
        assert sim["utilization_pct"] == pytest.approx(float(reference[name]), abs=0.01)


def test_energy_balance_every_hour(setup):
    surplus, res = setup
    for soc in (False, True):
        for h in simulate(surplus, res, soc=soc)["hourly"]:
            assert h["p2h"] + h["ess"] + h["ev"] + h["remaining"] == pytest.approx(h["surplus"])
            assert h["remaining"] >= -1e-9


def test_soc_makes_case1_equal_case2(setup):
    """1 MWh급 ESS는 방전 없이 여러 번 충전할 수 없으므로 Case 1의 실현값은 Case 2와 같다."""
    surplus, res = setup
    soc = run_cases(surplus, res, soc=True)
    assert soc["ESS 제한 없음"]["utilization_pct"] == pytest.approx(soc["ESS 피크 1회"]["utilization_pct"])
    gap = run_cases(surplus, res, soc=True, discharge_in_gaps=True)
    team = run_cases(surplus, res)
    assert gap["ESS 제한 없음"]["utilization_pct"] == pytest.approx(team["ESS 피크 2회"]["utilization_pct"])


def test_soc_never_exceeds_capacity(setup):
    surplus, res = setup
    for e in (1, 10, 40):
        sim = simulate(surplus, replace(res, ess_mwh=e), soc=True)
        assert max(h["ess_soc"] for h in sim["hourly"]) <= e + 1e-9


def test_utilization_is_monotonic(setup):
    surplus, res = setup
    by_ess = [simulate(surplus, replace(res, ess_mwh=e), soc=True)["utilization_pct"] for e in range(0, 70, 5)]
    by_ratio = [simulate(surplus, replace(res, p2h_ratio=x / 10), soc=True)["utilization_pct"] for x in range(11)]
    assert by_ess == sorted(by_ess)
    assert by_ratio == sorted(by_ratio)


def test_capacity_solver_hits_target(setup):
    surplus, res = setup
    ess = required_ess(surplus, res, 60)
    assert ess == pytest.approx(15.5, abs=0.1)
    assert simulate(surplus, replace(res, ess_mwh=ess), soc=True)["utilization_pct"] >= 60 - 1e-6
    ratio = required_p2h_ratio(surplus, res, 70)
    assert simulate(surplus, replace(res, p2h_ratio=ratio), soc=True)["utilization_pct"] >= 70 - 1e-6


def test_sensitivity_ranks_p2h_first(setup):
    surplus, res = setup
    swings = {s["factor"]: s["high_pp"] - s["low_pp"] for s in sensitivity(surplus, res)}
    assert max(swings, key=swings.get) == "p2h_ratio"


def test_peak_hours():
    assert peak_hours({11: 65.0, 13: 41.0, 14: 40.0}, 2) == {11, 13}
    assert peak_hours({11: 1.0}, None) is None


def test_default_resources_match_csv(setup):
    _, res = setup
    assert res == Resources(0.996, 0.1, 69.8648, 0.5)
