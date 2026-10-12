// 공정 분석 화면 공통 포맷·색상

export const COLORS = {
  navy: '#0e2a5c',
  slate: '#94a3b8',
  light: '#cbd5e1',
  amber: '#f59e0b',
  amberDark: '#b45309',
  red: '#e5484d',
  green: '#12a150',
  sky: '#0ea5e9',
}

export const AXIS_TICK = { fill: '#64748b', fontSize: 11 }
export const GRID_STROKE = 'rgba(148,163,184,0.18)'
export const TOOLTIP_STYLE = { borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }

export function fmt(value, digits = 1) {
  const number = Number(value)
  return Number.isFinite(number)
    ? number.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '-'
}

export function levelOf(score, limits) {
  if (score >= limits.action) {
    return '위험'
  }
  if (score >= limits.warn) {
    return '주의'
  }
  return '정상'
}
