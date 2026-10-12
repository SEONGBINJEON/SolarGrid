import { useState } from 'react'
import useAnalytics from '../../hooks/useAnalytics'
import CapacityTab from './CapacityTab'
import ControlChartTab from './ControlChartTab'
import { fmt } from './format'
import { KpiTile } from './parts'
import QualityTab from './QualityTab'
import RiskPatternTab from './RiskPatternTab'

const TABS = [
  { id: 'quality', step: 'M', label: '데이터 품질', Component: QualityTab },
  { id: 'capacity', step: 'A', label: '설비 구조', Component: CapacityTab },
  { id: 'risk', step: 'A', label: '위험 패턴', Component: RiskPatternTab },
  { id: 'control', step: 'C', label: '관리도', Component: ControlChartTab },
]

function ProcessAnalyticsPage() {
  const { data, loading, error } = useAnalytics()
  const [tab, setTab] = useState(TABS[0].id)

  if (loading) {
    return (
      <div className="pa-shell">
        <p className="pa-state">분석 결과를 불러오는 중입니다.</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="pa-shell">
        <div className="pa-state is-error">
          <p>분석 결과(analytics.json)를 읽지 못했습니다.</p>
          <code>.venv\Scripts\python analysis\run_analysis.py</code>
          <small>solar-dashboard 폴더에서 위 명령으로 분석 파이프라인을 실행하면 생성됩니다.</small>
        </div>
      </div>
    )
  }

  const { quality, geocode, risk, allocation, meta } = data
  const total = quality.summary.pass + quality.summary.warn + quality.summary.fail
  const plan = allocation.cases.soc['ESS 피크 1회']
  const yieldDelta = geocode.after.yield_pct - geocode.before.yield_pct
  const Active = TABS.find((t) => t.id === tab)?.Component ?? QualityTab

  return (
    <div className="pa-shell">
      <header className="pa-header">
        <div>
          <p className="pa-eyebrow">Process Analytics</p>
          <h1 className="pa-title">공정 분석</h1>
          <p className="pa-desc">
            Python 분석 파이프라인 결과 · 예측일 {meta.forecast_date} · 생성 {meta.generated_at.replace('T', ' ')}
          </p>
        </div>
      </header>

      <div className="pa-kpis">
        <KpiTile
          label="데이터 품질 게이트"
          sub={`주의 ${quality.summary.warn} · 실패 ${quality.summary.fail}`}
          tone={quality.summary.fail ? 'down' : undefined}
          unit={`/ ${total}`}
          value={quality.summary.pass}
        />
        <KpiTile
          label="발전소 좌표화 수율"
          sub={`해커톤 대비 +${fmt(yieldDelta, 1)}%p · 실패 ${geocode.before.failed} → ${geocode.after.failed}기`}
          tone="up"
          unit="%"
          value={fmt(geocode.after.yield_pct, 1)}
        />
        <KpiTile
          label="지속 경보 지역"
          sub={`경고 한계 이상 ${meta.limits.sustain_hours}시간 연속 · 조치 한계 초과 ${new Set(risk.events.filter((e) => e.action_limit_exceeded).map((e) => e.region)).size}곳`}
          unit="곳"
          value={new Set(risk.events.filter((e) => e.sustained).map((e) => e.region)).size}
        />
        <KpiTile
          label="잉여전력 활용률 (SOC 반영)"
          sub={`Case 2 운영안 · 잉여 ${fmt(allocation.surplus_total_mwh, 1)} MWh`}
          unit="%"
          value={fmt(plan.utilization_pct, 2)}
        />
      </div>

      <nav aria-label="분석 항목" className="pa-tabs">
        {TABS.map((t) => (
          <button className={`pa-tab ${tab === t.id ? 'is-active' : ''}`} key={t.id} onClick={() => setTab(t.id)} type="button">
            <span className="pa-tab-step">{t.step}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <Active data={data} />
    </div>
  )
}

export default ProcessAnalyticsPage
