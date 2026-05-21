import { couplingCandidates } from '../data/sectorCouplingDummyData'
import { formatRiskScore } from '../utils/riskUtils'
import ForecastChart from './ForecastChart'
import RiskBadge from './RiskBadge'

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function formatCapacity(plant) {
  const v = plant.permitted_capacity_kw ?? plant.solar_capacity
  if (!v) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toLocaleString()} kW` : String(v)
}

function formatGeneration(plant) {
  const v = plant.solar_generation ?? plant.annual_generation_kwh
  if (!v) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toLocaleString()} MWh` : String(v)
}

function getTownship(plant) {
  return plant.township || plant.matched_township || plant.sub_region || '신안군'
}

function DetailMetric({ label, value }) {
  return (
    <div className="plant-detail-metric">
      <p className="plant-detail-metric-label">{label}</p>
      <div className="plant-detail-metric-value">{value}</div>
    </div>
  )
}

const TYPE_ICONS = {
  ESS: '🔋',
  'EV Charging': '⚡',
  P2H: '🔥',
  Hydrogen: '⚗',
  'Industrial Load': '🏭',
}

function CandidateCard({ candidate }) {
  const icon = TYPE_ICONS[candidate.type] || '●'
  return (
    <div className="coupling-candidate-item">
      <div
        className="coupling-type-icon"
        style={{ background: `${candidate.color}18` }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div>
        <p className="coupling-candidate-name">{candidate.name}</p>
        <p className="coupling-candidate-meta">
          {candidate.type} · {candidate.distance} · {candidate.capacity}
        </p>
        <p className="coupling-candidate-meta" style={{ marginTop: 2 }}>
          {candidate.reason}
        </p>
      </div>
      <div
        className="coupling-candidate-score"
        style={{ color: candidate.color }}
      >
        {candidate.score}
      </div>
    </div>
  )
}

function EmptyState({ onForecastOpen }) {
  return (
    <div className="plant-detail-shell">
      <div className="page-empty-state">
        <div className="page-empty-card">
          <p style={{ color: '#0ea5e9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Plant Detail
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#0f172a', marginBottom: 10 }}>
            먼저 발전소를 선택해주세요
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            Forecast Map에서 신안군 내 발전소 마커를 클릭하면 해당 발전소의 상세 정보와 섹터 커플링 후보를 이 화면에서 확인할 수 있습니다.
          </p>
          <button className="page-primary-cta" onClick={onForecastOpen} type="button">
            Forecast Map으로 이동
          </button>
        </div>
      </div>
    </div>
  )
}

function PlantDetailPage({ forecastRows, onForecastOpen, onSectorCouplingOpen, selectedDate, selectedPlant }) {
  if (!selectedPlant) {
    return <EmptyState onForecastOpen={onForecastOpen} />
  }

  const township = getTownship(selectedPlant)
  const curtailmentTime = selectedPlant.curtailment_time || '-'
  const peakHour = selectedPlant.peak_hour ? formatHour(selectedPlant.peak_hour) : '-'

  return (
    <div className="plant-detail-shell">
      <button className="plant-detail-back-btn" onClick={onForecastOpen} type="button">
        ← Forecast Map으로 돌아가기
      </button>

      {/* Header */}
      <div className="plant-detail-header">
        <div>
          <p className="plant-detail-eyebrow">Plant Detail</p>
          <h1 className="plant-detail-name">{selectedPlant.plant_name}</h1>
          <p className="plant-detail-location">
            전라남도 신안군 {township}
            {selectedPlant.installation_address || selectedPlant.address
              ? ` · ${selectedPlant.installation_address || selectedPlant.address}`
              : ''}
          </p>
        </div>
        <RiskBadge level={selectedPlant.risk_level} />
      </div>

      {/* Metrics */}
      <div className="plant-detail-metrics">
        <DetailMetric label="설비용량" value={formatCapacity(selectedPlant)} />
        <DetailMetric label="예측 발전량" value={formatGeneration(selectedPlant)} />
        <DetailMetric label="위험도 점수" value={`${formatRiskScore(selectedPlant.risk_score)}점`} />
        <DetailMetric label="위험도 등급" value={<RiskBadge level={selectedPlant.risk_level} />} />
        <DetailMetric label="출력제어 위험 시간대" value={curtailmentTime} />
        <DetailMetric label="피크 시간" value={peakHour} />
      </div>

      {/* Main two-column */}
      <div className="plant-detail-main">
        {/* Left: forecast chart */}
        <div className="plant-detail-card">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 2 }}>
            발전량 예측
          </p>
          <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: 0 }}>
            시간대별 예측 발전량 추이
          </h3>
          <ForecastChart
            forecastRows={forecastRows}
            selectedDate={selectedDate}
            selectedPlant={selectedPlant}
            selectedRegion={null}
            viewLevel="sinan"
          />

          <div style={{ marginTop: 20, padding: '14px 16px', border: '1px solid #fde68a', borderRadius: 10, background: '#fffbeb' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              출력제어 위험 시간대
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#b45309', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {curtailmentTime}
            </p>
            <p style={{ fontSize: 12, color: '#92400e', marginTop: 6, lineHeight: 1.6 }}>
              해당 시간대에 잉여 전력 발생이 예상됩니다. 아래 섹터 커플링 후보를 통해 잉여 전력을 활용할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Right: coupling candidates */}
        <div className="plant-detail-card">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 2 }}>
            Sector Coupling
          </p>
          <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: 14 }}>
            주변 연계 후보 자원
          </h3>

          {couplingCandidates.map((candidate) => (
            <CandidateCard candidate={candidate} key={candidate.id} />
          ))}

          <button className="simulation-cta" onClick={onSectorCouplingOpen} type="button">
            Sector Coupling Simulation 시작 →
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlantDetailPage
