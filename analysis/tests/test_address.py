import pytest

from solargrid.address import (
    CAUSE_LOT_DAMAGE,
    CAUSE_NAME_DAMAGE,
    CAUSE_SOURCE,
    classify_failure,
    legacy_normalize_address,
    normalize_address,
    parcel_candidates,
    ri_name,
)

P = "전라남도 신안군 "


@pytest.mark.parametrize("raw, expected", [
    ("전라남도 신안군 안좌면 내호리 222-3, 500", P + "안좌면 내호리 222-3"),       # 지명 속 '호' 보존
    ("전라남도 신안군 안좌면 복호리 22, 23", P + "안좌면 복호리 22"),
    ("전라남도 신안군 안좌면 읍동리889번지2호", P + "안좌면 읍동리 889-2"),         # 번지N호 → 본번-부번
    ("전라남도 신안군 압해읍 복룡리1225-35외1(1225-7)", P + "압해읍 복룡리 1225-35"),  # '외N' 제거
    ("전라남도 신안군 지도읍감정리2002외5필지(2003,2004)", P + "지도읍 감정리 2002"),
    ("전라남도 신안군 비금면덕산리145번지48호(건물)", P + "비금면 덕산리 145-48"),
    ("전라남도 신안군 증도면대초리산4-1,산4-2", P + "증도면 대초리 산 4-1"),        # 띄어쓰기·산 번지
    ("신안군 압헤읍 신용리 513", P + "압해읍 신용리 513"),                          # 접두어·오타 보정
    ("", ""),
])
def test_normalize_address(raw, expected):
    assert normalize_address(raw) == expected


def test_legacy_rule_had_side_effects():
    assert legacy_normalize_address("전라남도 신안군 안좌면 내호리 5") == P + "안좌면 내리 5"
    assert legacy_normalize_address("전라남도 신안군 안좌면 읍동리889번지2호") == P + "안좌면 읍동리 8892"


def test_legacy_rule_reproduces_hackathon_output(baseline_map):
    """기준선(해커톤 결과)의 정규화 주소를 legacy 함수가 한 건도 빠짐없이 재현해야 비교가 공정하다."""
    reproduced = baseline_map["original_address"].map(legacy_normalize_address)
    assert (reproduced == baseline_map["address"].astype(str)).all()


def test_rule_fix_only_touches_failed_rows(baseline_map):
    """수정 규칙이 바꾸는 주소는 모두 기존 실패 건이어야 한다 (기존 성공 좌표 보호)."""
    changed = baseline_map["original_address"].map(normalize_address) != baseline_map["address"].astype(str)
    assert changed.sum() > 0
    assert (baseline_map.loc[changed, "geocode_status"] != "ok").all()


def test_parcel_candidates_use_commas_and_parentheses():
    assert parcel_candidates("전라남도 신안군 증도면대초리산4-1,산4-2,1650-50") == [
        P + "증도면 대초리 산 4-1", P + "증도면 대초리 산 4-2", P + "증도면 대초리 1650-50"]
    assert parcel_candidates("전라남도 신안군 압해읍 복룡리1225-35외1(1225-7)") == [
        P + "압해읍 복룡리 1225-35", P + "압해읍 복룡리 1225-7"]
    assert len(parcel_candidates("전라남도 신안군 안좌면 내호리 260,260-2,260-3,238,328,1,2")) == 6  # 상한


def test_ri_name():
    assert ri_name("전라남도 신안군 안좌면 읍동리 889-2") == "읍동리"
    assert ri_name(P + "지도읍 읍내리 854") == "읍내리"
    assert ri_name(None) is None


def test_classify_failure():
    raw = "전라남도 신안군 안좌면 내호리 5"
    assert classify_failure(raw, legacy_normalize_address(raw), "no_result") == CAUSE_NAME_DAMAGE
    raw = "전라남도 신안군 압해읍 복룡리1786번지4호"
    assert classify_failure(raw, legacy_normalize_address(raw), "no_result") == CAUSE_LOT_DAMAGE
    raw = "전라남도 신안군 지도읍태천리890891-1892881884887888"
    assert classify_failure(raw, normalize_address(raw), "http_500") == CAUSE_SOURCE
