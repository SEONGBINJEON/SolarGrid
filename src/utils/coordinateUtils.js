// CSV의 빈 칸은 Number('') === 0 이 되어 (0, 0) 좌표로 오인된다.
// 좌표화에 실패한 발전소가 '지도 표시'로 집계되지 않도록 빈 값을 먼저 걸러낸다.
export function toCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function hasValidPlantCoordinate(plant) {
  return toCoordinate(plant?.lat) !== null && toCoordinate(plant?.lng) !== null
}
