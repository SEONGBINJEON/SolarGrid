import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatRiskScore } from '../utils/riskUtils'
import RiskBadge from './RiskBadge'

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0].payload

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-[13px] text-slate-500">{formatHour(label)}</p>
      <p className="text-[15px] font-semibold text-slate-950">
        {Number(point.solar_generation).toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })}{' '}
        {unit}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-600">
        <span>위험도 점수 {formatRiskScore(point.risk_score)}점</span>
        <RiskBadge level={point.risk_level} />
      </div>
    </div>
  )
}

function ForecastChart({
  forecastRows,
  selectedDate,
  selectedPlant,
  selectedRegion,
  timeSeriesRows,
  unit = 'MWh',
  viewLevel,
}) {
  const preferredRegion =
    selectedPlant?.plant_name ??
    selectedRegion?.region ??
    (viewLevel === 'national' ? '전라남도' : '전라남도')
  const preferredRows = forecastRows.filter(
    (point) => point.date === selectedDate && point.region === preferredRegion,
  )
  const fallbackRows = forecastRows.filter(
    (point) => point.date === selectedDate && point.region === '전라남도',
  )
  const data = timeSeriesRows?.length
    ? timeSeriesRows
    : preferredRows.length > 0
      ? preferredRows
      : fallbackRows

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
            시간대별 예측 발전량
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">선택한 대상의 시간대별 발전량 흐름</p>
        </div>
        <span className="text-[12px] font-medium text-slate-500">{unit}</span>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[210px] items-center justify-center rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-500">
          선택한 대상의 시간대별 예측 데이터가 없습니다.
        </div>
      ) : (
        <div className="h-[210px] rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <ResponsiveContainer height="100%" initialDimension={{ width: 600, height: 200 }} width="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="solarGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0.04} />
                </linearGradient>
              </defs>
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
              <Tooltip content={<CustomTooltip unit={unit} />} />
              <Area
                dataKey="solar_generation"
                fill="url(#solarGradient)"
                stroke="#facc15"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default ForecastChart
