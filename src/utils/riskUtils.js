export const riskClassNames = {
  정상: 'risk-low',
  주의: 'risk-high',
  위험: 'risk-critical',
  낮음: 'risk-low',
  보통: 'risk-normal',
  높음: 'risk-high',
  '매우 높음': 'risk-critical',
}

export const riskOrder = {
  정상: 1,
  주의: 2,
  위험: 3,
  낮음: 1,
  보통: 2,
  높음: 3,
  '매우 높음': 4,
}

export function getRiskClassName(level) {
  return riskClassNames[level] ?? riskClassNames.낮음
}

export function getRiskMessage(level) {
  if (level === '위험' || level === '매우 높음') {
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
  return [...items].sort((a, b) => b.risk_score - a.risk_score)
}

export function toRiskPercent(score) {
  if (score == null || Number.isNaN(score)) {
    return 0
  }

  return score <= 1 ? score * 100 : score
}

export function formatRiskScore(score) {
  if (score == null || Number.isNaN(score)) {
    return '-'
  }

  const normalized = toRiskPercent(score)
  return score <= 1 ? normalized.toFixed(1) : Number.isInteger(normalized) ? normalized : normalized.toFixed(1)
}
