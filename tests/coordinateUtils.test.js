// 실행: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasValidPlantCoordinate, toCoordinate } from '../src/utils/coordinateUtils.js'

test('빈 좌표는 0이 아니라 좌표 없음으로 읽는다', () => {
  assert.equal(toCoordinate(''), null)
  assert.equal(toCoordinate('  '), null)
  assert.equal(toCoordinate(undefined), null)
  assert.equal(toCoordinate(null), null)
  assert.equal(toCoordinate('abc'), null)
  assert.equal(toCoordinate('34.8216'), 34.8216)
  assert.equal(toCoordinate(126.08), 126.08)
})

test('좌표화 실패 발전소는 지도 표시 대상에서 빠진다', () => {
  const plants = [
    { plant_id: 1, lat: 34.82, lng: 126.08 },
    { plant_id: 2, lat: '', lng: '' },
    { plant_id: 3, lat: '34.7', lng: '' },
  ]
  assert.deepEqual(
    plants.filter(hasValidPlantCoordinate).map((plant) => plant.plant_id),
    [1],
  )
})
