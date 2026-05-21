export const DEMO_PLANT_NAME = '안좌솔민발전소제1호태양광발전소'

export function normalizeSearchText(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase()
}

export function isDemoPlant(plant) {
  return normalizeSearchText(plant?.plant_name) === normalizeSearchText(DEMO_PLANT_NAME)
}

export function matchesDemoPlantSearch(query) {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return false
  }

  return (
    normalizeSearchText(DEMO_PLANT_NAME).includes(normalizedQuery) ||
    normalizedQuery.includes(normalizeSearchText('안좌솔민'))
  )
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeSectorRow(row) {
  const hour = toNumber(row.시간, null)

  return {
    date: String(row.예측일자 ?? '').trim(),
    hour,
    risk_level: String(row.출력제한_위험_등급 ?? '').trim() || '정상',
    risk_score: toNumber(row.출력제한_위험점수),
    temperature_c: toNumber(row.온도_C, null),
    solar_generation: toNumber(row.발전소_예측발전량_MWh),
    surplus_mwh: toNumber(row.발전소_추정잉여전력_MWh),
    priority: String(row.적용순위 ?? '').trim(),
    ess_limit_method: String(row.ESS_제한_방식 ?? '').trim(),
    ess_capacity_mwh: toNumber(row.ESS_수용가능량_MWh),
    ev_capacity_mwh: toNumber(row.EV_수용가능량_MWh),
    p2h_capacity_mwh: toNumber(row.P2H_수용가능량_MWh),
    ess_allocation_mwh: toNumber(row.ESS_분배량_MWh),
    ev_allocation_mwh: toNumber(row.EV_분배량_MWh),
    p2h_allocation_mwh: toNumber(row.P2H_분배량_MWh),
    remaining_curtailment_mwh: toNumber(row.잔여_출력제한_MWh),
    utilization_pct: toNumber(row['분배후_활용률_%']),
  }
}

export function splitSectorCouplingCases(rows) {
  const normalizedRows = rows
    .map(normalizeSectorRow)
    .filter((row) => Number.isFinite(row.hour))

  return {
    case1: normalizedRows.slice(0, 24),
    case2: normalizedRows.slice(24, 48),
    case3: normalizedRows.slice(48, 72),
  }
}

export function getCase1Rows(sectorCouplingCases) {
  return sectorCouplingCases?.case1 ?? []
}

export function getSectorPointForHour(rows, selectedHour = 13) {
  if (!rows?.length) {
    return null
  }

  return (
    rows.find((row) => row.hour === selectedHour) ??
    rows.find((row) => row.hour === 13) ??
    rows[0]
  )
}

export function getPeakSectorPoint(rows) {
  if (!rows?.length) {
    return null
  }

  return rows.reduce((peak, row) =>
    Number(row.solar_generation) > Number(peak.solar_generation) ? row : peak,
  )
}

function formatHourRange(start, end) {
  const startLabel = `${String(start).padStart(2, '0')}:00`

  if (start === end) {
    return startLabel
  }

  return `${startLabel}~${String(end).padStart(2, '0')}:00`
}

export function formatCurtailmentWindow(rows) {
  const riskyHours = rows
    ?.filter((row) => Number(row.surplus_mwh) > 0)
    .map((row) => row.hour)
    .sort((a, b) => a - b)

  if (!riskyHours?.length) {
    return '-'
  }

  const ranges = []
  let rangeStart = riskyHours[0]
  let previousHour = riskyHours[0]

  riskyHours.slice(1).forEach((hour) => {
    if (hour === previousHour + 1) {
      previousHour = hour
      return
    }

    ranges.push(formatHourRange(rangeStart, previousHour))
    rangeStart = hour
    previousHour = hour
  })

  ranges.push(formatHourRange(rangeStart, previousHour))
  return ranges.join(', ')
}

export function getDemoPlantMetrics(plant, case1Rows, selectedHour = 13) {
  if (!isDemoPlant(plant) || !case1Rows?.length) {
    return null
  }

  const selectedPoint = getSectorPointForHour(case1Rows, selectedHour)
  const peakPoint = getPeakSectorPoint(case1Rows)
  const curtailmentWindow = formatCurtailmentWindow(case1Rows)

  return {
    forecast_mwh: selectedPoint?.solar_generation,
    risk_level: selectedPoint?.risk_level,
    risk_score: selectedPoint?.risk_score,
    curtailment_window: curtailmentWindow,
    peak_hour: peakPoint?.hour,
  }
}
