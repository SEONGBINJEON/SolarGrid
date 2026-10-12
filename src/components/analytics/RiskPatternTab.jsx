import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, COLORS, GRID_STROKE, TOOLTIP_STYLE, fmt, levelOf } from './format'
import { Card, ChartBox } from './parts'

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function mix(from, to, t) {
  const a = from.match(/\w\w/g).map((h) => parseInt(h, 16))
  const b = to.match(/\w\w/g).map((h) => parseInt(h, 16))
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`
}

function cellStyle(score, limits) {
  const level = levelOf(score, limits)
  if (level === '위험') {
    return { background: COLORS.red, color: '#fff' }
  }
  if (level === '주의') {
    const t = Math.min(1, Math.max(0, (score - limits.warn) / (limits.action - limits.warn)))
    return { background: mix('fce3a6', 'e08a00', t), color: t > 0.55 ? '#fff' : '#1e293b' }
  }
  return { background: '#eef1f6', color: 'transparent' }
}

function Heatmap({ heatmap, limits }) {
  const columns = HOURS.map((h) => heatmap.hours.indexOf(h)).filter((i) => i >= 0)
  return (
    <div className="pa-heatmap" style={{ gridTemplateColumns: `92px repeat(${columns.length}, minmax(0, 1fr))` }}>
      <span />
      {columns.map((i) => (
        <span className="pa-heatmap-hour" key={`h-${i}`}>
          {heatmap.hours[i]}시
        </span>
      ))}
      {heatmap.regions.map((region, r) => [
        <span className="pa-heatmap-region" key={`r-${region}`}>
          {region}
        </span>,
        ...columns.map((i) => {
          const score = heatmap.scores[r][i]
          return (
            <span
              className="pa-heatmap-cell"
              key={`${region}-${i}`}
              style={cellStyle(score, limits)}
              title={`${region} ${heatmap.hours[i]}시 · 위험점수 ${fmt(score, 3)} (${levelOf(score, limits)})`}
            >
              {score >= limits.warn ? Math.round(score * 100) : ''}
            </span>
          )
        }),
      ])}
    </div>
  )
}

function RiskPatternTab({ data }) {
  const { risk, meta } = data
  const limits = meta.limits
  const factors = risk.correlations.factors
  const levels = risk.hourly_levels.filter((row) => row.hour >= 6 && row.hour <= 20)
  const riskyRegions = new Set(risk.events.map((e) => e.region)).size
  const profile = risk.jeonnam_profile.hours.map((hour, i) => ({ hour, mw: risk.jeonnam_profile.total_mw[i] }))

  return (
    <div className="pa-stack">
      <div className="pa-grid-2 is-wide-left">
        <Card
          right={
            <div className="pa-legend">
              <span><i style={{ background: '#eef1f6' }} />정상 &lt; {limits.warn}</span>
              <span><i style={{ background: '#f4b53f' }} />주의</span>
              <span><i style={{ background: COLORS.red }} />위험 ≥ {limits.action}</span>
            </div>
          }
          sub={`17개 시도 × 시간대별 예측 위험점수 (셀 값 = 점수×100) · ${meta.forecast_date}`}
          title="지역 × 시간 위험 히트맵"
        >
          <Heatmap heatmap={risk.heatmap} limits={limits} />
        </Card>

        <div className="pa-stack">
          <Card sub={`주간 ${risk.correlations.daytime_rows}개 지역·시간, Spearman 순위상관`} title="위험점수를 움직이는 요인">
            <ChartBox height={200}>
              <BarChart data={factors} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 0 }}>
                <XAxis domain={[-1, 1]} hide type="number" />
                <YAxis axisLine={false} dataKey="label" tick={{ ...AXIS_TICK, fontSize: 12 }} tickLine={false} type="category" width={52} />
                <ReferenceLine stroke={COLORS.light} x={0} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [fmt(value, 3), 'ρ']} />
                <Bar
                  dataKey="spearman"
                  label={{ position: 'right', fontSize: 11, fill: '#334155', formatter: (v) => (v > 0 ? `+${fmt(v, 2)}` : fmt(v, 2)) }}
                  maxBarSize={18}
                >
                  {factors.map((f) => (
                    <Cell fill={f.spearman >= 0 ? COLORS.navy : '#e8898c'} key={f.factor} />
                  ))}
                </Bar>
              </BarChart>
            </ChartBox>
            <p className="pa-note">일사량·기온이 높고 습도가 낮을수록 위험점수가 오릅니다. 모델 출력이 물리적으로 타당한 방향인지 점검한 결과입니다.</p>
          </Card>

          <Card sub={`주의 이상 신호가 나온 지역 ${riskyRegions}곳 · 시간대별 등급 분포`} title="시간대별 경보 분포">
            <ChartBox height={170}>
              <BarChart data={levels} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis axisLine={false} dataKey="hour" tick={{ ...AXIS_TICK, fontSize: 10 }} tickFormatter={(h) => `${h}`} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(h) => `${h}시`} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10.5 }} />
                <Bar dataKey="주의" fill="#f4b53f" stackId="l" />
                <Bar dataKey="위험" fill={COLORS.red} radius={[3, 3, 0, 0]} stackId="l" />
              </BarChart>
            </ChartBox>
          </Card>
        </div>
      </div>

      <Card
        sub={`전남 ${risk.jeonnam_profile.cities}개 시군 시간대별 발전량 합계 · 11~15시에 하루 발전량의 ${fmt(risk.jeonnam_profile.share_11_15_pct, 1)}% 집중`}
        title="공급 집중: 병목이 생기는 시간"
      >
        <ChartBox height={200}>
          <BarChart data={profile} margin={{ top: 6, right: 6, bottom: 0, left: -10 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis axisLine={false} dataKey="hour" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} />
            <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${fmt(value, 1)} MW`, '발전량']} labelFormatter={(h) => `${h}시`} />
            <Bar dataKey="mw" maxBarSize={26} radius={[3, 3, 0, 0]}>
              {profile.map((p) => (
                <Cell fill={p.hour >= 11 && p.hour <= 15 ? COLORS.amber : '#c5d0e3'} key={p.hour} />
              ))}
            </Bar>
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

export default RiskPatternTab
