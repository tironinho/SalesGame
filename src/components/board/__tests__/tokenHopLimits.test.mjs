import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TOKEN_HOP_MAX_STEPS,
  forwardBoardDistance,
  planTokenHop,
} from '../tokenHop.js'

const TRACK_LEN = 40

test('animação = exatamente as casas do dado (1–6), nunca mais que 6', () => {
  assert.equal(TOKEN_HOP_MAX_STEPS, 6)

  for (let steps = 1; steps <= 6; steps += 1) {
    const plan = planTokenHop(0, steps, TRACK_LEN)
    assert.equal(plan.mode, 'hop')
    assert.equal(plan.path.length, steps)
    assert.equal(plan.path[plan.path.length - 1], steps)
    assert.ok(plan.path.length <= 6)
  }

  // Dado 5 a partir da casa 10 → path 11,12,13,14,15
  const from10 = planTokenHop(10, 15, TRACK_LEN)
  assert.equal(from10.mode, 'hop')
  assert.deepEqual(from10.path, [11, 12, 13, 14, 15])
})

test('distância > 6 (sync/stale) → snap, sem volta fantasma', () => {
  assert.equal(forwardBoardDistance(12, 10, TRACK_LEN), 38)
  const behind = planTokenHop(12, 10, TRACK_LEN)
  assert.equal(behind.mode, 'snap')
  assert.equal(behind.target, 10)

  assert.equal(forwardBoardDistance(5, 0, TRACK_LEN), 35)
  const wrap = planTokenHop(5, 0, TRACK_LEN)
  assert.equal(wrap.mode, 'snap')
  assert.equal(wrap.target, 0)

  // Mesma casa
  assert.equal(planTokenHop(7, 7, TRACK_LEN).mode, 'snap')
})
