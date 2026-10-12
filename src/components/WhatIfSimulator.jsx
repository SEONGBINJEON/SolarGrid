import { useMemo, useState } from 'react'
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
  requiredEss,
  requiredP2hRatio,
  resourcesFromRows,
  simulateAllocation,
  surplusFromRows,
} from '../utils/allocationSimulator'

const TARGETS = [60, 70, 80]
const COLORS = { p2h: '#10b981', ess: '#0ea5e9', ev: '#8b5cf6', remaining: 'rgba(148,163,184,0.45)' }
const PLAN = { mode: 'peak1', soc: true } // 현재 운영안: Case 2 + 충전 상태 반영

const fmt = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : '-')

function SliderField({ label, value, min, max, step, unit, display, onChange }) {
  return (
    <label className="wi-field">
      <span className="wi-field-head">
        <span>{label}</span>
        <strong>
          {display ?? value}
          <small>{unit}</small>
        </strong>
      </span>
      <input
        className="wi-slider"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  )
}

function Kpi({ label, value, unit, sub, tone }) {
  return (
    <div className={`wi-kpi ${tone ? `is-${tone}` : ''}`}>
      <p className="wi-kpi-label">{label}</p>
      <p className="wi-kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </p>
      {sub && <p className="wi-kpi-sub">{sub}</p>}
    </div>
  )
}

function WhatIfSimulator({ caseRows }) {
  const surplus = useMemo(() => surplusFromRows(caseRows), [caseRows])
  const base = useMemo(() => resourcesFromRows(caseRows), [caseRows])
  const [overrides, setOverrides] = useState({})
  const [mode, setMode] = useState(PLAN.mode)
  const [soc, setSoc] = useState(PLAN.soc)
  const [target, setTarget] = useState(TARGETS[0])

  const resources = { ...base, ...overrides }
  const modeDef = ESS_MODES.find((item) => item.id === mode) ?? ESS_MODES[0]

  const result = simulateAllocation(surplus, resources, {
    essHours: peakHours(surplus, modeDef.peaks),
    soc,
  })
  const plan = simulateAllocation(surplus, base, {
    essHours: peakHours(surplus, ESS_MODES.find((item) => item.id === PLAN.mode).peaks),
    soc: PLAN.soc,
  })
  const needEss = requiredEss(surplus, resources, target, { soc: true })
  const needP2h = requiredP2hRatio(surplus, resources, target, { soc: true })
  const delta = result.utilizationPct - plan.utilizationPct
  const chargedTotal = result.essMwh
  const overCharged = !soc && chargedTotal > resources.essMwh + 1e-9

  const chartData = result.hourly.map((row) => ({
    hour: `${row.hour}시`,
    P2H: row.p2h,
    ESS: row.ess,
    EV: row.ev,
    잔여: row.remaining,
  }))

  const setValue = (key) => (value) => setOverrides((current) => ({ ...current, [key]: value }))
  const reset = () => {
    setOverrides({})
    setMode(PLAN.mode)
    setSoc(PLAN.soc)
  }

  if (surplus.length === 0) {
    return null
  }

  return (
    <section className="wi-card">
      <div className="wi-head">
        <div>
          <p className="wi-eyebrow">What-if Simulator</p>
          <h3 className="wi-title">설계 변수를 바꿔 활용률과 필요 설비를 미리 계산합니다</h3>
          <p className="wi-desc">
            팀 분배 규칙(ESS → P2H → EV)을 그대로 쓰고, 잉여 시간대 {surplus.map((s) => s.hour).join('·')}시의
            추정 잉여 {fmt(result.surplusMwh, 1)} MWh를 다시 나눕니다.
          </p>
        </div>
        <button className="wi-reset" onClick={reset} type="button">
          현재 운영안으로 초기화
        </button>
      </div>

      <div className="wi-grid">
        <div className="wi-controls">
          <SliderField
            display={Math.round(resources.p2hRatio * 100)}
            label="P2H 전환비율"
            max={100}
            min={0}
            onChange={(value) => setValue('p2hRatio')(value / 100)}
            step={1}
            unit="%"
            value={Math.round(resources.p2hRatio * 100)}
          />
          <SliderField
            display={fmt(resources.essMwh, 1)}
            label="ESS 용량"
            max={60}
            min={0}
            onChange={setValue('essMwh')}
            step={0.5}
            unit="MWh"
            value={resources.essMwh}
          />
          <SliderField
            display={fmt(resources.evMwhPerH, 2)}
            label="EV 수용량"
            max={2}
            min={0}
            onChange={setValue('evMwhPerH')}
            step={0.05}
            unit="MWh/h"
            value={resources.evMwhPerH}
          />

          <div className="wi-field">
            <span className="wi-field-head">
              <span>ESS 운전 전략</span>
            </span>
            <div className="wi-chips">
              {ESS_MODES.map((item) => (
                <button
                  className={`wi-chip ${mode === item.id ? 'is-active' : ''}`}
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  type="button"
                >
                  {item.caseLabel}
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
          </div>

          <label className="wi-switch">
            <input checked={soc} onChange={(event) => setSoc(event.target.checked)} type="checkbox" />
            <span className="wi-switch-track" aria-hidden="true" />
            <span>
              충전 상태(SOC) 반영
              <small>잉여 시간 사이에 방전하지 않는다고 보고 누적 충전량을 용량으로 제한</small>
            </span>
          </label>
        </div>

        <div className="wi-results">
          <div className="wi-kpis">
            <Kpi
              label="분배 후 활용률"
              sub={`현재 운영안 ${fmt(plan.utilizationPct)}% 대비 ${delta >= 0 ? '+' : ''}${fmt(delta)}%p`}
              tone={delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : undefined}
              unit="%"
              value={fmt(result.utilizationPct)}
            />
            <Kpi label="흡수량" sub={`잉여 ${fmt(result.surplusMwh, 1)} MWh 중`} unit="MWh" value={fmt(result.absorbedMwh, 1)} />
            <Kpi label="잔여 출력제한" unit="MWh" value={fmt(result.remainingMwh, 1)} />
            <Kpi
              label="ESS 가동"
              sub={`누적 충전 ${fmt(chargedTotal, 2)} MWh`}
              tone={overCharged ? 'warn' : undefined}
              unit="회"
              value={result.essUses}
            />
          </div>

          {overCharged && (
            <p className="wi-note is-warn">
              충전 상태를 반영하지 않아 {fmt(resources.essMwh, 2)} MWh ESS가 매번 비어 있다고 가정했습니다. 누적
              충전량 {fmt(chargedTotal, 2)} MWh는 방전 없이는 불가능하므로, SOC 반영 값을 기준으로 판단하세요.
            </p>
          )}

          <div className="wi-capa">
            <div className="wi-capa-head">
              <span>목표 활용률을 맞추려면 (CAPA 역산, SOC 반영)</span>
              <div className="wi-chips is-compact">
                {TARGETS.map((value) => (
                  <button
                    className={`wi-chip ${target === value ? 'is-active' : ''}`}
                    key={value}
                    onClick={() => setTarget(value)}
                    type="button"
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
            <div className="wi-capa-body">
              <div>
                <p>ESS만 늘릴 때</p>
                <strong>{needEss == null ? '달성 불가' : `${fmt(needEss, 1)} MWh`}</strong>
                <small>P2H {Math.round(resources.p2hRatio * 100)}% 유지</small>
              </div>
              <div>
                <p>P2H 비율만 올릴 때</p>
                <strong>{needP2h == null ? '달성 불가' : `${fmt(needP2h * 100, 1)}%`}</strong>
                <small>ESS {fmt(resources.essMwh, 1)} MWh 유지</small>
              </div>
            </div>
          </div>

          <div className="wi-chart">
            <ResponsiveContainer height="100%" initialDimension={{ width: 600, height: 200 }} width="100%">
              <BarChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis axisLine={false} dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value, name) => [`${Number(value).toFixed(2)} MWh`, name]}
                />
                <Bar dataKey="P2H" fill={COLORS.p2h} maxBarSize={44} stackId="a" />
                <Bar dataKey="ESS" fill={COLORS.ess} maxBarSize={44} stackId="a" />
                <Bar dataKey="EV" fill={COLORS.ev} maxBarSize={44} stackId="a" />
                <Bar dataKey="잔여" fill={COLORS.remaining} maxBarSize={44} radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhatIfSimulator
