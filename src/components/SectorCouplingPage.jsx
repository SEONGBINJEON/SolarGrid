import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ESS_MODES,
  peakHours,
  resourcesFromRows,
  simulateAllocation,
  surplusFromRows,
} from '../utils/allocationSimulator'
import WhatIfSimulator from './WhatIfSimulator'

// ---- Case definitions ----
const CASE_DEFS = {
  1: {
    id: 1,
    label: 'Case 1',
    essMethod: 'ESS 제한 없음',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.07)',
    border: 'rgba(14,165,233,0.25)',
    paperTitle:
      'Energy Management System for Polygeneration Microgrids with Renewable Energy Sources and Storage (2024)',
    formula: 'P_t^{load} = P_t^{ESS} + P_t^{EV} + P_t^{P2H}',
    formulaDesc: '시간 t에서 발생한 부하 수요를 ESS, EV, P2H가 흡수하는 분배 문제로 해석합니다.',
    note: '분배대상 전 시간대에서 ESS 사용 가능',
  },
  2: {
    id: 2,
    label: 'Case 2',
    essMethod: 'ESS 피크 1회',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.07)',
    border: 'rgba(139,92,246,0.25)',
    paperTitle:
      'A comprehensive framework for optimal energy management in renewable-integrated multi-energy carrier systems (2025)',
    formula: 'p_{l,t} - q_{DR,t} + q_{Rb,t} = p_{w,t} + p_{dchg,t} - p_{chg,t} - p_{cw,t}',
    formulaDesc: '수요반응, 재생에너지, 충방전 제약을 함께 고려해 시간대별 에너지 균형을 맞춥니다.',
    note: '잉여전력이 최대인 1개 시간대에서만 ESS 사용',
  },
  3: {
    id: 3,
    label: 'Case 3',
    essMethod: 'ESS 피크 2회',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.25)',
    paperTitle:
      'A Comprehensive Framework for Optimal Energy Management in Microgrids with Sector Coupling (2017)',
    formula: 'min Z = Σ_t (C_{ESS}·x_{ESS,t} + C_{EV}·x_{EV,t} + C_{P2H}·x_{P2H,t})',
    formulaDesc: 'ESS, EV, P2H 자원별 비용과 시간대별 배분량을 합산해 전체 운영 비용을 최소화합니다.',
    note: '잉여전력 상위 2개 시간대에서만 ESS 사용',
  },
}

const RESOURCES = [
  { id: 'ess', label: 'ESS', site: '안좌스마트팜앤쏠라시티', color: '#0ea5e9', key: 'ess_allocation_mwh' },
  { id: 'ev', label: 'EV', site: '안좌한전 충전소', color: '#8b5cf6', key: 'ev_allocation_mwh' },
  { id: 'p2h', label: 'P2H', site: '안좌면 행정복지센터', color: '#10b981', key: 'p2h_allocation_mwh' },
]

const COMPARE_META = {
  '분배 안 함': { label: '베이스라인', color: '#94a3b8', caseId: 0 },
  'ESS 제한 없음': { label: 'Case 1', color: '#0ea5e9', caseId: 1 },
  'ESS 피크 1회': { label: 'Case 2', color: '#8b5cf6', caseId: 2 },
  'ESS 피크 2회': { label: 'Case 3', color: '#10b981', caseId: 3 },
}

function fmt(v, d = 3) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(d) : '-'
}

function FormulaToken({ children, sub, sup }) {
  return (
    <span className="formula-token">
      {children}
      {sub && <sub>{sub}</sub>}
      {sup && <sup>{sup}</sup>}
    </span>
  )
}

function FormulaCard({ caseInfo }) {
  return (
    <div className="sector-formula-card">
      <div className="sector-formula-label">
        <span>대표 수식</span>
        <small>{caseInfo.label}</small>
      </div>

      {caseInfo.id === 1 && (
        <div className="sector-formula-equation">
          <FormulaToken sub="t" sup="load">P</FormulaToken>
          <span>=</span>
          <FormulaToken sub="t" sup="ESS">P</FormulaToken>
          <span>+</span>
          <FormulaToken sub="t" sup="EV">P</FormulaToken>
          <span>+</span>
          <FormulaToken sub="t" sup="P2H">P</FormulaToken>
        </div>
      )}

      {caseInfo.id === 2 && (
        <div className="sector-formula-equation sector-formula-equation-long">
          <FormulaToken sub="l,t">p</FormulaToken>
          <span>-</span>
          <FormulaToken sub="DR,t">q</FormulaToken>
          <span>+</span>
          <FormulaToken sub="Rb,t">q</FormulaToken>
          <span>=</span>
          <FormulaToken sub="w,t">p</FormulaToken>
          <span>+</span>
          <FormulaToken sub="dchg,t">p</FormulaToken>
          <span>-</span>
          <FormulaToken sub="chg,t">p</FormulaToken>
          <span>-</span>
          <FormulaToken sub="cw,t">p</FormulaToken>
        </div>
      )}

      {caseInfo.id === 3 && (
        <div className="sector-formula-equation sector-formula-equation-long">
          <span>min</span>
          <FormulaToken>Z</FormulaToken>
          <span>=</span>
          <span className="formula-sigma">Σ<sub>t</sub></span>
          <span>(</span>
          <FormulaToken sub="ESS">C</FormulaToken>
          <span>·</span>
          <FormulaToken sub="ESS,t">x</FormulaToken>
          <span>+</span>
          <FormulaToken sub="EV">C</FormulaToken>
          <span>·</span>
          <FormulaToken sub="EV,t">x</FormulaToken>
          <span>+</span>
          <FormulaToken sub="P2H">C</FormulaToken>
          <span>·</span>
          <FormulaToken sub="P2H,t">x</FormulaToken>
          <span>)</span>
        </div>
      )}

      <p className="sector-formula-desc">{caseInfo.formulaDesc}</p>
    </div>
  )
}

const FLOW_POSITIONS = {
  plant: { x: 50, y: 54 },
  ess: { x: 19, y: 24 },
  ev: { x: 81, y: 24 },
  p2h: { x: 64, y: 80 },
}

const SATELLITE_TILE_URLS = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6503/13930',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6503/13931',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6503/13932',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6504/13930',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6504/13931',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6504/13932',
]

function getFlowWidth(value, maxValue) {
  if (value <= 0) {
    return 1.2
  }

  return 1.8 + (value / Math.max(maxValue, 0.001)) * 3.8
}

// ---- Flow Diagram ----
function FlowDiagram({ caseRows, essTot, evTot, p2hTot }) {
  const hasFlow = essTot + evTot + p2hTot > 0
  const surplus = caseRows.reduce((s, r) => s + (r.surplus_mwh ?? 0), 0)
  const maxFlow = Math.max(essTot, evTot, p2hTot, 0.001)
  const flows = [
    { id: 'ess', label: 'ESS', site: '안좌스마트팜앤쏠라시티', value: essTot, color: '#0ea5e9' },
    { id: 'ev', label: 'EV', site: '안좌한전 충전소', value: evTot, color: '#8b5cf6' },
    { id: 'p2h', label: 'P2H', site: '안좌면 행정복지센터', value: p2hTot, color: '#10b981' },
  ]
  const plant = FLOW_POSITIONS.plant

  return (
    <div className="sector-map-canvas">
      <div aria-hidden="true" className="sector-map-tile-grid">
        {SATELLITE_TILE_URLS.map((url) => (
          <div
            className="sector-map-tile"
            key={url}
            style={{ backgroundImage: `url("${url}")` }}
          />
        ))}
      </div>
      <div className="sector-map-overlay" />
      <div className="sector-map-label">Anjwa-myeon simulation layer</div>

      <svg
        preserveAspectRatio="none"
        className="sector-map-svg"
        viewBox="0 0 100 100"
      >
        <defs>
          <filter id="sectorFlowGlow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur result="coloredBlur" stdDeviation="1.6" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {flows.map((flow, index) => {
          const target = FLOW_POSITIONS[flow.id]
          const active = hasFlow && flow.value > 0
          const path = `M${plant.x},${plant.y} C${plant.x},${target.y} ${target.x},${plant.y} ${target.x},${target.y}`

          return (
            <g key={flow.id}>
              <path
                className={active ? 'sector-map-flow is-active' : 'sector-map-flow'}
                d={path}
                filter={active ? 'url(#sectorFlowGlow)' : undefined}
                stroke={active ? flow.color : 'rgba(203,213,225,0.55)'}
                strokeWidth={getFlowWidth(flow.value, maxFlow)}
                style={{ animationDelay: `${index * 0.28}s` }}
              />
              {active && (
                <circle
                  className="sector-map-pulse"
                  fill={flow.color}
                  r={1.1 + getFlowWidth(flow.value, maxFlow) * 0.12}
                  style={{ animationDelay: `${index * 0.35}s` }}
                >
                  <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
                </circle>
              )}
            </g>
          )
        })}
      </svg>

      <div className="sector-map-node sector-map-node-plant" style={{ left: `${plant.x}%`, top: `${plant.y}%` }}>
        <p className="sector-map-node-kicker">PV Plant</p>
        <p className="sector-map-node-name">
          안좌솔민발전소제1호
        </p>
        {surplus > 0 && (
          <p className="sector-map-node-value">
            잉여 {fmt(surplus, 2)} MWh
          </p>
        )}
      </div>

      {flows.map((flow) => {
        const pos = FLOW_POSITIONS[flow.id]
        const isPrimary = flow.value === maxFlow && flow.value > 0

        return (
          <div
            className={`sector-map-node sector-map-node-resource ${isPrimary ? 'is-primary' : ''}`}
            key={flow.id}
            style={{
              '--node-color': flow.color,
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          >
            <p className="sector-map-node-kicker">{flow.label}</p>
            <p className="sector-map-node-name">{flow.site}</p>
            {hasFlow && <p className="sector-map-node-value">{fmt(flow.value, 3)} MWh</p>}
          </div>
        )
      })}
    </div>
  )
}

// ---- Hourly Distribution Chart ----
function HourlyChart({ chartData }) {
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.07)',
        background: '#fff',
        padding: '14px 16px 10px',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 10,
        }}
      >
        시간대별 잉여전력 분배 현황
      </p>
      <div style={{ height: 170 }}>
        <ResponsiveContainer height="100%" initialDimension={{ width: 600, height: 200 }} width="100%">
          <BarChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: -22 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="hour"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(h) => `${h}시`}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(v) => `${v}`}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value, name) =>
                value > 0 ? [`${Number(value).toFixed(3)} MWh`, name] : [null, null]
              }
              labelFormatter={(l) => `${l}:00`}
            />
            <Bar dataKey="ESS" fill="#0ea5e9" maxBarSize={36} stackId="a" />
            <Bar dataKey="EV" fill="#8b5cf6" maxBarSize={36} stackId="a" />
            <Bar dataKey="P2H" fill="#10b981" maxBarSize={36} stackId="a" />
            <Bar
              dataKey="잔여제한"
              fill="rgba(148,163,184,0.28)"
              maxBarSize={36}
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        {[
          { color: '#0ea5e9', label: 'ESS 분배' },
          { color: '#8b5cf6', label: 'EV 분배' },
          { color: '#10b981', label: 'P2H 분배' },
          { color: 'rgba(148,163,184,0.5)', label: '잔여 제한' },
        ].map((item) => (
          <div
            key={item.label}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}
          >
            <div
              style={{ width: 9, height: 9, borderRadius: 2, background: item.color, flexShrink: 0 }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Compare Table ----
function CompareTable({ compareData, activeCase, socUtilByMethod }) {
  if (!compareData.length) return null

  const maxTotal = Math.max(...compareData.map((r) => r.totalMwh))

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.07)',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '13px 18px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          케이스 비교
        </p>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
          SOC 반영 활용률: 배터리 충전 상태를 반영해 실제로 가능한 값 (잉여 시간 사이 방전 없음 가정)
        </p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(248,250,252,0.9)' }}>
              {['구분', 'ESS 분배량', 'EV 분배량', 'P2H 분배량', '총 분배량', '잔여 제한량', '활용률', 'SOC 반영 활용률', 'ESS 사용 횟수'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: '9px 14px',
                      textAlign: h === '구분' ? 'left' : 'right',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#94a3b8',
                      letterSpacing: '0.03em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {compareData.map((row, i) => {
              const meta = COMPARE_META[row.구분]
              const isActive = meta?.caseId === activeCase
              const barPct = maxTotal > 0 ? (row.totalMwh / maxTotal) * 100 : 0

              return (
                <tr
                  key={i}
                  style={{
                    background: isActive ? `${meta?.color}0c` : 'transparent',
                    borderTop: i > 0 ? '1px solid rgba(15,23,42,0.04)' : 'none',
                  }}
                >
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: meta?.color ?? '#94a3b8',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? (meta?.color ?? '#0f172a') : '#0f172a',
                            fontSize: 13,
                          }}
                        >
                          {meta?.label ?? row.구분}
                        </p>
                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{row.구분}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#0ea5e9', fontWeight: 600 }}>
                    {fmt(row.essAllocMwh, 3)}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#8b5cf6', fontWeight: 600 }}>
                    {fmt(row.evAllocMwh, 3)}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                    {fmt(row.p2hAllocMwh, 3)}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>
                        {fmt(row.totalMwh, 3)} MWh
                      </span>
                      <div
                        style={{
                          width: 72,
                          height: 3,
                          background: 'rgba(15,23,42,0.06)',
                          borderRadius: 2,
                        }}
                      >
                        <div
                          style={{
                            width: `${barPct}%`,
                            height: '100%',
                            background: meta?.color ?? '#94a3b8',
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#64748b' }}>
                    {fmt(row.remainingMwh, 3)} MWh
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: meta?.caseId > 0 ? (meta?.color ?? '#64748b') : '#94a3b8',
                      }}
                    >
                      {fmt(row.utilizationPct, 2)}%
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {socUtilByMethod?.[row.구분] == null ? (
                      <span style={{ color: '#cbd5e1' }}>-</span>
                    ) : (
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            Math.abs(socUtilByMethod[row.구분] - row.utilizationPct) > 0.005
                              ? '#b45309'
                              : '#0f172a',
                        }}
                        title="충전 상태(SOC)를 반영한 실현 가능 활용률"
                      >
                        {fmt(socUtilByMethod[row.구분], 2)}%
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '11px 14px',
                      textAlign: 'right',
                      color: '#64748b',
                    }}
                  >
                    {row.essUsageCount}회
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Empty state ----
function EmptySectorState({ onForecastOpen }) {
  return (
    <div
      className="sector-shell"
      style={{ display: 'flex', alignItems: 'flex-start', padding: '48px 32px' }}
    >
      <div className="page-empty-card">
        <p
          style={{
            color: '#0ea5e9',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}
        >
          Sector Coupling
        </p>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: '#0f172a',
            marginBottom: 10,
          }}
        >
          먼저 신안군 발전소를 선택해주세요
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
          Forecast Map에서 신안군 내 발전소를 클릭한 후 Plant Detail → Sector Coupling Simulation
          순서로 이동하면, 선택 발전소 기반 잉여 전력 배분 시뮬레이션 결과를 확인할 수 있습니다.
        </p>
        <button className="page-primary-cta" onClick={onForecastOpen} type="button">
          Forecast Map으로 이동
        </button>
      </div>
    </div>
  )
}

// ---- Main component ----
function SectorCouplingPage({ onForecastOpen, selectedPlant, sectorCouplingCases }) {
  const [activeCase, setActiveCase] = useState(1)
  const [compareData, setCompareData] = useState([])

  useEffect(() => {
    fetch('/data/sector_coupling_compare.csv')
      .then((r) => r.text())
      .then((text) => {
        const { data } = Papa.parse(text.replace(/^\uFEFF/, ''), {
          header: true,
          skipEmptyLines: true,
        })
        setCompareData(
          data.map((row) => ({
            구분: String(row.구분 ?? '').trim(),
            essAllocMwh: Number(row.ESS_분배량_MWh) || 0,
            evAllocMwh: Number(row.EV_분배량_MWh) || 0,
            p2hAllocMwh: Number(row.P2H_분배량_MWh) || 0,
            totalMwh: Number(row.총_분배량_MWh) || 0,
            remainingMwh: Number(row.잔여_출력제한량_MWh) || 0,
            curtailmentReductionMwh: Number(row.출력제한_저감량_MWh) || 0,
            utilizationPct: Number(row['분배후_활용률_%']) || 0,
            essUsageCount: Number(row.ESS_사용시간_수) || 0,
            essReductionMwh: Number(row.ESS_사용량_감소량_MWh) || 0,
            essReductionPct: Number(row['ESS_사용량_감소율_%']) || 0,
          })),
        )
      })
      .catch(() => {})
  }, [])

  // 충전 상태(SOC)를 반영한 케이스별 실현 가능 활용률
  const socUtilByMethod = useMemo(() => {
    const rows = sectorCouplingCases?.case1 ?? []
    const surplus = surplusFromRows(rows)
    if (surplus.length === 0) {
      return {}
    }
    const resources = resourcesFromRows(rows)
    return Object.fromEntries(
      ESS_MODES.map((mode) => [
        mode.label,
        simulateAllocation(surplus, resources, { essHours: peakHours(surplus, mode.peaks), soc: true })
          .utilizationPct,
      ]),
    )
  }, [sectorCouplingCases])

  if (!selectedPlant) {
    return <EmptySectorState onForecastOpen={onForecastOpen} />
  }

  const caseInfo = CASE_DEFS[activeCase]
  const caseRows = sectorCouplingCases?.[`case${activeCase}`] ?? []

  const essTot = caseRows.reduce((s, r) => s + (r.ess_allocation_mwh ?? 0), 0)
  const evTot = caseRows.reduce((s, r) => s + (r.ev_allocation_mwh ?? 0), 0)
  const p2hTot = caseRows.reduce((s, r) => s + (r.p2h_allocation_mwh ?? 0), 0)
  const totalAlloc = essTot + evTot + p2hTot
  const maxAlloc = Math.max(essTot, evTot, p2hTot, 0.001)

  const currentCompare = compareData.find((r) => r.구분 === caseInfo.essMethod)
  const utilizationPct = currentCompare?.utilizationPct ?? 0

  const chartData = caseRows
    .filter((r) => r.hour >= 6 && r.hour <= 20)
    .map((r) => ({
      hour: r.hour,
      ESS: r.ess_allocation_mwh ?? 0,
      EV: r.ev_allocation_mwh ?? 0,
      P2H: r.p2h_allocation_mwh ?? 0,
      잔여제한: Math.max(0, r.remaining_curtailment_mwh ?? 0),
    }))

  return (
    <div className="sector-shell" style={{ gridTemplateRows: 'unset' }}>
      {/* Top bar */}
      <div className="sector-top-bar">
        <div>
          <p className="sector-plant-eyebrow">Sector Coupling Simulation</p>
          <h1 className="sector-plant-name">{selectedPlant.plant_name}</h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            전라남도 신안군 안좌면 · 출력제한 위험시간대 11~15시
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: 4,
            borderRadius: 999,
            background: 'rgba(248,250,252,0.92)',
            border: '1px solid rgba(15,23,42,0.08)',
          }}
        >
          {[1, 2, 3].map((c) => (
            <button
              key={c}
              onClick={() => setActiveCase(c)}
              style={{
                padding: '7px 20px',
                borderRadius: 20,
                border: `1px solid ${activeCase === c ? CASE_DEFS[c].color : 'transparent'}`,
                background: activeCase === c ? CASE_DEFS[c].color : 'transparent',
                color: activeCase === c ? '#fff' : '#64748b',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              type="button"
            >
              {CASE_DEFS[c].label}
            </button>
          ))}
        </div>
      </div>

      {/* Case method strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 16px',
          borderRadius: 8,
          background: caseInfo.bg,
          border: `1px solid ${caseInfo.border}`,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: caseInfo.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 700, color: caseInfo.color, fontSize: 13 }}>
          {caseInfo.essMethod}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>·</span>
        <span style={{ color: '#475569', fontSize: 12 }}>{caseInfo.note}</span>
      </div>

      {/* Main 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 328px', gap: 16 }}>
        {/* Left: flow diagram + chart */}
        <div>
          <FlowDiagram
            caseRows={caseRows}
            essTot={essTot}
            evTot={evTot}
            p2hTot={p2hTot}
          />
          <HourlyChart chartData={chartData} />
        </div>

        {/* Right: paper + allocation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Paper card */}
          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(15,23,42,0.07)',
              background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
              padding: '16px 18px',
              boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: caseInfo.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 7,
              }}
            >
              참조 논문
            </p>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.45,
                marginBottom: 12,
                letterSpacing: '-0.01em',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {caseInfo.paperTitle}
            </p>
            <FormulaCard caseInfo={caseInfo} />
          </div>

          {/* Allocation cards */}
          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(15,23,42,0.07)',
              background: '#fff',
              padding: '16px 18px',
              flex: 1,
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 14,
              }}
            >
              자원별 분배량 (합계)
            </p>

            {RESOURCES.map((res) => {
              const alloc =
                res.id === 'ess' ? essTot : res.id === 'ev' ? evTot : p2hTot
              const barPct = (alloc / maxAlloc) * 100

              return (
                <div key={res.id} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 5,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: res.color }}>
                        {res.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>
                        {res.site}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {fmt(alloc, 3)} MWh
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: 'rgba(15,23,42,0.06)',
                      borderRadius: 3,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barPct}%`,
                        background: res.color,
                        borderRadius: 3,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}

            <div
              style={{
                borderTop: '1px solid rgba(15,23,42,0.06)',
                paddingTop: 10,
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, color: '#64748b' }}>총 분배량</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {fmt(totalAlloc, 3)} MWh
              </span>
            </div>

            {/* Utilization rate */}
            <div
              style={{
                borderRadius: 10,
                background: caseInfo.bg,
                border: `1px solid ${caseInfo.border}`,
                padding: '12px 14px',
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: caseInfo.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 4,
                }}
              >
                분배후 활용률
              </p>
              <p
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: caseInfo.color,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {fmt(utilizationPct, 2)}
                <span style={{ fontSize: 14, marginLeft: 2, fontWeight: 600 }}>%</span>
              </p>
              {currentCompare && currentCompare.curtailmentReductionMwh > 0 && (
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 5 }}>
                  출력제한 저감 {fmt(currentCompare.curtailmentReductionMwh, 2)} MWh
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compare table */}
      <CompareTable activeCase={activeCase} compareData={compareData} socUtilByMethod={socUtilByMethod} />

      {/* What-if: 설계 변수 변경 → 활용률·필요 설비 즉시 계산 */}
      <WhatIfSimulator caseRows={sectorCouplingCases?.case1 ?? []} />
    </div>
  )
}

export default SectorCouplingPage
