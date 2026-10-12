// 잉여전력 분배 시뮬레이터 (analysis/solargrid/allocation.py 와 같은 규칙)
//
// - P2H는 매시간 잉여의 p2hRatio를 열로 전환한다 (시간당 한도 이내).
// - ESS는 남은 잉여를 용량까지 충전한다. soc=true면 잉여 시간 사이에 방전하지 않는다고 보고
//   누적 충전량을 용량으로 제한한다.
// - EV는 남은 잉여를 시간당 수용량까지 충전하고, 나머지는 잔여 출력제한이다.

export const DEFAULT_RESOURCES = {
  essMwh: 0.996,
  evMwhPerH: 0.1,
  p2hMwhPerH: 69.8648,
  p2hRatio: 0.5,
}

export const ESS_MODES = [
  { id: 'unlimited', label: 'ESS 제한 없음', caseLabel: 'Case 1', peaks: null },
  { id: 'peak1', label: 'ESS 피크 1회', caseLabel: 'Case 2', peaks: 1 },
  { id: 'peak2', label: 'ESS 피크 2회', caseLabel: 'Case 3', peaks: 2 },
]

const sumBy = (rows, key) => rows.reduce((total, row) => total + row[key], 0)

export function surplusFromRows(rows = []) {
  return rows
    .filter((row) => Number(row.surplus_mwh) > 0 && Number.isFinite(Number(row.hour)))
    .map((row) => ({ hour: Number(row.hour), surplus: Number(row.surplus_mwh) }))
    .sort((a, b) => a.hour - b.hour)
}

export function resourcesFromRows(rows = []) {
  const first = rows[0]
  if (!first) {
    return { ...DEFAULT_RESOURCES }
  }
  const positive = rows.find((row) => Number(row.surplus_mwh) > 0)
  return {
    essMwh: Number(first.ess_capacity_mwh) || DEFAULT_RESOURCES.essMwh,
    evMwhPerH: Number(first.ev_capacity_mwh) || DEFAULT_RESOURCES.evMwhPerH,
    p2hMwhPerH: Number(first.p2h_capacity_mwh) || DEFAULT_RESOURCES.p2hMwhPerH,
    p2hRatio: positive
      ? Number(positive.p2h_allocation_mwh) / Number(positive.surplus_mwh)
      : DEFAULT_RESOURCES.p2hRatio,
  }
}

export function peakHours(surplus, count) {
  if (count == null) {
    return null
  }
  return new Set(
    [...surplus]
      .sort((a, b) => b.surplus - a.surplus)
      .slice(0, count)
      .map((item) => item.hour),
  )
}

export function simulateAllocation(
  surplus,
  resources = DEFAULT_RESOURCES,
  { essHours = null, soc = false, dischargeInGaps = false } = {},
) {
  let stored = 0
  let previousHour = null
  const hourly = [...surplus]
    .sort((a, b) => a.hour - b.hour)
    .map(({ hour, surplus: amount }) => {
      if (dischargeInGaps && previousHour !== null && hour - previousHour > 1) {
        stored = 0
      }
      previousHour = hour
      const p2h = Math.min(resources.p2hRatio * amount, resources.p2hMwhPerH)
      const room = amount - p2h
      const allowed = !essHours || essHours.has(hour)
      const limit = soc ? resources.essMwh - stored : resources.essMwh
      const ess = allowed ? Math.max(0, Math.min(room, limit)) : 0
      stored += ess
      const ev = Math.max(0, Math.min(resources.evMwhPerH, room - ess))
      return {
        hour,
        surplus: amount,
        p2h,
        ess,
        ev,
        remaining: amount - p2h - ess - ev,
        soc: soc ? stored : null,
      }
    })

  const surplusMwh = sumBy(hourly, 'surplus')
  const absorbedMwh = sumBy(hourly, 'p2h') + sumBy(hourly, 'ess') + sumBy(hourly, 'ev')
  return {
    hourly,
    surplusMwh,
    p2hMwh: sumBy(hourly, 'p2h'),
    essMwh: sumBy(hourly, 'ess'),
    evMwh: sumBy(hourly, 'ev'),
    remainingMwh: sumBy(hourly, 'remaining'),
    absorbedMwh,
    utilizationPct: surplusMwh > 0 ? (absorbedMwh / surplusMwh) * 100 : 0,
    essUses: hourly.filter((row) => row.ess > 1e-9).length,
  }
}

function bisect(fn, target, low, high, iterations = 50) {
  if (fn(high) < target) {
    return null
  }
  let lo = low
  let hi = high
  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) / 2
    if (fn(mid) >= target) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}

// 목표 활용률을 맞추는 최소 ESS 용량 (CAPA 역산)
export function requiredEss(surplus, resources, targetPct, { soc = true, maxMwh = 500 } = {}) {
  return bisect(
    (essMwh) => simulateAllocation(surplus, { ...resources, essMwh }, { soc }).utilizationPct,
    targetPct,
    0,
    maxMwh,
  )
}

// 목표 활용률을 맞추는 최소 P2H 전환비율
export function requiredP2hRatio(surplus, resources, targetPct, { soc = true } = {}) {
  return bisect(
    (p2hRatio) => simulateAllocation(surplus, { ...resources, p2hRatio }, { soc }).utilizationPct,
    targetPct,
    0,
    1,
  )
}
