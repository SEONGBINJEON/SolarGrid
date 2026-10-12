import { useEffect, useState } from 'react'

// Python 분석 파이프라인(analysis/run_analysis.py)이 만든 결과를 읽는다.
function useAnalytics() {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    let alive = true

    fetch('/data/analytics.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`analytics.json 로딩 실패 (HTTP ${response.status})`)
        }
        return response.json()
      })
      .then((data) => {
        if (alive) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (alive) {
          setState({ data: null, loading: false, error })
        }
      })

    return () => {
      alive = false
    }
  }, [])

  return state
}

export default useAnalytics
