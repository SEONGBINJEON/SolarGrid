import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, COLORS, GRID_STROKE, TOOLTIP_STYLE, fmt } from './format'
import { Card, ChartBox, StatusBadge } from './parts'

function Funnel({ steps }) {
  const first = steps[0]?.value || 1
  return (
    <div className="pa-funnel">
      {steps.map((step, index) => (
        <div className="pa-funnel-step" key={step.step}>
          <p className="pa-funnel-label">{step.step}</p>
          <p className="pa-funnel-value">{step.value.toLocaleString('ko-KR')}</p>
          <div className="pa-funnel-bar">
            <span style={{ width: `${(step.value / first) * 100}%` }} />
          </div>
          <p className="pa-funnel-rate">원천 대비 {fmt((step.value / first) * 100, 1)}%</p>
          {index < steps.length - 1 && <span className="pa-funnel-arrow" aria-hidden="true">›</span>}
        </div>
      ))}
    </div>
  )
}

function QualityGate({ checks }) {
  return (
    <div className="pa-table-wrap">
      <table className="pa-table">
        <thead>
          <tr>
            <th>구분</th>
            <th>검사</th>
            <th>기준</th>
            <th>결과</th>
            <th className="is-center">판정</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id} title={check.detail || undefined}>
              <td className="is-muted is-nowrap">{check.category}</td>
              <td className="is-strong">{check.name}</td>
              <td className="is-muted">{check.target}</td>
              <td>{check.actual}</td>
              <td className="is-center">
                <StatusBadge status={check.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QualityTab({ data }) {
  const { quality, geocode } = data
  const [showAll, setShowAll] = useState(false)
  const causes = geocode.causes.map((c) => ({ ...c, label: c.rule_defect ? `${c.cause} ⚑` : c.cause }))
  const remaining = showAll ? geocode.remaining : geocode.remaining.slice(0, 8)
  const notes = quality.checks.filter((c) => c.status !== 'pass' && c.detail)

  return (
    <div className="pa-stack">
      <Card
        sub="정규화 → 좌표화 → 교차검증을 거치며 남는 발전소 수 (수율 흐름)"
        title="좌표화 공정 수율"
        right={
          <div className="pa-yield">
            <span>{fmt(geocode.before.yield_pct, 1)}%</span>
            <span className="pa-yield-arrow">→</span>
            <strong>{fmt(geocode.after.yield_pct, 1)}%</strong>
          </div>
        }
      >
        <Funnel steps={geocode.funnel} />
      </Card>

      <div className="pa-grid-2 is-wide-left">
        <Card
          sub={`통과 ${quality.summary.pass} · 주의 ${quality.summary.warn} · 실패 ${quality.summary.fail} · 행에 마우스를 올리면 판단 근거`}
          title="데이터 품질 게이트"
        >
          <QualityGate checks={quality.checks} />
          {notes.map((c) => (
            <p className="pa-note" key={c.id}>
              <StatusBadge status={c.status} /> {c.name}: {c.detail}
            </p>
          ))}
        </Card>

        <Card sub="좌표화 실패 원인을 분류해 규칙 결함부터 제거" title="개선 전후">
          <div className="pa-before-after">
            <div>
              <p>해커톤 버전</p>
              <strong>{fmt(geocode.before.yield_pct, 1)}%</strong>
              <small>실패 {geocode.before.failed}기</small>
            </div>
            <div className="is-after">
              <p>개선 후</p>
              <strong>{fmt(geocode.after.yield_pct, 1)}%</strong>
              <small>실패 {geocode.after.failed}기</small>
            </div>
          </div>
          <ul className="pa-list">
            <li>
              <b>{geocode.recovered.by_rule_fix}기</b> 정규화 규칙 수정으로 회복 (지명 속 ‘호’ 보존, ‘889번지2호’ → 889-2)
            </li>
            <li>
              <b>{geocode.recovered.by_alternate_parcel}기</b> 복수 지번의 다음 필지를 차례로 검색해 회복
            </li>
            <li>
              기존 성공 좌표는 그대로 유지하고, 읍면·리 교차검증 불일치 <b>0건</b>
            </li>
          </ul>
        </Card>
      </div>

      <div className="pa-grid-2">
        <Card
          sub={`주소 표기 불량 유형별 건수와 누적 비율 · 불량 주소 ${geocode.defect_rows.toLocaleString('ko-KR')}건 / ${geocode.plants.toLocaleString('ko-KR')}건`}
          title="주소 형식 불량 파레토"
        >
          <ChartBox height={260}>
            <ComposedChart data={geocode.defect_pareto} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis axisLine={false} dataKey="type" interval={0} tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} />
              <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} yAxisId="count" />
              <YAxis
                axisLine={false}
                domain={[0, 100]}
                orientation="right"
                tick={AXIS_TICK}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                yAxisId="cum"
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={COLORS.navy} maxBarSize={46} name="건수" radius={[4, 4, 0, 0]} yAxisId="count" />
              <Line dataKey="cum_pct" dot={{ r: 3 }} name="누적 비율(%)" stroke={COLORS.amber} strokeWidth={2} yAxisId="cum" />
            </ComposedChart>
          </ChartBox>
        </Card>

        <Card sub="⚑ = 보정 규칙 자체가 만든 불량 · 회색 수정 전, 남색 수정 후" title="좌표화 실패 근본원인 (RCA)">
          <ChartBox height={260}>
            <BarChart data={causes} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 24 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
              <XAxis axisLine={false} tick={AXIS_TICK} tickLine={false} type="number" />
              <YAxis
                axisLine={false}
                dataKey="label"
                tick={{ ...AXIS_TICK, fontSize: 10.5 }}
                tickLine={false}
                type="category"
                width={140}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="before" fill={COLORS.light} name="수정 전" radius={[0, 3, 3, 0]}>
                {causes.map((c) => (
                  <Cell fill={c.rule_defect ? '#fcd9a8' : COLORS.light} key={c.cause} />
                ))}
              </Bar>
              <Bar dataKey="after" fill={COLORS.navy} name="수정 후" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>

      <Card
        right={
          geocode.remaining.length > 8 && (
            <button className="pa-link" onClick={() => setShowAll((v) => !v)} type="button">
              {showAll ? '접기' : `전체 ${geocode.remaining.length}건 보기`}
            </button>
          )
        }
        sub="자동 보정으로 해결되지 않아 수기 검토가 필요한 발전소"
        title={`남은 좌표화 실패 ${geocode.remaining.length}기`}
      >
        <div className="pa-table-wrap">
          <table className="pa-table">
            <thead>
              <tr>
                <th>원인</th>
                <th>발전소</th>
                <th>원본 주소</th>
              </tr>
            </thead>
            <tbody>
              {remaining.map((row) => (
                <tr key={row.plant_id}>
                  <td className="is-muted">{row.cause}</td>
                  <td className="is-strong">{row.plant_name}</td>
                  <td>{row.original_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default QualityTab
