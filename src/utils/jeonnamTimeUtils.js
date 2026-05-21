export const JEONNAM_NORMAL = '정상'
export const JEONNAM_CAUTION = '주의'

export function getJeonnamHour(hour) {
  const numericHour = Math.round(Number(hour))

  if (!Number.isFinite(numericHour)) {
    return 0
  }

  return Math.min(Math.max(numericHour, 0), 23)
}

export function calculateJeonnamRisk(cityRows, selectedHour) {
  const hour = getJeonnamHour(selectedHour)
  const maxGeneration = Math.max(
    0,
    ...cityRows.map((row) => Number(row.solar_generation) || 0),
  )
  const currentGeneration =
    Number(cityRows.find((row) => row.hour === hour)?.solar_generation) || 0

  if (maxGeneration <= 0 || currentGeneration <= 0) {
    return {
      generation_ratio: 0,
      risk_level: JEONNAM_NORMAL,
      risk_score: 0,
    }
  }

  const generationRatio = Math.min(currentGeneration / maxGeneration, 1)
  const isCautionWindow =
    (hour >= 11 && hour <= 14) ||
    (hour >= 9 && hour <= 10 && generationRatio >= 0.62) ||
    (hour >= 15 && hour <= 16 && generationRatio >= 0.55)
  const isCaution = generationRatio >= 0.45 && isCautionWindow

  if (isCaution) {
    return {
      generation_ratio: generationRatio,
      risk_level: JEONNAM_CAUTION,
      risk_score: Number(Math.max(45, Math.min(generationRatio * 69, 69)).toFixed(1)),
    }
  }

  return {
    generation_ratio: generationRatio,
    risk_level: JEONNAM_NORMAL,
    risk_score: Number(Math.min(generationRatio * 44, 44).toFixed(1)),
  }
}

export function buildJeonnamCityRows(coordinateRows, timeRows, selectedHour) {
  const hour = getJeonnamHour(selectedHour)
  const rowsByCity = groupRowsByCity(timeRows)

  return coordinateRows.map((region) => {
    const cityRows = rowsByCity.get(region.region) ?? []
    const currentRow = cityRows.find((row) => row.hour === hour)
    const risk = calculateJeonnamRisk(cityRows, hour)

    if (!currentRow) {
      return {
        ...region,
        generation_unit: 'MWh',
      }
    }

    return {
      ...region,
      cumulative_generation: currentRow.cumulative_generation,
      generation_ratio: risk.generation_ratio,
      generation_unit: 'MW',
      risk_level: risk.risk_level,
      risk_score: risk.risk_score,
      solar_generation: currentRow.solar_generation,
      temperature: currentRow.temperature,
    }
  })
}

export function buildJeonnamAggregateRows(timeRows) {
  const grouped = new Map()

  timeRows.forEach((row) => {
    const current = grouped.get(row.hour) ?? {
      cumulative_generation: 0,
      hour: row.hour,
      solar_generation: 0,
    }

    current.solar_generation += Number(row.solar_generation) || 0
    current.cumulative_generation += Number(row.cumulative_generation) || 0
    grouped.set(row.hour, current)
  })

  const rows = [...grouped.values()].sort((a, b) => a.hour - b.hour)
  const riskRows = rows.map((row) => ({
    hour: row.hour,
    solar_generation: row.solar_generation,
  }))

  return rows.map((row) => {
    const risk = calculateJeonnamRisk(riskRows, row.hour)

    return {
      ...row,
      risk_level: risk.risk_level,
      risk_score: risk.risk_score,
    }
  })
}

export function getCityRows(timeRows, city) {
  return timeRows
    .filter((row) => row.city === city)
    .sort((a, b) => a.hour - b.hour)
}

export function getSelectedCitySummary(timeRows, city, selectedHour) {
  const cityRows = getCityRows(timeRows, city)
  const hour = getJeonnamHour(selectedHour)
  const currentRow = cityRows.find((row) => row.hour === hour)
  const risk = calculateJeonnamRisk(cityRows, hour)

  if (!currentRow) {
    return null
  }

  return {
    ...currentRow,
    ...risk,
  }
}

export function getJeonnamRiskWindow(cityRows) {
  const riskyRows = cityRows.filter((row) => {
    const risk = calculateJeonnamRisk(cityRows, row.hour)
    return risk.risk_level === JEONNAM_CAUTION
  })

  if (riskyRows.length === 0) {
    return '-'
  }

  const hours = riskyRows.map((row) => row.hour)
  return `${formatHour(Math.min(...hours))}~${formatHour(Math.max(...hours))}`
}

export function groupRowsByCity(timeRows) {
  const grouped = new Map()

  timeRows.forEach((row) => {
    const cityRows = grouped.get(row.city) ?? []
    cityRows.push(row)
    grouped.set(row.city, cityRows)
  })

  grouped.forEach((rows) => rows.sort((a, b) => a.hour - b.hour))
  return grouped
}

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}
