import { useState } from 'react'
import { getSectorCouplingRecommendations, simulationSummary } from '../data/sectorCouplingDummyData'
import { formatRiskScore } from '../utils/riskUtils'

function getTownship(plant) {
  return plant?.township || plant?.matched_township || plant?.sub_region || '신안군'
}

function formatCapacity(plant) {
  const v = plant?.permitted_capacity_kw ?? plant?.solar_capacity
  if (!v) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toLocaleString()} kW` : String(v)
}

function formatGeneration(plant) {
  const v = plant?.solar_generation ?? plant?.annual_generation_kwh
  if (!v) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toLocaleString()} MWh` : String(v)
}

/* ---- Strip metric card ---- */
function StripCard({ label, value, unit, valueClass }) {
  return (
    <div className="sector-strip-card">
      <p className="sector-strip-label">{label}</p>
      <p className={`sector-strip-value ${valueClass || ''}`}>
        {value}
        {unit && <span className="sector-strip-unit">{unit}</span>}
      </p>
    </div>
  )
}

/* ---- Quantitative result card ---- */
function QuantCard({ label, value, unit, valueClass }) {
  return (
    <div className="sector-quant-card">
      <p className="sector-quant-label">{label}</p>
      <p className={`sector-quant-value ${valueClass || ''}`}>
        {value}
        {unit && <span className="sector-quant-unit">{unit}</span>}
      </p>
    </div>
  )
}

/* ---- Distribution card (right column) ---- */
function DistCard({ item, isPlaying }) {
  const barWidth = isPlaying ? item.allocation_pct : 0
  return (
    <div className="sector-dist-card">
      <div className="sector-dist-rank">{item.rank}</div>
      <div>
        <p className="sector-dist-label">{item.label}</p>
        <p className="sector-dist-meta">{item.role} · {item.allocation_mwh} MWh</p>
        <div className="sector-dist-bar-bg">
          <div
            className="sector-dist-bar"
            style={{ width: `${barWidth}%`, background: item.color }}
          />
        </div>
      </div>
      <div className="sector-dist-score" style={{ color: item.color }}>
        {item.score}
      </div>
    </div>
  )
}

/* ---- Flow line (rotated from center to each node) ---- */
const nodeAngles = {
  ess: -55,
  ev: 10,
  p2h: 55,
  hydrogen: 125,
  industrial: 175,
}

const nodeDistances = {
  ess: 200,
  ev: 195,
  p2h: 200,
  hydrogen: 200,
  industrial: 195,
}

function SimFlowLine({ item, isPlaying }) {
  const angle = nodeAngles[item.id] ?? 0
  const dist = nodeDistances[item.id] ?? 200
  return (
    <div
      className={`sim-flow-line ${isPlaying ? 'is-playing' : ''}`}
      style={{
        width: dist,
        background: `linear-gradient(90deg, #fbbf24, ${item.color})`,
        transform: `rotate(${angle}deg)`,
        animationDelay: `${item.rank * 0.18}s`,
      }}
    />
  )
}

/* ---- Resource node ---- */
function SimResourceNode({ item, isPlaying }) {
  return (
    <div
      className={`sim-node sim-resource-node sim-node-${item.id} ${isPlaying ? 'is-playing' : ''}`}
      style={{ borderColor: `${item.color}44` }}
    >
      <span className="sim-node-kicker" style={{ color: item.color }}>
        {item.nodeLabel}
      </span>
      <p className="sim-node-score" style={{ color: item.color, fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {item.score}점
      </p>
      <p className="sim-node-role" style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
        {item.role}
      </p>
      {isPlaying && (
        <p style={{ fontSize: 10, color: item.color, marginTop: 4, fontWeight: 600 }}>
          {item.allocation_mwh} MWh ({item.allocation_pct}%)
        </p>
      )}
    </div>
  )
}

/* ---- Empty state ---- */
function EmptySectorState({ onForecastOpen }) {
  return (
    <div className="sector-shell" style={{ display: 'flex', alignItems: 'flex-start', padding: '48px 32px' }}>
      <div className="page-empty-card">
        <p style={{ color: '#0ea5e9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Sector Coupling
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#0f172a', marginBottom: 10 }}>
          먼저 신안군 발전소를 선택해주세요
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
          Forecast Map에서 신안군 내 발전소를 클릭한 후 Plant Detail → Sector Coupling Simulation 순서로 이동하면, 선택 발전소 기반 잉여 전력 배분 시뮬레이션 결과를 확인할 수 있습니다.
        </p>
        <button className="page-primary-cta" onClick={onForecastOpen} type="button">
          Forecast Map으로 이동
        </button>
      </div>
    </div>
  )
}

/* ---- Main Component ---- */
function SectorCouplingPage({ onForecastOpen, selectedPlant }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const recommendations = getSectorCouplingRecommendations()

  if (!selectedPlant) {
    return <EmptySectorState onForecastOpen={onForecastOpen} />
  }

  const township = getTownship(selectedPlant)
  const sim = simulationSummary
  const plantName = selectedPlant.plant_name

  const handlePlay = () => setIsPlaying((v) => !v)

  return (
    <div className="sector-shell">
      {/* Top bar */}
      <div className="sector-top-bar">
        <div>
          <p className="sector-plant-eyebrow">Sector Coupling Simulation</p>
          <h1 className="sector-plant-name">{plantName}</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
            전라남도 신안군 {township} · 위험도 {formatRiskScore(selectedPlant.risk_score)}점
          </p>
        </div>
        <button className="plant-detail-back-btn" onClick={onForecastOpen} type="button">
          ← Forecast Map
        </button>
      </div>

      {/* Summary strip */}
      <div className="sector-summary-strip">
        <StripCard label="출력제어 위험 시간대" value={selectedPlant.curtailment_time || sim.curtailment_window} />
        <StripCard label="예상 잉여 전력" value={sim.total_surplus_mwh} unit="MWh" />
        <StripCard
          label="섹터 커플링 활용"
          unit="MWh"
          value={sim.utilized_mwh}
          valueClass="sector-strip-value-green"
        />
        <StripCard label="설비용량" value={formatCapacity(selectedPlant)} />
        <StripCard label="예측 발전량" value={formatGeneration(selectedPlant)} />
      </div>

      {/* Body: simulation + distribution */}
      <div className="sector-body-grid">
        {/* Simulation panel */}
        <div className="sector-sim-panel">
          <div className="sector-sim-header">
            <div>
              <p className="sector-sim-title-label">Coupling Flow</p>
              <h2 className="sector-sim-title">잉여 전력 배분 시뮬레이션</h2>
            </div>
            <button
              className={`sim-play-btn ${isPlaying ? 'is-playing' : ''}`}
              onClick={handlePlay}
              type="button"
            >
              {isPlaying ? '⏸ 시뮬레이션 정지' : '▶ 시뮬레이션 시작'}
            </button>
          </div>

          <div className={`sector-sim-canvas ${isPlaying ? 'is-playing' : ''}`}>
            {/* Flow lines */}
            {recommendations.map((item) => (
              <SimFlowLine isPlaying={isPlaying} item={item} key={item.id} />
            ))}

            {/* Plant center node */}
            <div className="sim-node sim-node-plant">
              <span className="sim-node-kicker">☀ Solar Plant</span>
              <p className="sim-node-name">{plantName}</p>
              <p className="sim-node-sub">
                {isPlaying ? `${sim.total_surplus_mwh} MWh 배분 중` : `${sim.total_surplus_mwh} MWh 잉여 전력`}
              </p>
            </div>

            {/* Resource nodes */}
            {recommendations.map((item) => (
              <SimResourceNode isPlaying={isPlaying} item={item} key={item.id} />
            ))}
          </div>

          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
            {isPlaying
              ? '시뮬레이션 실행 중 — 잉여 전력이 각 자원으로 배분되고 있습니다'
              : '▶ 버튼을 눌러 잉여 전력 배분 흐름을 시뮬레이션합니다'}
          </p>
        </div>

        {/* Distribution cards */}
        <div className="sector-dist-panel">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 4 }}>
            자원별 배분 결과
          </p>
          <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: 12 }}>
            Priority Scoring
          </h3>
          {recommendations.map((item) => (
            <DistCard isPlaying={isPlaying} item={item} key={item.id} />
          ))}
          <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid #d1fae5', borderRadius: 10, background: '#ecfdf5' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#065f46', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              출력제어 저감률
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {sim.curtailment_reduction_pct}
              <span style={{ fontSize: 14, fontWeight: 600, color: '#059669', marginLeft: 3 }}>%</span>
            </p>
          </div>
        </div>
      </div>

      {/* Quantitative results */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 10 }}>
          정량 결과
        </p>
        <div className="sector-quant-grid">
          <QuantCard label="예상 잉여 전력" unit="MWh" value={sim.total_surplus_mwh} />
          <QuantCard
            label="섹터 커플링 활용"
            unit="MWh"
            value={sim.utilized_mwh}
            valueClass="sector-quant-value-green"
          />
          <QuantCard
            label="미활용 전력"
            unit="MWh"
            value={sim.unutilized_mwh}
            valueClass="sector-quant-value-amber"
          />
          <QuantCard
            label="출력제어 저감률"
            unit="%"
            value={sim.curtailment_reduction_pct}
            valueClass="sector-quant-value-green"
          />
          <QuantCard
            label="활용 효율 개선"
            unit="%"
            value={`+${sim.efficiency_improvement_pct}`}
            valueClass="sector-quant-value-blue"
          />
          <QuantCard label="탄소 저감 추정" unit="tCO₂" value={sim.carbon_reduction_tco2} />
        </div>
      </div>

      {/* Result summary + algo note */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 12 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 6 }}>
            추천 결과 요약
          </p>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: 8 }}>
            ESS 우선, EV 충전과 P2H 열수요를 후순위 연계
          </h3>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            선택 발전소는 출력제어 위험 시간대({selectedPlant.curtailment_time || sim.curtailment_window})에 발생하는 잉여 전력을 ESS 충전에 우선 활용하고, 이후 EV 충전·P2H 열수요·수소 생산·산업 부하 순으로 연계하는 전략을 추천합니다.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {recommendations.map((item) => (
              <div
                key={item.id}
                style={{
                  flex: 1,
                  border: `1px solid ${item.color}33`,
                  borderRadius: 8,
                  background: `${item.color}0a`,
                  padding: '10px 8px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{item.rank}순위</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sector-algo-note">
          <p className="sector-algo-note-title">알고리즘 방향</p>
          <ul className="sector-algo-note-body" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: 5 }}>· 정상 지역은 제외하고 주의 또는 위험 지역만 추천 대상으로 봅니다.</li>
            <li style={{ marginBottom: 5 }}>· ESS는 지역별 ESS 설비용량 기반 저장 인프라 수준을 평가합니다.</li>
            <li style={{ marginBottom: 5 }}>· EV는 충전기 수, 총 충전 출력, 전기차 등록대수를 점수화합니다.</li>
            <li style={{ marginBottom: 5 }}>· P2H는 업종별 전력사용량과 기온을 활용해 잠재 열수요를 추정합니다.</li>
            <li style={{ marginBottom: 5 }}>· Hydrogen은 수전해 설비 현황 및 수소 인프라 구축 계획을 반영합니다.</li>
            <li>· Industrial Load는 인근 대형 부하의 운영 시간대와 수용 여력을 평가합니다.</li>
          </ul>
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(29, 78, 216, 0.08)', border: '1px solid #bfdbfe' }}>
            <p style={{ fontSize: 11, color: '#1e40af', lineHeight: 1.6 }}>
              본 결과는 실시간 전력망 최적화가 아니라, 공공데이터 기반 ESS·EV·P2H·수소·산업 부하 활용 적합도 점수에 따른 우선순위 추천 결과입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SectorCouplingPage
