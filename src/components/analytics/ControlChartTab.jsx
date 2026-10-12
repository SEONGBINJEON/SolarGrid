import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, COLORS, GRID_STROKE, TOOLTIP_STYLE, fmt, levelOf } from './format'
import { Card, ChartBox, LevelBadge } from './parts'

function RiskDot({ cx, cy, payload, limits }) {
  if (cx == null || cy == null) {
    return null
  }
  const level = levelOf(payload.score, limits)
  const fill = level === '위험' ? COLORS.red : level === '주의' ? COLORS.amber : COLORS.navy
  const r = level === '정상' ? 2.5 : 5
  return <circle cx={cx} cy={cy} fill={fill} r={r} stroke="#fff" strokeWidth={level === '정상' ? 0 : 1.5} />
}

function ControlChartTab({ data }) {
  const { risk, meta } = data
  const limits = meta.limits
  const regions = risk.heatmap.regions
  // 기본 선택: 지속 경보이면서 조치 한계를 넘은 첫 지역 (관리도의 두 규칙이 모두 보이는 사례)
  const defaultRegion = risk.events.find((e) => e.sustained && e.action_limit_exceeded)?.region ?? regions[0]
  const [region, setRegion] = useState(defaultRegion)
  const [onlySelected, setOnlySelected] = useState(false)

  const rowIndex = regions.indexOf(region)
  const series = risk.heatmap.hours.map((hour, i) => ({ hour, score: risk.heatmap.scores[rowIndex][i] }))
  const regionEvents = risk.events.filter((e) => e.region === region)
  const events = onlySelected ? regionEvents : risk.events
  const peak = series.reduce((best, p) => (p.score > best.score ? p : best), series[0])
  const sustainedCount = risk.events.filter((e) => e.sustained).length
  const actionCount = risk.events.filter((e) => e.action_limit_exceeded).length

  return (
    <div className="pa-stack">
      <div className="pa-grid-2 is-wide-left">
        <Card
          right={
            <select className="pa-select" onChange={(event) => setRegion(event.target.value)} value={region}>
              {regions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          }
          sub={`음영 = 경고 한계 이상 구간 · 최고 ${fmt(peak.score, 3)} (${peak.hour}시, ${levelOf(peak.score, limits)})`}
          title={`관리도: ${region} 시간대별 위험점수`}
        >
          <ChartBox height={300}>
            <LineChart data={series} margin={{ top: 14, right: 70, bottom: 8, left: -6 }}>
              <CartesianGrid stroke={GRID_STROKE} />
              <XAxis
                axisLine={false}
                dataKey="hour"
                domain={[1, 24]}
                tick={AXIS_TICK}
                tickFormatter={(h) => `${h}시`}
                tickLine={false}
                ticks={[1, 4, 8, 12, 16, 20, 24]}
                type="number"
              />
              <YAxis axisLine={false} domain={[0, 0.5]} tick={AXIS_TICK} tickFormatter={(v) => v.toFixed(1)} tickLine={false} ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5]} />
              {regionEvents.map((e) => (
                <ReferenceArea
                  fill={e.action_limit_exceeded ? '#fdecec' : '#fff4e0'}
                  fillOpacity={0.9}
                  key={`${e.start_hour}-${e.end_hour}`}
                  x1={e.start_hour - 0.5}
                  x2={e.end_hour + 0.5}
                />
              ))}
              <ReferenceLine
                label={{ value: `조치 한계 ${limits.action}`, position: 'right', fill: COLORS.red, fontSize: 11 }}
                stroke={COLORS.red}
                strokeDasharray="6 4"
                y={limits.action}
              />
              <ReferenceLine
                label={{ value: `경고 한계 ${limits.warn}`, position: 'right', fill: COLORS.amberDark, fontSize: 11 }}
                stroke={COLORS.amber}
                strokeDasharray="6 4"
                y={limits.warn}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [`${fmt(value, 3)} (${levelOf(value, limits)})`, '위험점수']}
                labelFormatter={(h) => `${h}시`}
              />
              <Line
                dataKey="score"
                dot={<RiskDot limits={limits} />}
                isAnimationActive={false}
                stroke={COLORS.navy}
                strokeWidth={2}
                type="linear"
              />
            </LineChart>
          </ChartBox>
        </Card>

        <Card sub="관리 한계를 넘으면 사람이 판단하기 전에 조치가 정해지도록 표준화" title="관리 규칙과 조치 (OCAP)">
          <ol className="pa-rules">
            <li>
              <b>경고 한계 {limits.warn}</b> 이상이면 ‘주의’ 등급으로 선제 대응합니다.
              <small>{risk.ocap['주의']}</small>
            </li>
            <li>
              <b>조치 한계 {limits.action}</b> 이상이면 ‘위험’ 등급으로 적극 분산합니다.
              <small>{risk.ocap['위험']}</small>
            </li>
            <li>
              경고 이상이 <b>{limits.sustain_hours}시간 연속</b>이면 ‘지속 경보’로 올려 운영 계획을 다시 봅니다.
              <small>일시적 피크와 구조적 과잉을 구분하기 위한 연속 규칙</small>
            </li>
          </ol>
          <div className="pa-mini-kpis">
            <div>
              <strong>{risk.events.length}</strong>
              <span>경보 이벤트</span>
            </div>
            <div>
              <strong>{sustainedCount}</strong>
              <span>지속 경보</span>
            </div>
            <div className="is-danger">
              <strong>{actionCount}</strong>
              <span>조치 한계 초과</span>
            </div>
          </div>
        </Card>
      </div>

      <Card
        right={
          <label className="pa-check">
            <input checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} type="checkbox" />
            {region}만 보기
          </label>
        }
        sub="경고 한계 이상이 이어진 구간을 하나의 이벤트로 묶어 최고점 순으로 정렬"
        title="경보 이벤트 기록"
      >
        <div className="pa-table-wrap is-scroll">
          <table className="pa-table">
            <thead>
              <tr>
                <th>지역</th>
                <th>구간</th>
                <th className="is-right">지속</th>
                <th className="is-right">최고점</th>
                <th className="is-center">등급</th>
                <th className="is-center">지속 경보</th>
                <th>표준 조치</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  className={e.region === region ? 'is-selected' : ''}
                  key={`${e.region}-${e.start_hour}`}
                  onClick={() => setRegion(e.region)}
                >
                  <td className="is-strong">{e.region}</td>
                  <td>
                    {e.start_hour}~{e.end_hour}시
                  </td>
                  <td className="is-right">{e.duration_h}시간</td>
                  <td className="is-right">{fmt(e.peak_score, 3)}</td>
                  <td className="is-center">
                    <LevelBadge level={e.peak_level} />
                  </td>
                  <td className="is-center">{e.sustained ? '●' : ''}</td>
                  <td className="is-muted">{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default ControlChartTab
