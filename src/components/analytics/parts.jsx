// 공정 분석 화면 공통 부품
import { ResponsiveContainer } from 'recharts'

export function Card({ title, sub, right, children, className = '' }) {
  return (
    <section className={`pa-card ${className}`}>
      {(title || right) && (
        <div className="pa-card-head">
          <div>
            {title && <h3 className="pa-card-title">{title}</h3>}
            {sub && <p className="pa-card-sub">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

const STATUS_LABEL = { pass: '통과', warn: '주의', fail: '실패' }

export function StatusBadge({ status }) {
  return <span className={`pa-badge is-${status}`}>{STATUS_LABEL[status] ?? status}</span>
}

export function LevelBadge({ level }) {
  const tone = level === '위험' ? 'fail' : level === '주의' ? 'warn' : 'pass'
  return <span className={`pa-badge is-${tone}`}>{level}</span>
}

export function KpiTile({ label, value, unit, sub, tone }) {
  return (
    <div className={`pa-kpi ${tone ? `is-${tone}` : ''}`}>
      <p className="pa-kpi-label">{label}</p>
      <p className="pa-kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </p>
      {sub && <p className="pa-kpi-sub">{sub}</p>}
    </div>
  )
}

// 차트 컨테이너: 첫 렌더링부터 크기를 정해 Recharts의 width(-1) 경고를 막는다
export function ChartBox({ height = 240, children }) {
  return (
    <div className="pa-chart" style={{ height }}>
      <ResponsiveContainer height="100%" initialDimension={{ width: 600, height }} width="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}
