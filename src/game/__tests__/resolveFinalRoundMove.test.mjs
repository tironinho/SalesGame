import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFinalRoundMove, crossedTile } from '../resolveFinalRoundMove.js'

test('crossedTile detecta wrap pela casa 0', () => {
  assert.equal(crossedTile(38, 3, 0), true)
  assert.equal(crossedTile(10, 15, 0), false)
  assert.equal(crossedTile(39, 0, 0), true)
})

test('maxRounds=1 com 2+ vivos: wrap estaciona na casa 0 e não processa tile além', () => {
  const r = resolveFinalRoundMove({
    oldPos: 37,
    steps: 5,
    trackLen: 40,
    roundNow: 1,
    maxRounds: 1,
    aliveCount: 2,
  })
  assert.equal(r.mathPos, 2)
  assert.equal(r.finalPos, 0)
  assert.equal(r.landPos, 0)
  assert.equal(r.crossedStart, true)
  assert.equal(r.waitingAtRevenue, true)
  assert.equal(r.stopAtRevenue, true)
  assert.equal(r.processLandTile, false)
  assert.equal(r.lastRevenueRound, 1)
})

test('maxRounds=1 solo: wrap NÃO estaciona — pousa na casa matemática e pode processar tile', () => {
  const r = resolveFinalRoundMove({
    oldPos: 37,
    steps: 5,
    trackLen: 40,
    roundNow: 1,
    maxRounds: 1,
    aliveCount: 1,
  })
  assert.equal(r.mathPos, 2)
  assert.equal(r.finalPos, 2)
  assert.equal(r.stopAtRevenue, false)
  assert.equal(r.processLandTile, true)
  assert.equal(r.waitingAtRevenue, false)
  assert.equal(r.lastRevenueRound, 1)
})

test('rodada não-final: wrap não estaciona', () => {
  const r = resolveFinalRoundMove({
    oldPos: 38,
    steps: 4,
    trackLen: 40,
    roundNow: 1,
    maxRounds: 3,
    aliveCount: 3,
  })
  assert.equal(r.finalPos, 2)
  assert.equal(r.waitingAtRevenue, false)
  assert.equal(r.stopAtRevenue, false)
})
