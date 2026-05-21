import {
  formatRiskScore,
  getRiskMessage,
  sortByRiskScore,
  toRiskPercent,
} from '../utils/riskUtils'
import {
  getCityRows,
  getJeonnamRiskWindow,
  getSelectedCitySummary,
} from '../utils/jeonnamTimeUtils'
import ForecastChart from './ForecastChart'
import RiskBadge from './RiskBadge'

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function getPeakRiskWindow(rows) {
  const riskyRows = rows.filter((row) => toRiskPercent(row.risk_score) >= 70)

  if (riskyRows.length === 0) {
    return '-'
  }

  const hours = riskyRows.map((row) => row.hour)
  return `${formatHour(Math.min(...hours))}~${formatHour(Math.max(...hours))}`
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-[20px] font-semibold leading-tight tracking-[-0.03em] text-slate-950">
        {value}
      </p>
    </div>
  )
}

function formatNumber(value, fractionDigits = 1) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return '-'
  }

  return numberValue.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: Number.isInteger(numberValue) ? 0 : fractionDigits,
  })
}

function formatValue(value, unit = '', fractionDigits = 1) {
  const formatted = formatNumber(value, fractionDigits)
  return formatted === '-' || unit === '' ? formatted : `${formatted} ${unit}`
}

function hasValidPlantCoordinate(plant) {
  return Number.isFinite(Number(plant.lat)) && Number.isFinite(Number(plant.lng))
}

function getPanelTitle({ selectedPlant, viewLevel }) {
  if (selectedPlant) {
    return '발전소 현황'
  }

  if (viewLevel === 'jeonnam') {
    return '지역 현황'
  }

  if (viewLevel === 'sinan') {
    return '도시 현황'
  }

  return '전국 현황'
}

function PanelHeader({ selectedPlant, viewLevel }) {
  return (
    <div className="panel-overview-header">
      <p>AI 발전량 예측 기반 출력제어 모니터링</p>
      <h2>{getPanelTitle({ selectedPlant, viewLevel })}</h2>
    </div>
  )
}

function ViewDetailAction({ onClick }) {
  if (!onClick) {
    return null
  }

  return (
    <button className="sector-action-button" onClick={onClick} type="button">
      상세 보기
    </button>
  )
}

function RiskList({ items, title }) {
  return (
    <section className="mt-5">
      <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
        {title}
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            className="flex items-center justify-between rounded-[7px] border border-slate-100 bg-slate-50 px-3 py-2"
            key={item.id ?? item.region ?? item.city}
          >
            <span className="text-[14px] font-semibold text-slate-900">
              {item.region ?? item.city}
            </span>
            <div className="flex items-center gap-2 text-right text-[12px] font-medium leading-5 text-slate-500">
              <span>{formatRiskScore(item.risk_score)}점</span>
              <RiskBadge level={item.risk_level} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function NationalOverview({
  forecastRows,
  plants,
  selectedDate,
  selectedHour,
  selectedRegion,
}) {
  const currentRows = forecastRows.filter(
    (row) => row.date === selectedDate && row.hour === selectedHour,
  )
  const selectedRegionRows = forecastRows.filter(
    (row) => row.date === selectedDate && row.region === selectedRegion?.region,
  )
  const totalGeneration = currentRows.reduce(
    (sum, region) => sum + (Number(region.solar_generation) || 0),
    0,
  )
  const totalCapacity = currentRows.reduce(
    (sum, region) => sum + (Number(region.solar_capacity) || 0),
    0,
  )
  const maxRiskPoint = sortByRiskScore(currentRows)[0]
  const topFive = sortByRiskScore(currentRows).slice(0, 5)

  return (
    <>
      <div>
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
          선택 시점
        </p>
        <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          {selectedDate || '-'} {formatHour(selectedHour)}
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="표시 지역 수" value={`${currentRows.length}개`} />
        <Metric label="전체 발전소 수" value={`${plants.length}개`} />
        <Metric label="전체 설비용량" value={formatValue(totalCapacity, 'MW', 0)} />
        <Metric label="총 예측 발전량" value={formatValue(totalGeneration, 'MWh')} />
      </div>

      <div className="panel-section mt-4 border-rose-100 bg-rose-50/60">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            최대 위험 지역
          </span>
          <RiskBadge level={maxRiskPoint?.risk_level ?? '정상'} />
        </div>
        <p className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
          {maxRiskPoint?.region ?? '데이터 없음'}
        </p>
        <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
          위험도 점수 {formatRiskScore(maxRiskPoint?.risk_score)}점
        </p>
      </div>

      {selectedRegion && (
        <section className="mt-5">
          <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
            선택 지역 정보
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="지역" value={selectedRegion.region} />
            <Metric label="위험도" value={<RiskBadge level={selectedRegion.risk_level} />} />
            <Metric
              label="예측 발전량"
              value={formatValue(selectedRegion.solar_generation, 'MWh')}
            />
            <Metric
              label="설비용량"
              value={formatValue(selectedRegion.solar_capacity, 'MW')}
            />
            <Metric
              label="위험도 점수"
              value={`${formatRiskScore(selectedRegion.risk_score)}점`}
            />
            <Metric label="출력제어 예상" value={getPeakRiskWindow(selectedRegionRows)} />
          </div>
        </section>
      )}

      <RiskList items={topFive} title="위험 지역 TOP 5" />
    </>
  )
}

function JeonnamOverview({ jeonnamRows, selectedHour }) {
  const totalGeneration = jeonnamRows.reduce(
    (sum, row) => sum + (Number(row.solar_generation) || 0),
    0,
  )
  const totalCumulativeGeneration = jeonnamRows.reduce(
    (sum, row) => sum + (Number(row.cumulative_generation) || 0),
    0,
  )
  const topRiskRows = sortByRiskScore(jeonnamRows).slice(0, 5)
  const maxRiskPoint = topRiskRows[0]

  return (
    <>
      <div>
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
          선택 지역
        </p>
        <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          전라남도 · {formatHour(selectedHour)}
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="표시 도시 수" value={`${jeonnamRows.length}개`} />
        <Metric label="현재 발전량 합계" value={formatValue(totalGeneration, 'MW')} />
        <Metric
          label="예측 발전량 합계"
          value={formatValue(totalCumulativeGeneration, 'MWh')}
        />
        <Metric
          label="최고 위험 점수"
          value={`${formatRiskScore(maxRiskPoint?.risk_score)}점`}
        />
      </div>

      <div className="panel-section mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            최고 위험 도시
          </span>
          <RiskBadge level={maxRiskPoint?.risk_level ?? '정상'} />
        </div>
        <p className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
          {maxRiskPoint?.region ?? '데이터 없음'}
        </p>
        <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
          위험도 점수 {formatRiskScore(maxRiskPoint?.risk_score)}점
        </p>
      </div>

      <RiskList items={topRiskRows.slice(0, 5)} title="위험 도시 TOP 5" />
    </>
  )
}

function SinanOverview({ selectedHour, shinanPlants, sinanRiskWindow, sinanSummary }) {
  const visiblePlants = shinanPlants.filter(hasValidPlantCoordinate)
  const failedPlants = shinanPlants.length - visiblePlants.length

  return (
    <>
      <div>
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
          선택 도시
        </p>
        <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          신안군 · {formatHour(selectedHour)}
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="전체 발전소 수" value={`${shinanPlants.length.toLocaleString()}개`} />
        <Metric label="지도 표시 발전소" value={`${visiblePlants.length.toLocaleString()}개`} />
        <Metric
          label="현재 발전량"
          value={formatValue(sinanSummary?.solar_generation, 'MW')}
        />
        <Metric
          label="누적 발전량"
          value={formatValue(sinanSummary?.cumulative_generation, 'MWh')}
        />
        <Metric label="기온" value={formatValue(sinanSummary?.temperature, '°C')} />
        <Metric
          label="위험도 점수"
          value={`${formatRiskScore(sinanSummary?.risk_score)}점`}
        />
      </div>

      <div className="panel-section mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            신안군 위험도
          </span>
          <RiskBadge level={sinanSummary?.risk_level ?? '정상'} />
        </div>
        <p className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
          출력제어 예상 {sinanRiskWindow}
        </p>
        <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
          좌표 변환 실패 발전소 {failedPlants.toLocaleString()}개는 지도에서 제외됩니다.
        </p>
      </div>
    </>
  )
}

function PlantDetail({ onPlantDetailOpen, plant }) {
  const isShinanPlant =
    plant.sub_region === '신안군' ||
    plant.township !== undefined ||
    plant.address !== undefined ||
    plant.installation_address !== undefined

  if (isShinanPlant) {
    return (
      <>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
              선택 발전소
            </p>
            <h2 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.03em] text-slate-950">
              {plant.plant_name}
            </h2>
          </div>
          <RiskBadge level={plant.risk_level} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="읍면" value={plant.township || plant.matched_township || '-'} />
          <Metric
            label="설비용량"
            value={formatValue(plant.permitted_capacity_kw ?? plant.solar_capacity, 'kW')}
          />
          <Metric
            label="예측 발전량"
            value={formatValue(plant.solar_generation ?? plant.annual_generation_kwh, 'MWh')}
          />
          <Metric label="위험도 점수" value={`${formatRiskScore(plant.risk_score)}점`} />
          <Metric label="위험도 등급" value={<RiskBadge level={plant.risk_level} />} />
          <Metric label="출력제어 예상" value={plant.curtailment_time || '-'} />
        </div>

        <div className="panel-section mt-4">
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            주소
          </p>
          <p className="mt-3 text-[13px] leading-6 text-slate-700">
            {plant.installation_address ||
              plant.address ||
              plant.matched_address ||
              plant.original_address ||
              '-'}
          </p>
        </div>

        <ViewDetailAction onClick={onPlantDetailOpen} />
      </>
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            선택 발전소
          </p>
          <h2 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.03em] text-slate-950">
            {plant.plant_name}
          </h2>
        </div>
        <RiskBadge level={plant.risk_level} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="설비용량" value={formatValue(plant.solar_capacity, 'MW')} />
        <Metric label="예측 발전량" value={formatValue(plant.solar_generation, 'MWh')} />
        <Metric label="Peak hour" value={formatHour(plant.peak_hour)} />
        <Metric label="출력제어 시간" value={plant.curtailment_time} />
      </div>

      <div className="panel-section mt-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            위험도 점수
          </span>
          <span className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            {formatRiskScore(plant.risk_score)}점
          </span>
        </div>
        <p className="mt-3 text-[12px] leading-6 text-slate-600">
          {getRiskMessage(plant.risk_level)}
        </p>
      </div>

      <ViewDetailAction onClick={onPlantDetailOpen} />
    </>
  )
}

function SidePanel({
  error,
  forecastRows,
  jeonnamChartRows,
  jeonnamDemo,
  jeonnamTimeData,
  loading,
  onPlantDetailOpen,
  plants,
  shinanPlants,
  selectedDate,
  selectedHour,
  selectedPlant,
  selectedRegion,
  sinanChartRows,
  viewLevel,
}) {
  const sinanSummary = getSelectedCitySummary(jeonnamTimeData, '신안군', selectedHour)
  const sinanRiskWindow = getJeonnamRiskWindow(getCityRows(jeonnamTimeData, '신안군'))
  const customChartRows =
    viewLevel === 'jeonnam'
      ? jeonnamChartRows
      : viewLevel === 'sinan' || selectedPlant
        ? sinanChartRows
        : undefined
  const customChartUnit =
    viewLevel === 'jeonnam' || viewLevel === 'sinan' || selectedPlant ? 'MW' : 'MWh'

  return (
    <div className="side-panel-shell">
      <PanelHeader selectedPlant={selectedPlant} viewLevel={viewLevel} />

      <div className="side-panel-scroll">
        {loading && (
          <div className="mb-4 rounded-[18px] border border-sky-200 bg-sky-50 p-3 text-[13px] text-sky-700">
            CSV 데이터를 불러오는 중입니다.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-[18px] border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-700">
            일부 CSV 로딩에 실패해 fallback 데이터를 표시하고 있습니다.
          </div>
        )}

        {selectedPlant ? (
          <PlantDetail onPlantDetailOpen={onPlantDetailOpen} plant={selectedPlant} />
        ) : viewLevel === 'national' ? (
          <NationalOverview
            forecastRows={forecastRows}
            plants={plants}
            selectedDate={selectedDate}
            selectedHour={selectedHour}
            selectedRegion={selectedRegion}
          />
        ) : viewLevel === 'jeonnam' ? (
          <JeonnamOverview jeonnamRows={jeonnamDemo} selectedHour={selectedHour} />
        ) : (
          <SinanOverview
            selectedHour={selectedHour}
            shinanPlants={shinanPlants}
            sinanRiskWindow={sinanRiskWindow}
            sinanSummary={sinanSummary}
          />
        )}

        <ForecastChart
          forecastRows={forecastRows}
          selectedDate={selectedDate}
          selectedPlant={selectedPlant}
          selectedRegion={selectedRegion}
          timeSeriesRows={customChartRows}
          unit={customChartUnit}
          viewLevel={viewLevel}
        />
      </div>
    </div>
  )
}

export default SidePanel
