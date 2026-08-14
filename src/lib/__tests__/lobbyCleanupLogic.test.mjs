import test from 'node:test'
import assert from 'node:assert/strict'

import {
  planEmptyLobbyDeletion,
  canSafelyDeleteLobby,
  roomStatePlayerCount,
  roomStateGameOver,
} from '../../lib/lobbyCleanupLogic.js'

const HOUR = 60 * 60 * 1000
const MIN = 60 * 1000

test('nunca deleta lobby com players na tabela', () => {
  const plan = planEmptyLobbyDeletion({
    status: 'locked',
    playerCount: 2,
    createdAtMs: Date.now() - 10 * HOUR,
    now: Date.now(),
  })
  assert.equal(plan.delete, false)
  assert.equal(plan.reason, 'has-players')
})

test('canSafelyDeleteLobby bloqueia presença fresca', () => {
  assert.deepEqual(canSafelyDeleteLobby({ playerCount: 1 }), {
    ok: false,
    reason: 'has-players',
  })
  assert.deepEqual(canSafelyDeleteLobby({ playerCount: 0, freshPresenceCount: 1 }), {
    ok: false,
    reason: 'fresh-presence',
  })
  assert.deepEqual(canSafelyDeleteLobby({ playerCount: 0, freshPresenceCount: 0 }), {
    ok: true,
    reason: 'empty-safe',
  })
})

test('open vazio usa TTL a partir da atividade', () => {
  const now = 1_700_000_000_000
  const wait = planEmptyLobbyDeletion({
    status: 'open',
    playerCount: 0,
    createdAtMs: now - 10 * MIN,
    now,
    emptyOpenTtlMin: 30,
  })
  assert.equal(wait.delete, false)

  const go = planEmptyLobbyDeletion({
    status: 'open',
    playerCount: 0,
    createdAtMs: now - 40 * MIN,
    now,
    emptyOpenTtlMin: 30,
  })
  assert.equal(go.delete, true)
  assert.equal(go.reason, 'empty-open-ttl')
})

test('locked com assentos no state respeita janela de reconnect (atividade, não só created_at)', () => {
  const now = 1_700_000_000_000
  // created há 3h, mas rooms.updated_at há 5 min → NÃO deletar
  const grace = planEmptyLobbyDeletion({
    status: 'locked',
    playerCount: 0,
    createdAtMs: now - 3 * HOUR,
    roomUpdatedAtMs: now - 5 * MIN,
    roomPlayerCount: 1,
    roomGameOver: false,
    now,
    emptyLockedTtlMin: 120,
    emptyLockedIdleTtlMin: 30,
  })
  assert.equal(grace.delete, false)
  assert.equal(grace.reason, 'locked-reconnect-grace')

  // mesma sala, última atividade há 130 min → pode limpar fantasma
  const stale = planEmptyLobbyDeletion({
    status: 'locked',
    playerCount: 0,
    createdAtMs: now - 5 * HOUR,
    roomUpdatedAtMs: now - 130 * MIN,
    roomPlayerCount: 1,
    roomGameOver: false,
    now,
    emptyLockedTtlMin: 120,
  })
  assert.equal(stale.delete, true)
  assert.equal(stale.reason, 'locked-stale-reconnect-window')
})

test('locked vazio (sem state / gameOver) usa idle TTL mais curto', () => {
  const now = 1_700_000_000_000
  const wait = planEmptyLobbyDeletion({
    status: 'locked',
    playerCount: 0,
    createdAtMs: now - 3 * HOUR,
    roomUpdatedAtMs: now - 10 * MIN,
    roomPlayerCount: 0,
    now,
    emptyLockedIdleTtlMin: 30,
  })
  assert.equal(wait.delete, false)

  const gone = planEmptyLobbyDeletion({
    status: 'locked',
    playerCount: 0,
    createdAtMs: now - 3 * HOUR,
    roomUpdatedAtMs: now - 35 * MIN,
    roomPlayerCount: 0,
    now,
    emptyLockedIdleTtlMin: 30,
  })
  assert.equal(gone.delete, true)
  assert.equal(gone.reason, 'locked-empty-idle')

  const afterGame = planEmptyLobbyDeletion({
    status: 'locked',
    playerCount: 0,
    createdAtMs: now - HOUR,
    roomUpdatedAtMs: now - 40 * MIN,
    roomPlayerCount: 2,
    roomGameOver: true,
    now,
    emptyLockedIdleTtlMin: 30,
  })
  assert.equal(afterGame.delete, true)
})

test('helpers de rooms.state', () => {
  assert.equal(roomStatePlayerCount(null), 0)
  assert.equal(roomStatePlayerCount({ players: [{ id: 'a' }] }), 1)
  assert.equal(roomStateGameOver({ gameOver: true }), true)
  assert.equal(roomStateGameOver({}), false)
})
