"""발전소 주소 정규화와 좌표화 실패 원인 분류.

해커톤 버전(`legacy_normalize_address`)은 '번지·호·외'를 주소 전체에서 지워서
'내호리 → 내리', '889번지2호 → 8892' 같은 부작용을 만들었다.
`normalize_address`는 이 표기를 숫자 뒤에 붙은 경우에만 처리한다.
"""
from __future__ import annotations

import math
import re

TOWNSHIPS = (
    "지도읍", "압해읍", "증도면", "임자면", "자은면", "비금면", "도초면",
    "흑산면", "하의면", "신의면", "장산면", "안좌면", "팔금면", "암태면",
)

# 좌표화 실패 원인 (근본원인 분석용 분류 체계)
CAUSE_SOURCE = "원천 표기 오류"
CAUSE_SERVER = "서버 오류"
CAUSE_NAME_DAMAGE = "규칙 부작용: 지명 훼손"
CAUSE_LOT_DAMAGE = "규칙 부작용: 지번 왜곡"
CAUSE_MULTI = "복수 지번 미검색"
CAUSE_MOUNTAIN = "산 지번 미검색"
CAUSE_OTHER = "기타 지번 미검색"
RULE_CAUSES = (CAUSE_NAME_DAMAGE, CAUSE_LOT_DAMAGE)


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value)) or str(value).strip() == ""


def _finish(address: str) -> str:
    """시도 접두어 보완과 띄어쓰기 정리 (두 버전 공통 후처리)."""
    if address and not address.startswith("전라남도"):
        address = ("전라남도 " + address) if address.startswith("신안군") else ("전라남도 신안군 " + address)
    for township in TOWNSHIPS:
        address = address.replace(township, township + " ")
    address = re.sub(r"([가-힣]+리)(산?\s*\d)", r"\1 \2", address)   # 광정리143 → 광정리 143
    address = re.sub(r"([가-힣]+동)(산?\s*\d)", r"\1 \2", address)
    address = re.sub(r"산\s*(\d)", r"산 \1", address)                 # 산4-1 → 산 4-1
    return re.sub(r"\s+", " ", address).strip()


def legacy_normalize_address(address) -> str:
    """해커톤 당시 규칙을 그대로 재현 (변경 전 기준선 비교용)."""
    if _is_missing(address):
        return ""
    address = re.sub(r"\s+", " ", str(address).strip())
    for token in ("번지", "호", "외", "(건물)"):
        address = address.replace(token, "")
    address = re.sub(r"\([^)]*\)", "", address)
    address = address.replace("압헤읍", "압해읍")
    if "," in address:
        address = address.split(",")[0].strip()
    return _finish(address)


def _clean_lot_notation(text: str) -> str:
    """'번지·호·외'를 숫자에 붙은 경우에만 지번 표기로 바꾼다."""
    text = re.sub(r"(\d+)\s*번지\s*(\d+)\s*호", r"\1-\2", text)    # 889번지2호 → 889-2
    text = re.sub(r"(\d+)\s*번지", r"\1", text)                    # 143번지 → 143
    text = re.sub(r"(\d)\s*호(?=$|\s|,)", r"\1", text)            # 1786-4호 → 1786-4
    text = re.sub(r"(\d)\s*외\s*\d*\s*(?:필지)?", r"\1", text)     # 1225-35외1 → 1225-35
    return text


def normalize_address(address) -> str:
    """Kakao 주소 검색에 넣을 정규화 주소. 복수 지번이면 첫 필지만 남긴다."""
    if _is_missing(address):
        return ""
    address = re.sub(r"\s+", " ", str(address).strip())
    address = re.sub(r"\([^)]*\)", "", address)      # (건물), (1225-7) 같은 부가정보
    address = address.replace("압헤읍", "압해읍")      # 원천 데이터 오타
    if "," in address:
        address = address.split(",")[0].strip()
    return _finish(_clean_lot_notation(address))


def parcel_candidates(original_address, limit: int = 6) -> list[str]:
    """복수 지번 주소에서 검색 후보를 순서대로 만든다.

    쉼표 뒤 필지와 괄호 안 대체 필지를 모두 후보로 쓴다.
    예) '…대초리산4-1,산4-2,1650-50' → ['… 대초리 산 4-1', '… 대초리 산 4-2', '… 대초리 1650-50']
        '…복룡리1225-35외1(1225-7)'  → ['… 복룡리 1225-35', '… 복룡리 1225-7']
    """
    first = normalize_address(original_address)
    candidates = [first] if first else []
    if _is_missing(original_address):
        return candidates
    parts = re.split(r"[,()]", str(original_address).replace("(건물)", ""))
    if len(parts) < 2:
        return candidates
    head = re.match(r"^(.*?(?:리|동))\s+(?:산\s*)?\d", first)
    if not head:
        return candidates
    prefix = head.group(1)
    for token in parts[1:]:
        token = _clean_lot_notation(re.sub(r"\s+", "", token))
        lot = re.fullmatch(r"(산)?(\d+(?:-\d+)?)", token)
        if not lot:
            continue
        candidate = f"{prefix} {'산 ' if lot.group(1) else ''}{lot.group(2)}"
        if candidate not in candidates:
            candidates.append(candidate)
        if len(candidates) >= limit:
            break
    return candidates


def extract_township(address) -> str:
    text = "" if _is_missing(address) else str(address)
    for township in TOWNSHIPS:
        if township in text:
            return township
    return ""


def ri_name(address) -> str | None:
    """읍·면 바로 뒤의 리(동) 이름. 도로명 주소 등에서는 None."""
    if _is_missing(address):
        return None
    found = re.search(r"(?:읍|면)\s*([가-힣]{1,6}?(?:리|동))(?=\s*(?:산\s*)?\d|\s|,|$)", str(address))
    return found.group(1) if found else None


def classify_failure(original_address, used_address, status) -> str:
    """좌표화에 실패한 한 건의 원인을 분류한다 (위에서부터 우선 적용)."""
    if re.search(r"\d{6,}", str(original_address)):
        return CAUSE_SOURCE          # 예: '890891-1892881884887888' 처럼 구분자가 빠진 지번 (수기 검토 대상)
    if status not in ("no_result", "empty_address"):
        return CAUSE_SERVER
    original_ri, used_ri = ri_name(original_address), ri_name(used_address)
    if original_ri and used_ri and original_ri != used_ri:
        return CAUSE_NAME_DAMAGE
    if str(used_address) not in parcel_candidates(original_address):
        return CAUSE_LOT_DAMAGE
    if len(parcel_candidates(original_address)) > 1:
        return CAUSE_MULTI
    if " 산 " in f" {used_address} ":
        return CAUSE_MOUNTAIN
    return CAUSE_OTHER
