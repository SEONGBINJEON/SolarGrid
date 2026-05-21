export const riskClassNames = {
  낮음: 'risk-low',
  매우높음: 'risk-critical',
  보통: 'risk-normal',
  위험: 'risk-critical',
  정상: 'risk-low',
  주의: 'risk-high',
  높음: 'risk-high',
  '매우 높음': 'risk-critical',
}

export const riskOrder = {
  낮음: 1,
  보통: 2,
  정상: 1,
  주의: 2,
  위험: 3,
  높음: 3,
  매우높음: 4,
  '매우 높음': 4,
}

export function getRiskClassName(level) {
  return riskClassNames[level] ?? riskClassNames.정상
}

export function getRiskMessage(level) {
  if (level === '위험' || level === '매우 높음' || level === '매우높음') {
    return '출력제어 가능성이 매우 높습니다. 계통 수용 여유를 즉시 확인하세요.'
  }

  if (level === '주의' || level === '높음') {
    return '피크 시간대 출력제어 가능성이 높습니다. 사전 대응이 필요합니다.'
  }

  if (level === '보통') {
    return '출력제어 가능성이 일부 존재합니다. 시간대별 추이를 모니터링하세요.'
  }

  return '현재 출력제어 위험은 낮습니다.'
}

export function sortByRiskScore(items) {
  return [...items].sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0))
}

export function toRiskPercent(score) {
  if (score == null || Number.isNaN(Number(score))) {
    return 0
  }

  const numericScore = Number(score)
  return numericScore <= 1 ? numericScore * 100 : numericScore
}

export function formatRiskScore(score) {
  if (score == null || Number.isNaN(Number(score))) {
    return '-'
  }

  const numericScore = Number(score)
  const normalized = toRiskPercent(numericScore)
  return numericScore <= 1
    ? normalized.toFixed(1)
    : Number.isInteger(normalized)
      ? normalized
      : normalized.toFixed(1)
}
