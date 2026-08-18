import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  GAME_ABSENCE_SKIP_GRACE_MS,
  shouldAttemptPresenceAutoSkip,
  shouldRejectAbsentTurnSkip,
} from '../presenceSkipLogic.js'

const NOW = 1_000_000

describe('presence skip / dado', () => {
  it('não pula com turnLock (dado girando)', () => {
    const d = shouldAttemptPresenceAutoSkip({
      turnPresent: false,
      turnLock: true,
      gameOver: false,
      amCoordinator: true,
      turnPlayerId: 'p2',
      turnSeq: 3,
      waitingSinceMs: NOW - GAME_ABSENCE_SKIP_GRACE_MS - 1,
      now: NOW,
    })
    assert.equal(d.ok, false)
    assert.equal(d.reason, 'turn-locked')
    assert.equal(d.waitingSinceMs, null)
  })

  it('ausente: espera graça antes de pular', () => {
    const first = shouldAttemptPresenceAutoSkip({
      turnPresent: false,
      turnLock: false,
      gameOver: false,
      amCoordinator: true,
      turnPlayerId: 'p2',
      turnSeq: 3,
      waitingSinceMs: null,
      now: NOW,
    })
    assert.equal(first.ok, false)
    assert.equal(first.reason, 'waiting-grace')
    assert.equal(first.waitingSinceMs, NOW)

    const tooSoon = shouldAttemptPresenceAutoSkip({
      turnPresent: false,
      turnLock: false,
      amCoordinator: true,
      turnPlayerId: 'p2',
      turnSeq: 3,
      waitingSinceMs: NOW,
      now: NOW + GAME_ABSENCE_SKIP_GRACE_MS - 1,
    })
    assert.equal(tooSoon.ok, false)
    assert.equal(tooSoon.reason, 'waiting-grace')

    const ready = shouldAttemptPresenceAutoSkip({
      turnPresent: false,
      turnLock: false,
      amCoordinator: true,
      turnPlayerId: 'p2',
      turnSeq: 3,
      waitingSinceMs: NOW,
      now: NOW + GAME_ABSENCE_SKIP_GRACE_MS,
    })
    assert.equal(ready.ok, true)
    assert.equal(ready.reason, 'absent-grace-elapsed')
  })

  it('lock no meio da graça zera a espera', () => {
    const d = shouldAttemptPresenceAutoSkip({
      turnPresent: false,
      turnLock: true,
      amCoordinator: true,
      turnPlayerId: 'p2',
      turnSeq: 3,
      waitingSinceMs: NOW - 10_000,
      now: NOW,
    })
    assert.equal(d.waitingSinceMs, null)
    assert.equal(d.reason, 'turn-locked')
  })

  it('skipAbsentTurn recusa lock e já-rolou', () => {
    assert.equal(
      shouldRejectAbsentTurnSkip({ turnLock: true, expectedTurnSeq: 4 }).reason,
      'turn-locked',
    )
    assert.equal(
      shouldRejectAbsentTurnSkip({
        turnLock: false,
        lastRollTurnKey: '4',
        expectedTurnSeq: 4,
      }).reason,
      'already-rolled',
    )
    assert.equal(
      shouldRejectAbsentTurnSkip({
        turnLock: false,
        lastRollTurnKey: null,
        expectedTurnSeq: 4,
      }).reject,
      false,
    )
  })
})
