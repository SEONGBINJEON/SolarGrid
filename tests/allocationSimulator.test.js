// 실행: npm test  (Node 내장 테스트 러너, 추가 의존성 없음)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_RESOURCES,
  peakHours,
  requiredEss,
  requiredP2hRatio,
  simulateAllocation,
  surplusFromRows,
} from '../src/utils/allocationSimulator.js'

// sector_coupling.csv 의 잉여 시간대 (2026-05-22, 안좌솔민발전소제1호)
const SURPLUS = [
  { hour: 11, surplus: 65.246874 },
  { hour: 13, surplus: 41.447526 },
  { hour: 14, surplus: 39.982657 },
  { hour: 15, surplus: 12.790568 },
]
// sector_coupling_compare.csv 의 팀 결과 (분배후 활용률 %)
const TEAM = { unlimited: 52.749147, peak1: 50.875412, peak2: 51.499991 }

const close = (actual, expected, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (±${tol})`)

test('팀이 해커톤에서 낸 Case 1~3 활용률을 재현한다', () => {
  close(simulateAllocation(SURPLUS).utilizationPct, TEAM.unlimited)
  close(simulateAllocation(SURPLUS, DEFAULT_RESOURCES, { essHours: peakHours(SURPLUS, 1) }).utilizationPct, TEAM.peak1)
  close(simulateAllocation(SURPLUS, DEFAULT_RESOURCES, { essHours: peakHours(SURPLUS, 2) }).utilizationPct, TEAM.peak2)
})

test('충전 상태(SOC)를 반영하면 Case 1의 실현값은 Case 2와 같다', () => {
  close(simulateAllocation(SURPLUS, DEFAULT_RESOURCES, { soc: true }).utilizationPct, TEAM.peak1, 1e-6)
  close(
    simulateAllocation(SURPLUS, DEFAULT_RESOURCES, { soc: true, dischargeInGaps: true }).utilizationPct,
    TEAM.peak2,
  )
})

test('매시간 에너지 수지가 맞고 잔여량은 음수가 아니다', () => {
  for (const soc of [false, true]) {
    for (const row of simulateAllocation(SURPLUS, DEFAULT_RESOURCES, { soc }).hourly) {
      close(row.p2h + row.ess + row.ev + row.remaining, row.surplus, 1e-9)
      assert.ok(row.remaining >= -1e-9)
    }
  }
})

test('목표 활용률 60%에 필요한 ESS는 약 15.5 MWh, P2H 비율은 약 59.1%', () => {
  close(requiredEss(SURPLUS, DEFAULT_RESOURCES, 60), 15.5, 0.1)
  close(requiredP2hRatio(SURPLUS, DEFAULT_RESOURCES, 60) * 100, 59.1, 0.1)
  assert.equal(requiredEss(SURPLUS, { ...DEFAULT_RESOURCES, p2hRatio: 0 }, 101), null)
})

test('CSV 행에서 잉여가 있는 시간만 뽑는다', () => {
  const rows = [
    { hour: 10, surplus_mwh: 0 },
    { hour: 13, surplus_mwh: 41.4 },
    { hour: 11, surplus_mwh: 65.2 },
  ]
  assert.deepEqual(surplusFromRows(rows).map((r) => r.hour), [11, 13])
})
