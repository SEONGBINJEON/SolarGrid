import {
  formatRiskScore,
  getRiskMessage,
  sortByRiskScore,
  toRiskPercent,
} from '../utils/riskUtils'
import ForecastChart from './ForecastChart'
import RiskBadge from './RiskBadge'

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function getPeakRiskWindow(rows) {
  const riskyRows = rows.filter((row) => toRiskPercent(row.risk_score) >= 70)

  if (riskyRows.length === 0) {
    return '없음'
  }

  const hours = riskyRows.map((row) => row.hour)
  return `${formatHour(Math.min(...hours))} - ${formatHour(Math.max(...hours))}`
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

function formatNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue.toLocaleString() : '-'
}

function formatValue(value, unit = '') {
  const formatted = formatNumber(value)
  return formatted === '-' || unit === '' ? formatted : `${formatted} ${unit}`
}

function hasValidPlantCoordinate(plant) {
  return Number.isFinite(Number(plant.lat)) && Number.isFinite(Number(plant.lng))
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

function NationalOverview({
  forecastRows,
  plants,
  regionRiskSummary,
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
    (sum, region) => sum + region.solar_generation,
    0,
  )
  const totalCapacity = currentRows.reduce((sum, region) => sum + region.solar_capacity, 0)
  const maxRiskPoint = sortByRiskScore(currentRows)[0]
  const topFive = [...regionRiskSummary]
    .sort(
      (a, b) =>
        b['주의_위험_비율(%)'] - a['주의_위험_비율(%)'] ||
        b['위험_비율(%)'] - a['위험_비율(%)'],
    )
    .slice(0, 5)

  return (
    <>
      <div>
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">선택 시점</p>
        <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          {selectedDate || '-'} {formatHour(selectedHour)}
        </h2>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="표시 지역 수" value={`${currentRows.length}개`} />
        <Metric label="전체 발전소 수" value={`${plants.length}개`} />
        <Metric label="전체 설비용량" value={`${totalCapacity.toLocaleString()} MW`} />
        <Metric label="총 예측 발전량" value={`${totalGeneration.toLocaleString()} MWh`} />
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
              value={`${selectedRegion.solar_generation.toLocaleString()} MWh`}
            />
            <Metric
              label="설비용량"
              value={`${selectedRegion.solar_capacity.toLocaleString()} MW`}
            />
            <Metric
              label="위험도 점수"
              value={`${formatRiskScore(selectedRegion.risk_score)}점`}
            />
            <Metric
              label="출력제어 예상"
              value={getPeakRiskWindow(selectedRegionRows)}
            />
          </div>
        </section>
      )}

      <section className="mt-5">
        <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
          위험 지역 TOP 5
        </h3>
        <div className="space-y-2">
          {topFive.map((region) => (
            <div
              className="flex items-center justify-between rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm"
              key={region.region}
            >
              <span className="text-[14px] font-semibold text-slate-900">{region.region}</span>
              <div className="text-right text-[12px] font-medium leading-5 text-slate-500">
                <p>주의+위험 {region['주의_위험_비율(%)'].toFixed(1)}%</p>
                <p>위험 {region['위험_비율(%)'].toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
          지역별 위험 요약
        </h3>
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">지역</th>
                <th className="px-3 py-3 text-right font-medium">정상</th>
                <th className="px-3 py-3 text-right font-medium">주의</th>
                <th className="px-3 py-3 text-right font-medium">위험</th>
              </tr>
            </thead>
            <tbody>
              {regionRiskSummary.map((region) => (
                <tr className="border-t border-slate-100" key={region.region}>
                  <td className="px-3 py-3">{region.region}</td>
                  <td className="px-3 py-3 text-right">{region.정상}</td>
                  <td className="px-3 py-3 text-right">{region.주의}</td>
                  <td className="px-3 py-3 text-right">{region.위험}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function JeonnamOverview({ jeonnamDemo }) {
  const totalGeneration = jeonnamDemo.reduce(
    (sum, region) => sum + region.solar_generation,
    0,
  )
  const topThree = sortByRiskScore(jeonnamDemo).slice(0, 3)
  const strongestCurtailment = topThree[0]?.curtailment_time ?? '없음'

  return (
    <>
      <div>
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">선택 지역</p>
        <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          전라남도
        </h2>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="전남 전체 예측 발전량" value={`${totalGeneration.toLocaleString()} MWh`} />
        <Metric label="출력제어 예상 시간대" value={strongestCurtailment} />
      </div>

      <section className="mt-5">
        <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
          위험도가 높은 시군 TOP 3
        </h3>
        <div className="space-y-2">
          {topThree.map((region) => (
            <div
              className="flex items-center justify-between rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm"
              key={region.id}
            >
              <span className="text-[14px] font-semibold text-slate-900">{region.region}</span>
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-slate-500">
                  {formatRiskScore(region.risk_score)}점
                </span>
                <RiskBadge level={region.risk_level} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
          지역별 데이터
        </h3>
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">지역</th>
                <th className="px-3 py-3 text-right font-medium">예측량</th>
                <th className="px-3 py-3 text-right font-medium">위험도</th>
              </tr>
            </thead>
            <tbody>
              {jeonnamDemo.map((region) => (
                <tr className="border-t border-slate-100" key={region.id}>
                  <td className="px-3 py-3">{region.region}</td>
                  <td className="px-3 py-3 text-right">{region.solar_generation} MWh</td>
                  <td className="px-3 py-3 text-right">
                    <RiskBadge level={region.risk_level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function SinanOverview({ shinanPlants }) {
  const totalAnnualGeneration = shinanPlants.reduce(
    (sum, plant) => sum + (plant.annual_generation_kwh ?? plant.solar_generation ?? 0),
    0,
  )
  const visiblePlants = shinanPlants.filter(hasValidPlantCoordinate)
  const failedPlants = shinanPlants.length - visiblePlants.length

  return (
    <>
      <div>
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">선택 지역</p>
        <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          신안군
        </h2>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="전체 발전소 수" value={`${shinanPlants.length.toLocaleString()}개`} />
        <Metric label="지도 표시 발전소 수" value={`${visiblePlants.length.toLocaleString()}개`} />
        <Metric label="좌표 변환 실패 수" value={`${failedPlants.toLocaleString()}개`} />
        <Metric
          label="예측 발전량 합계"
          value={`${Math.round(totalAnnualGeneration).toLocaleString()} MWh`}
        />
      </div>

      <div className="panel-section mt-4">
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
          지도 표시 방식
        </p>
        <p className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
          전체 발전소 점 마커
        </p>
        <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
          점을 클릭하면 발전소 상세 정보가 표시됩니다.
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
          <Metric label="읍/면" value={plant.township || plant.matched_township || '-'} />
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
          <Metric label="출력제어 예상 시간" value={plant.curtailment_time || '-'} />
        </div>

        <div className="panel-section mt-4">
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-slate-500">
            주소
          </p>
          <p className="mt-3 text-[13px] leading-6 text-slate-700">
            {plant.installation_address || plant.address || plant.matched_address || plant.original_address || '-'}
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
        <Metric label="설비용량" value={`${plant.solar_capacity} MW`} />
        <Metric label="예측 발전량" value={`${plant.solar_generation} MWh`} />
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
  jeonnamDemo,
  loading,
  onPlantDetailOpen,
  plants,
  regionRiskSummary,
  shinanPlants,
  selectedDate,
  selectedHour,
  selectedPlant,
  selectedRegion,
  viewLevel,
}) {
  return (
    <div>
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
          regionRiskSummary={regionRiskSummary}
          selectedDate={selectedDate}
          selectedHour={selectedHour}
          selectedRegion={selectedRegion}
        />
      ) : viewLevel === 'jeonnam' ? (
        <JeonnamOverview jeonnamDemo={jeonnamDemo} />
      ) : (
        <SinanOverview shinanPlants={shinanPlants} />
      )}

      <ForecastChart
        forecastRows={forecastRows}
        selectedDate={selectedDate}
        selectedPlant={selectedPlant}
        selectedRegion={selectedRegion}
        viewLevel={viewLevel}
      />
    </div>
  )
}

export default SidePanel
