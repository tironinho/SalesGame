/**
 * Planejamento puro de limpeza de lobbies/rooms.
 * Sem I/O — usado por lobbies.js e por testes node:test.
 */

/**
 * @param {object} opts
 * @param {string} [opts.status] open | locked
 * @param {number} opts.playerCount jogadores em lobby_players
 * @param {number|null} opts.createdAtMs
 * @param {number|null} [opts.roomUpdatedAtMs] rooms.updated_at (atividade)
 * @param {number} [opts.roomPlayerCount] players no JSON rooms.state
 * @param {boolean} [opts.roomGameOver]
 * @param {number} [opts.now]
 * @param {number} [opts.emptyOpenTtlMin]
 * @param {number} [opts.emptyLockedTtlMin] TTL quando ainda há assentos no state (reconnect)
 * @param {number} [opts.emptyLockedIdleTtlMin] TTL quando lobby locked e state vazio/gameOver
 */
export function planEmptyLobbyDeletion({
  status,
  playerCount = 0,
  createdAtMs = null,
  roomUpdatedAtMs = null,
  roomPlayerCount = 0,
  roomGameOver = false,
  now = Date.now(),
  emptyOpenTtlMin = 30,
  emptyLockedTtlMin = 120,
  emptyLockedIdleTtlMin = 30,
} = {}) {
  const count = Number(playerCount) || 0
  if (count > 0) {
    return { delete: false, reason: 'has-players' }
  }

  const hasRoomTs =
    roomUpdatedAtMs != null &&
    roomUpdatedAtMs !== '' &&
    Number.isFinite(Number(roomUpdatedAtMs))
  const hasCreatedTs =
    createdAtMs != null &&
    createdAtMs !== '' &&
    Number.isFinite(Number(createdAtMs))
  const activityMs = hasRoomTs
    ? Number(roomUpdatedAtMs)
    : (hasCreatedTs ? Number(createdAtMs) : NaN)

  if (!Number.isFinite(activityMs)) {
    return { delete: false, reason: 'no-timestamp' }
  }

  const idleMs = Math.max(0, Number(now) - activityMs)
  const openTtl = Math.max(1, Number(emptyOpenTtlMin) || 30) * 60_000
  const lockedReconnectTtl = Math.max(1, Number(emptyLockedTtlMin) || 120) * 60_000
  const lockedIdleTtl = Math.max(1, Number(emptyLockedIdleTtlMin) || 30) * 60_000

  const st = String(status || 'open')

  if (st === 'open') {
    if (idleMs >= openTtl) {
      return { delete: true, reason: 'empty-open-ttl', idleMs, activityMs }
    }
    return { delete: false, reason: 'open-ttl-wait', idleMs, activityMs }
  }

  if (st === 'locked') {
    const seatsAlive = (Number(roomPlayerCount) || 0) > 0 && !roomGameOver
    const ttl = seatsAlive ? lockedReconnectTtl : lockedIdleTtl
    if (idleMs >= ttl) {
      return {
        delete: true,
        reason: seatsAlive ? 'locked-stale-reconnect-window' : 'locked-empty-idle',
        idleMs,
        activityMs,
      }
    }
    return {
      delete: false,
      reason: seatsAlive ? 'locked-reconnect-grace' : 'locked-empty-wait',
      idleMs,
      activityMs,
    }
  }

  return { delete: false, reason: 'unknown-status' }
}

/**
 * Guard final antes de DELETE em lote.
 * Nunca apaga se ainda houver players na tabela ou heartbeat fresco.
 */
export function canSafelyDeleteLobby({
  playerCount = 0,
  freshPresenceCount = 0,
} = {}) {
  if ((Number(playerCount) || 0) > 0) {
    return { ok: false, reason: 'has-players' }
  }
  if ((Number(freshPresenceCount) || 0) > 0) {
    return { ok: false, reason: 'fresh-presence' }
  }
  return { ok: true, reason: 'empty-safe' }
}

export function roomStatePlayerCount(state) {
  const players = state?.players
  return Array.isArray(players) ? players.length : 0
}

export function roomStateGameOver(state) {
  return !!state?.gameOver
}
