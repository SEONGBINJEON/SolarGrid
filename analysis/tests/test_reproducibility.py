import json

import run_analysis


def _write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def test_check_ignores_run_timestamp_and_catches_drift(tmp_path, monkeypatch, capsys):
    committed = {"meta": {"generated_at": "2026-10-12T00:00:00", "forecast_date": "2026-05-22"},
                 "quality": {"summary": {"pass": 11, "warn": 2, "fail": 0}}}
    out = tmp_path / "analytics.json"
    _write(out, committed)
    monkeypatch.setattr(run_analysis, "OUT_JSON", out)
    monkeypatch.setattr(run_analysis, "ROOT_DIR", tmp_path)

    rerun = json.loads(json.dumps(committed))
    rerun["meta"]["generated_at"] = "2026-10-13T09:30:00"
    assert run_analysis.check(rerun) == 0

    rerun["quality"]["summary"]["pass"] = 10
    assert run_analysis.check(rerun) == 1
    assert "quality" in capsys.readouterr().out


def test_committed_analytics_matches_pipeline():
    # 원천 데이터나 분석 코드를 바꾸고 analytics.json을 다시 만들지 않으면 실패한다.
    assert run_analysis.check(run_analysis.build()) == 0
