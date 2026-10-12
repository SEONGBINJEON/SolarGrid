import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, COLORS, GRID_STROKE, TOOLTIP_STYLE, fmt } from './format'
import { Card, ChartBox } from './parts'

const ABC_COLORS = { A: COLORS.navy, B: '#5b7bb5', C: COLORS.light }
const SIZE_COLORS = ['#f5a623', '#8fa6cb', '#0e2a5c', '#5b7bb5']

function CapacityTab({ data }) {
  const { capacity } = data
  const curve = capacity.curve.map((p) => ({ ...p, equal: p.plant_pct }))
  const sizeRows = [
    { name: '발전소 수', ...Object.fromEntries(capacity.size_classes.map((c) => [c.class, c.plant_pct])) },
    { name: '설비용량', ...Object.fromEntries(capacity.size_classes.map((c) => [c.class, c.capacity_pct])) },
  ]
  const townships = capacity.townships.filter((t) => t.township !== '미상')
  const permits = capacity.permits

  return (
    <div className="pa-stack">
      <div className="pa-grid-2 is-wide-left">
        <Card
          sub={`용량이 큰 순서로 정렬한 발전소 비율 대비 누적 설비용량 · 신안군 ${capacity.plants.toLocaleString('ko-KR')}기 ${fmt(capacity.total_mw, 1)} MW`}
          title="설비용량 파레토 곡선"
          right={
            <div className="pa-pill-group">
              <span className="pa-pill">상위 20% → {fmt(capacity.top20_pct, 1)}%</span>
              <span className="pa-pill is-strong">상위 40% → {fmt(capacity.top40_pct, 1)}%</span>
            </div>
          }
        >
          <ChartBox height={280}>
            <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 8, left: -6 }}>
              <CartesianGrid stroke={GRID_STROKE} />
              <XAxis
                axisLine={false}
                dataKey="plant_pct"
                domain={[0, 100]}
                tick={AXIS_TICK}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                ticks={[0, 20, 40, 60, 80, 100]}
                type="number"
              />
              <YAxis axisLine={false} domain={[0, 100]} tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} tickLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [`${fmt(value, 1)}%`, name]}
                labelFormatter={(v) => `상위 ${v}% 발전소`}
              />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="capacity_pct" dot={false} name="누적 설비용량" stroke={COLORS.navy} strokeWidth={2.5} type="monotone" />
              <Line dataKey="equal" dot={false} name="균등 분포" stroke={COLORS.slate} strokeDasharray="5 5" strokeWidth={1.2} />
            </LineChart>
          </ChartBox>
        </Card>

        <Card sub="누적 용량 80% / 95% 기준 ABC 분류 → 관리 우선순위" title="ABC 분류">
          <div className="pa-abc">
            {capacity.abc.map((c) => (
              <div className="pa-abc-row" key={c.grade}>
                <span className="pa-abc-grade" style={{ background: ABC_COLORS[c.grade] }}>
                  {c.grade}
                </span>
                <div className="pa-abc-body">
                  <p>
                    <b>{c.plants.toLocaleString('ko-KR')}기</b> · 발전소의 {fmt(c.plant_pct, 1)}%
                  </p>
                  <div className="pa-abc-bar">
                    <span style={{ width: `${c.capacity_pct}%`, background: ABC_COLORS[c.grade] }} />
                  </div>
                  <small>
                    용량 {fmt(c.capacity_mw, 1)} MW · {fmt(c.capacity_pct, 1)}%
                  </small>
                </div>
              </div>
            ))}
          </div>
          <p className="pa-note">A등급을 우선 모니터링하면 발전소 40%만 보고도 설비용량 80%를 관리할 수 있습니다.</p>
        </Card>
      </div>

      <div className="pa-grid-2">
        <Card sub="개수 비중과 용량 비중이 정반대인 구조" title="규모 구간별 비중">
          <ChartBox height={200}>
            <BarChart data={sizeRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} stackOffset="expand">
              <XAxis hide type="number" />
              <YAxis axisLine={false} dataKey="name" tick={{ ...AXIS_TICK, fontSize: 12 }} tickLine={false} type="category" width={64} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [`${fmt(value, 1)}%`, name]} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
              {capacity.size_classes.map((c, i) => (
                <Bar dataKey={c.class} fill={SIZE_COLORS[i % SIZE_COLORS.length]} key={c.class} maxBarSize={38} stackId="s">
                  <LabelList
                    dataKey={c.class}
                    fill={i === 0 ? '#1e293b' : '#ffffff'}
                    fontSize={11}
                    fontWeight={700}
                    formatter={(v) => (v >= 6 ? `${fmt(v, 1)}%` : '')}
                    position="center"
                  />
                </Bar>
              ))}
            </BarChart>
          </ChartBox>
        </Card>

        <Card sub="읍면별 설비용량(MW)과 누적 비중" title="읍면별 설비 집중도">
          <ChartBox height={200}>
            <ComposedChart data={townships} margin={{ top: 6, right: 4, bottom: 4, left: -14 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis axisLine={false} dataKey="township" interval={0} tick={{ ...AXIS_TICK, fontSize: 9.5 }} tickLine={false} />
              <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} yAxisId="mw" />
              <YAxis axisLine={false} domain={[0, 100]} hide orientation="right" yAxisId="cum" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="capacity_mw" fill={COLORS.navy} maxBarSize={22} name="설비용량(MW)" radius={[3, 3, 0, 0]} yAxisId="mw" />
              <Line dataKey="cum_pct" dot={false} name="누적 비중(%)" stroke={COLORS.amber} strokeWidth={2} yAxisId="cum" />
            </ComposedChart>
          </ChartBox>
        </Card>
      </div>

      <Card
        sub={`사업개시일이 비어 있는 설비를 미개시로 집계 · 미개시 ${fmt(permits.pending_mw, 1)} MW (${fmt(permits.pending_share_pct, 0)}%)`}
        title="허가 연도별 설비용량: 계통 병목 앞의 대기 물량"
      >
        <ChartBox height={220}>
          <BarChart data={permits.years} margin={{ top: 6, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis axisLine={false} dataKey="label" tick={AXIS_TICK} tickLine={false} />
            <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [`${fmt(value, 1)} MW`, name]} />
            <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="operating_mw" fill={COLORS.navy} maxBarSize={40} name="사업개시" stackId="p" />
            <Bar dataKey="pending_mw" fill={COLORS.amber} maxBarSize={40} name="미개시" radius={[3, 3, 0, 0]} stackId="p" />
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

export default CapacityTab
