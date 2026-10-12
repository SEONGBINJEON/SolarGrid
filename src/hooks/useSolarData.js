import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  hourlyForecast as fallbackHourlyForecast,
  jeonnamRegions,
  sinanPlants,
} from '../data/dummyData'
import {
  DEMO_PLANT_NAME,
  splitSectorCouplingCases,
} from '../utils/sectorCouplingUtils'

const numericColumns = new Set([
  'hour',
  'solar_generation',
  'solar_capacity',
  'generation_ratio',
  'temperature',
  'rainfall',
  'humidity',
  'irradiance',
  'cloud_total',
  'risk_score',
  '정상',
  '주의',
  '위험',
  '전체',
  '주의_위험_합계',
  '주의_위험_비율(%)',
  '위험_비율(%)',
  'lat',
  'lng',
  'peak_hour',
  'permitted_capacity_kw',
  'annual_generation_kwh',
  '출력제한_위험점수',
  '온도_C',
  '발전소_예측발전량_MWh',
  '발전소_추정잉여전력_MWh',
  'ESS_수용가능량_MWh',
  'EV_수용가능량_MWh',
  'P2H_수용가능량_MWh',
  'ESS_분배량_MWh',
  'EV_분배량_MWh',
  'P2H_분배량_MWh',
  '잔여_출력제한_MWh',
  '분배후_활용률_%',
])

export const regionCoordinates = {
  서울시: { lat: 37.5665, lng: 126.978 },
  부산시: { lat: 35.1796, lng: 129.0756 },
  대구시: { lat: 35.8714, lng: 128.6014 },
  인천시: { lat: 37.4563, lng: 126.7052 },
  광주시: { lat: 35.1595, lng: 126.8526 },
  대전시: { lat: 36.3504, lng: 127.3845 },
  울산시: { lat: 35.5384, lng: 129.3114 },
  세종시: { lat: 36.48, lng: 127.289 },
  경기도: { lat: 37.4138, lng: 127.5183 },
  강원도: { lat: 37.8228, lng: 128.1555 },
  충청북도: { lat: 36.6357, lng: 127.4917 },
  충청남도: { lat: 36.6588, lng: 126.6728 },
  전라북도: { lat: 35.7175, lng: 127.153 },
  전라남도: { lat: 34.816, lng: 126.463 },
  경상북도: { lat: 36.4919, lng: 128.8889 },
  경상남도: { lat: 35.4606, lng: 128.2132 },
  제주도: { lat: 33.4996, lng: 126.5312 },
}

function parseHour(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.includes(':')) {
    return Number(value.split(':')[0])
  }

  return Number(value)
}

function convertNumericFields(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!numericColumns.has(key) || value === '') {
        return [key, value]
      }

      return [key, key === 'hour' || key === 'peak_hour' ? parseHour(value) : Number(value)]
    }),
  )
}

async function parseCsv(path, requiredColumns) {
  const response = await fetch(path)

  if (!response.ok) {
    throw new Error(`${path} 로딩 실패`)
  }

  const csvText = (await response.text()).replace(/^\uFEFF/, '')
  const trimmedText = csvText.trimStart().toLowerCase()

  if (trimmedText.startsWith('<!doctype html') || trimmedText.startsWith('<html')) {
    throw new Error(`${path}가 CSV가 아닙니다.`)
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message)
  }

  const parsedColumns = parsed.meta.fields ?? []
  const missingColumns = requiredColumns.filter((column) => !parsedColumns.includes(column))

  if (missingColumns.length > 0) {
    throw new Error(`${path}에 필요한 컬럼이 없습니다: ${missingColumns.join(', ')}`)
  }

  return parsed.data.map(convertNumericFields)
}

function normalizeForecastRows(rows) {
  return rows.map((row) => {
    const coordinates = regionCoordinates[row.region]

    return {
      ...row,
      id: row.region,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
    }
  })
}

function normalizeJeonnamDemo(rows) {
  return rows.map((row) => ({
    ...row,
    id: row.id ?? row.region,
  }))
}

function normalizePlants(rows) {
  return rows.map((plant) => ({ ...plant }))
}

function normalizeShinanPlants(rows) {
  const normalizedPlants = rows.map((plant) => ({
    ...plant,
    region: plant.region ?? '전라남도',
    sub_region: plant.sub_region ?? '신안군',
    township: plant.township ?? plant.matched_township ?? '',
    installation_address:
      plant.installation_address ?? plant.address ?? plant.matched_address ?? plant.original_address ?? '',
    permitted_capacity_kw: plant.permitted_capacity_kw ?? plant.solar_capacity,
    annual_generation_kwh: plant.annual_generation_kwh,
  }))

  return normalizedPlants.sort((a, b) => {
    if (a.plant_name === DEMO_PLANT_NAME) return -1
    if (b.plant_name === DEMO_PLANT_NAME) return 1
    return 0
  })
}

function parseKoreanHour(value) {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : Number.NaN
}

function safeNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeJeonnamTimeData(rows) {
  return rows
    .map((row) => ({
      city: String(row.도시 ?? '').trim(),
      cumulative_generation: safeNumber(row.누적발전량),
      hour: parseKoreanHour(row.시간),
      solar_generation: safeNumber(row.발전량),
      temperature: safeNumber(row.기온, null),
      risk_score: safeNumber(row.risk_score, null),
      risk_level: String(row.risk_level ?? '').trim() || null,
    }))
    .filter((row) => row.city && Number.isFinite(row.hour))
}

function classifyRiskLevel(level) {
  if (level === '위험' || level === '매우 높음') {
    return '위험'
  }

  if (level === '주의' || level === '높음') {
    return '주의'
  }

  return '정상'
}

function buildFallbackForecastRows() {
  const fallbackRegions = [
    {
      region: '전라남도',
      solar_generation: 1840,
      solar_capacity: 2120,
      generation_ratio: 86.8,
      risk_score: 0.88,
      risk_level: '위험',
    },
    {
      region: '강원도',
      solar_generation: 740,
      solar_capacity: 980,
      generation_ratio: 75.5,
      risk_score: 0.42,
      risk_level: '주의',
    },
    {
      region: '인천시',
      solar_generation: 520,
      solar_capacity: 760,
      generation_ratio: 68.4,
      risk_score: 0.24,
      risk_level: '정상',
    },
    {
      region: '경상북도',
      solar_generation: 1310,
      solar_capacity: 1680,
      generation_ratio: 78,
      risk_score: 0.73,
      risk_level: '주의',
    },
    {
      region: '제주도',
      solar_generation: 910,
      solar_capacity: 1210,
      generation_ratio: 75.2,
      risk_score: 0.58,
      risk_level: '주의',
    },
  ]

  const summaryRows = fallbackRegions
    .filter((region) => region.region !== '전라남도')
    .map((region) => ({
    date: '2026-05-18',
    hour: 13,
    temperature: 27,
    rainfall: 0,
    humidity: 43,
    irradiance: 872,
    cloud_total: 1,
      ...region,
    }))

  const jeonnamHourlyRows = fallbackHourlyForecast.map((point) => ({
    date: '2026-05-18',
    hour: parseHour(point.hour),
    region: '전라남도',
    solar_generation: point.solar_generation,
    solar_capacity: 2120,
    generation_ratio: Number(((point.solar_generation / 2120) * 100).toFixed(1)),
    temperature: 27,
    rainfall: 0,
    humidity: 43,
    irradiance: 872,
    cloud_total: 1,
    risk_score: point.risk_score > 1 ? point.risk_score / 100 : point.risk_score,
    risk_level: classifyRiskLevel(point.risk_level),
  }))

  return normalizeForecastRows([...summaryRows, ...jeonnamHourlyRows])
}

const fallbackData = {
  forecastRows: buildFallbackForecastRows(),
  jeonnamDemo: normalizeJeonnamDemo(
    jeonnamRegions.map((region) => ({
      id: region.id,
      region: region.name,
      lat: region.lat,
      lng: region.lng,
      solar_generation: region.forecast_generation,
      solar_capacity: undefined,
      generation_ratio: undefined,
      risk_score: region.risk_score,
      risk_level: region.risk_level,
      curtailment_time: region.curtailment_time,
    })),
  ),
  plants: normalizePlants(
    sinanPlants.map((plant) => ({
      ...plant,
      peak_hour: parseHour(plant.peak_hour),
    })),
  ),
  jeonnamTimeData: [],
}

function useSolarData() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [forecastRows, setForecastRows] = useState(fallbackData.forecastRows)
  const [jeonnamDemo, setJeonnamDemo] = useState(fallbackData.jeonnamDemo)
  const [plants, setPlants] = useState(fallbackData.plants)
  const [shinanPlants, setShinanPlants] = useState([])
  const [jeonnamTimeData, setJeonnamTimeData] = useState(fallbackData.jeonnamTimeData)
  const [sectorCouplingCases, setSectorCouplingCases] = useState({
    case1: [],
    case2: [],
    case3: [],
  })

  useEffect(() => {
    let isMounted = true

    async function loadSolarData() {
      const [
        forecastResult,
        jeonnamResult,
        plantsResult,
        shinanPlantsResult,
        jeonnamTimeResult,
        sectorCouplingResult,
      ] =
        await Promise.allSettled([
          parseCsv('/data/future_curtailment_risk_result.csv', [
          'date',
          'hour',
          'region',
          'solar_generation',
          'solar_capacity',
          'generation_ratio',
          'temperature',
          'rainfall',
          'humidity',
          'irradiance',
          'cloud_total',
          'risk_score',
          'risk_level',
        ]),
        parseCsv('/data/jeonnam_demo.csv', [
          'id',
          'region',
          'lat',
          'lng',
          'solar_generation',
          'risk_score',
          'risk_level',
        ]),
          parseCsv('/data/plants.csv', [
          'plant_id',
          'plant_name',
          'region',
          'sub_region',
          'lat',
          'lng',
          'solar_capacity',
          'solar_generation',
          'risk_score',
          'risk_level',
          'peak_hour',
          'curtailment_time',
          ]),
          parseCsv('/data/plants_shinan_map.csv', [
            'plant_id',
            'plant_name',
            'region',
            'sub_region',
            'township',
            'lat',
            'lng',
            'solar_capacity',
            'solar_generation',
            'risk_score',
            'risk_level',
            'curtailment_time',
            'address',
          ]),
          parseCsv('/data/time_data.csv', [
            '시간',
            '도시',
            '발전량',
            '누적발전량',
            '기온',
            'risk_score',
            'risk_level',
          ]),
          parseCsv('/data/sector_coupling.csv', [
            '예측일자',
            '시간',
            '출력제한_위험_등급',
            '출력제한_위험점수',
            '온도_C',
            '발전소_예측발전량_MWh',
            '발전소_추정잉여전력_MWh',
            '적용순위',
            'ESS_제한_방식',
            'ESS_수용가능량_MWh',
            'EV_수용가능량_MWh',
            'P2H_수용가능량_MWh',
            'ESS_분배량_MWh',
            'EV_분배량_MWh',
            'P2H_분배량_MWh',
            '잔여_출력제한_MWh',
            '분배후_활용률_%',
          ]),
        ])

      if (!isMounted) {
        return
      }

      const nextForecastRows =
        forecastResult.status === 'fulfilled'
          ? normalizeForecastRows(forecastResult.value)
          : fallbackData.forecastRows
      const nextJeonnamDemo =
        jeonnamResult.status === 'fulfilled'
          ? normalizeJeonnamDemo(jeonnamResult.value)
          : fallbackData.jeonnamDemo
      const nextPlants =
        plantsResult.status === 'fulfilled'
          ? normalizePlants(plantsResult.value)
          : fallbackData.plants
      const nextShinanPlants =
        shinanPlantsResult.status === 'fulfilled'
          ? normalizeShinanPlants(shinanPlantsResult.value)
          : normalizeShinanPlants(nextPlants)
      const nextJeonnamTimeData =
        jeonnamTimeResult.status === 'fulfilled'
          ? normalizeJeonnamTimeData(jeonnamTimeResult.value)
          : fallbackData.jeonnamTimeData
      const nextSectorCouplingCases =
        sectorCouplingResult.status === 'fulfilled'
          ? splitSectorCouplingCases(sectorCouplingResult.value)
          : { case1: [], case2: [], case3: [] }

      setForecastRows(nextForecastRows)
      setJeonnamDemo(nextJeonnamDemo)
      setPlants(nextPlants)
      setShinanPlants(nextShinanPlants)
      setJeonnamTimeData(nextJeonnamTimeData)
      setSectorCouplingCases(nextSectorCouplingCases)

      if (
        forecastResult.status === 'rejected' ||
        jeonnamResult.status === 'rejected' ||
        plantsResult.status === 'rejected' ||
        shinanPlantsResult.status === 'rejected' ||
        jeonnamTimeResult.status === 'rejected' ||
        sectorCouplingResult.status === 'rejected'
      ) {
        setError(new Error('일부 CSV 로딩에 실패해 fallback 데이터를 표시하고 있습니다.'))
      } else {
        setError(null)
      }

      setLoading(false)
    }

    loadSolarData()

    return () => {
      isMounted = false
    }
  }, [])

  const availableDates = useMemo(
    () => [...new Set(forecastRows.map((row) => row.date))].sort(),
    [forecastRows],
  )
  const availableHours = useMemo(
    () => [...new Set(forecastRows.map((row) => row.hour))].sort((a, b) => a - b),
    [forecastRows],
  )

  return {
    loading,
    error,
    forecastRows,
    jeonnamDemo,
    plants,
    shinanPlants,
    jeonnamTimeData,
    sectorCouplingCases,
    availableDates,
    availableHours,
  }
}

export default useSolarData
