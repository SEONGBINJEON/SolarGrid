import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { couplingCandidates } from '../data/sectorCouplingDummyData'
import { formatRiskScore } from '../utils/riskUtils'
import {
  getCase1Rows,
  getDemoPlantMetrics,
  isDemoPlant,
} from '../utils/sectorCouplingUtils'
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

function formatGenerationValue(value) {
  const n = Number(value)
  return Number.isFinite(n)
    ? `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh`
    : '-'
}

function formatGeneration(plant) {
  const v = plant.solar_generation ?? plant.annual_generation_kwh
  return formatGenerationValue(v)
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

const TYPE_LABELS = {
  ESS: 'ESS',
  EV: 'EV',
  P2H: 'P2H',
}

function CandidateCard({ candidate }) {
  return (
    <div className="coupling-candidate-item">
      <div
        className="coupling-type-icon"
        style={{ background: `${candidate.color}18`, color: candidate.color }}
      >
        <span style={{ fontSize: 11, fontWeight: 800 }}>{TYPE_LABELS[candidate.type]}</span>
      </div>
      <div>
        <p className="coupling-candidate-name">{candidate.name}</p>
        <p className="coupling-candidate-meta">
          {candidate.type} · {candidate.description}
        </p>
        <p className="coupling-candidate-meta" style={{ marginTop: 2 }}>
          {candidate.location}
        </p>
      </div>
    </div>
  )
}

function SurplusTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0].payload

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-[13px] text-slate-500">{formatHour(label)}</p>
      <p className="text-[15px] font-semibold text-slate-950">
        {Number(point.surplus_mwh).toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })}{' '}
        MWh
      </p>
      <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-600">
        <span>위험도 점수 {formatRiskScore(point.risk_score)}점</span>
        <RiskBadge level={point.risk_level} />
      </div>
    </div>
  )
}

function getSurplusBarColor(point) {
  if (Number(point.surplus_mwh) <= 0) {
    return '#e2e8f0'
  }

  return point.risk_level === '위험' ? '#ef4444' : '#f97316'
}

function SurplusBarChart({ data }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
            시간대별 추정 잉여전력
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            추정 잉여전력이 발생하는 주의 이상 시간대를 중심으로 표시
          </p>
        </div>
        <span className="text-[12px] font-medium text-slate-500">MWh</span>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[210px] items-center justify-center rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-500">
          추정 잉여전력 데이터가 없습니다.
        </div>
      ) : (
        <div className="h-[210px] rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="hour"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={formatHour}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickLine={false}
              />
              <Tooltip content={<SurplusTooltip />} />
              <Bar dataKey="surplus_mwh" radius={[6, 6, 0, 0]}>
                {data.map((point) => (
                  <Cell fill={getSurplusBarColor(point)} key={point.hour} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
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

function PlantDetailPage({
  forecastRows,
  onForecastOpen,
  onSectorCouplingOpen,
  sectorCouplingCases,
  selectedDate,
  selectedHour,
  selectedPlant,
}) {
  if (!selectedPlant) {
    return <EmptyState onForecastOpen={onForecastOpen} />
  }

  const township = getTownship(selectedPlant)
  const case1Rows = getCase1Rows(sectorCouplingCases)
  const usesDemoData = isDemoPlant(selectedPlant) && case1Rows.length > 0
  const demoMetrics = getDemoPlantMetrics(selectedPlant, case1Rows, selectedHour)
  const curtailmentTime =
    demoMetrics?.curtailment_window ?? selectedPlant.curtailment_time ?? '-'
  const peakHour = demoMetrics?.peak_hour
    ? formatHour(demoMetrics.peak_hour)
    : selectedPlant.peak_hour
      ? formatHour(selectedPlant.peak_hour)
      : '-'
  const riskLevel = demoMetrics?.risk_level ?? selectedPlant.risk_level
  const riskScore = demoMetrics?.risk_score ?? selectedPlant.risk_score
  const generation = demoMetrics
    ? formatGenerationValue(demoMetrics.forecast_mwh)
    : formatGeneration(selectedPlant)

  return (
    <div className="plant-detail-shell">
      <button className="plant-detail-back-btn" onClick={onForecastOpen} type="button">
        ← Forecast Map으로 돌아가기
      </button>

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
        <RiskBadge level={riskLevel} />
      </div>

      <div className="plant-detail-metrics">
        <DetailMetric label="설비용량" value={formatCapacity(selectedPlant)} />
        <DetailMetric label="예측 발전량" value={generation} />
        <DetailMetric label="위험도 점수" value={`${formatRiskScore(riskScore)}점`} />
        <DetailMetric label="위험도 등급" value={<RiskBadge level={riskLevel} />} />
        <DetailMetric label="출력제어 위험 시간대" value={curtailmentTime} />
        <DetailMetric label="피크 시간" value={peakHour} />
      </div>

      <div className="plant-detail-main">
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
            timeSeriesRows={usesDemoData ? case1Rows : undefined}
            unit="MWh"
            viewLevel="sinan"
          />
          <SurplusBarChart data={usesDemoData ? case1Rows : []} />

          <div style={{ marginTop: 20, padding: '14px 16px', border: '1px solid #fde68a', borderRadius: 10, background: '#fffbeb' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              출력제어 위험 시간대
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#b45309', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {curtailmentTime}
            </p>
            <p style={{ fontSize: 12, color: '#92400e', marginTop: 6, lineHeight: 1.6 }}>
              Case 1 기준으로 추정 잉여전력이 0보다 큰 시간대를 출력제어 위험 시간대로 표시합니다.
            </p>
          </div>
        </div>

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
