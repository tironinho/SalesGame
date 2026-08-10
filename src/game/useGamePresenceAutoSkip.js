// Presença durante a partida + auto-skip do turno do jogador ausente.
// Reutiliza lobby_players.last_seen (não toca rooms.state no heartbeat).

import { useEffect, useRef } from 'react'
import {
  GAME_HEARTBEAT_INTERVAL_MS,
  GAME_OFFLINE_THRESHOLD_MS,
  GAME_PRESENCE_POLL_INTERVAL_MS,
  listLobbyPresence,
  startLobbyHeartbeat,
  touchLobbyPlayer,
  attemptHostTransferFromPresence,
} from '../lib/lobbies.js'
import {
  resolveGamePresencePlayerId,
  isTurnPlayerPresent,
  resolveTurnSkipAuthority,
} from './canonicalPresence.js'
import {
  getSharedSkipInFlight,
  markPendingSharedSkipKey,
  releaseSharedSkipKey,
  setSharedSkipInFlight,
  wasAlreadySkipped,
  clearSharedSkipKeyIfStale,
} from './sharedTurnSkipGuard.js'

const DEV = !!import.meta.env.DEV

function devLog(...args) {
  if (DEV) console.log(...args)
}

/**
 * @param {object} opts
 * @param {boolean} opts.enabled
 * @param {string|null} opts.lobbyId
 * @param {string|null} opts.myUid — assento canônico (NÃO passar tab-id como fallback)
 * @param {string|null} [opts.lobbyHostId] — lobbies.host_id (fallback de autoridade)
 * @param {array} opts.players
 * @param {string|null} opts.turnPlayerId
 * @param {number} opts.turnSeq
 * @param {boolean} opts.gameOver
 * @param {(plan: object) => boolean|void} opts.attemptSkipTurn
 * @param {(status: 'waiting'|'skipped'|null) => void} opts.onStatus
 */
export function useGamePresenceAutoSkip({
  enabled,
  lobbyId,
  myUid,
  lobbyHostId = null,
  players,
  turnPlayerId,
  turnSeq,
  gameOver,
  attemptSkipTurn,
  onStatus,
} = {}) {
  const playersRef = useRef(players)
  const turnPlayerIdRef = useRef(turnPlayerId)
  const turnSeqRef = useRef(turnSeq)
  const gameOverRef = useRef(gameOver)
  const attemptSkipRef = useRef(attemptSkipTurn)
  const onStatusRef = useRef(onStatus)
  const lobbyHostIdRef = useRef(lobbyHostId)
  const statusRef = useRef(null)

  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { turnPlayerIdRef.current = turnPlayerId }, [turnPlayerId])
  useEffect(() => { turnSeqRef.current = turnSeq }, [turnSeq])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { attemptSkipRef.current = attemptSkipTurn }, [attemptSkipTurn])
  useEffect(() => { onStatusRef.current = onStatus }, [onStatus])
  useEffect(() => { lobbyHostIdRef.current = lobbyHostId }, [lobbyHostId])

  const skippedClearTimerRef = useRef(null)

  const setStatus = (next) => {
    if (statusRef.current === next) return
    statusRef.current = next
    try { onStatusRef.current?.(next) } catch {}
    if (skippedClearTimerRef.current) {
      clearTimeout(skippedClearTimerRef.current)
      skippedClearTimerRef.current = null
    }
    if (next === 'skipped') {
      skippedClearTimerRef.current = setTimeout(() => {
        if (statusRef.current === 'skipped') setStatus(null)
      }, 4000)
    }
  }

  // Heartbeat canônico — SOMENTE seat id no roster (nunca tab-id).
  // Depende dos ids do roster (não do cash) para rebind sem restart a cada patch.
  const rosterIdsKey = (Array.isArray(players) ? players : [])
    .map((p) => String(p?.id ?? ''))
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    if (!enabled) return
    if (!lobbyId) return

    const roster = Array.isArray(playersRef.current) ? playersRef.current : []
    const presenceId = resolveGamePresencePlayerId({
      seatPlayerId: myUid,
      tabPlayerId: null,
      roster,
    })
    if (!presenceId) {
      devLog('[presence] heartbeat skipped: no canonical seat id')
      return
    }

    const stop = startLobbyHeartbeat({
      lobbyId,
      playerId: String(presenceId),
      intervalMs: GAME_HEARTBEAT_INTERVAL_MS,
      allowRecreateIfSeated: true,
    })
    // Touch imediato ao alinhar identidade (rebind/hydrate)
    touchLobbyPlayer({
      lobbyId,
      playerId: String(presenceId),
      allowRecreateIfSeated: true,
    }).catch(() => {})
    devLog('[presence] heartbeat started canonical=' + presenceId)

    return () => {
      try { stop?.() } catch {}
    }
  }, [enabled, lobbyId, myUid, rosterIdsKey])

  // Observa presença e (só a autoridade) tenta auto-skip
  useEffect(() => {
    if (!enabled) {
      setStatus(null)
      return
    }
    if (!lobbyId || !myUid) return

    let cancelled = false

    const evaluate = async () => {
      if (cancelled || getSharedSkipInFlight()) return
      if (gameOverRef.current) {
        setStatus(null)
        return
      }

      const roster = Array.isArray(playersRef.current) ? playersRef.current : []
      const presenceId = resolveGamePresencePlayerId({
        seatPlayerId: myUid,
        tabPlayerId: null,
        roster,
      })
      if (!presenceId) return

      const curTurnId = turnPlayerIdRef.current != null
        ? String(turnPlayerIdRef.current)
        : ''
      const curTurnSeq = Number(turnSeqRef.current) || 0
      clearSharedSkipKeyIfStale(curTurnId, curTurnSeq)
      if (!curTurnId || roster.length === 0) {
        setStatus(null)
        return
      }
      if (wasAlreadySkipped(curTurnId, curTurnSeq)) return

      // Atualiza last_seen canônico antes de decidir ausência
      try {
        await touchLobbyPlayer({
          lobbyId,
          playerId: String(presenceId),
          allowRecreateIfSeated: true,
        })
      } catch {}

      let presence
      try {
        presence = await listLobbyPresence(lobbyId)
      } catch {
        return
      }
      if (cancelled) return

      const now = Date.now()
      const turnPresent = isTurnPlayerPresent({
        turnPlayerId: curTurnId,
        presenceList: presence,
        now,
        thresholdMs: GAME_OFFLINE_THRESHOLD_MS,
      })

      // Se EU sou o jogador do turno e acabei de tocar presença canônica → online
      if (!turnPresent && String(presenceId) === curTurnId) {
        // Re-lê após touch próprio (evita falso waiting por race de lista)
        try {
          presence = await listLobbyPresence(lobbyId)
        } catch {
          return
        }
        if (cancelled) return
      }

      const turnPresent2 = isTurnPlayerPresent({
        turnPlayerId: curTurnId,
        presenceList: presence,
        now: Date.now(),
        thresholdMs: GAME_OFFLINE_THRESHOLD_MS,
      })

      devLog('[presence] current turn present=' + (turnPresent2 ? 'true' : 'false'))

      const auth = resolveTurnSkipAuthority({
        rosterPlayers: roster,
        presenceList: presence,
        now: Date.now(),
        myUid: presenceId,
        lobbyHostId: lobbyHostIdRef.current,
      })
      const amCoordinator = auth.authorized === true
      devLog('[presence] authority=' + auth.reason + ' self=' + (amCoordinator ? 'true' : 'false'))

      // Host transfer (independente do auto-skip)
      try {
        const candidateIds = roster.map((p) => String(p?.id ?? '')).filter(Boolean)
        const ht = await attemptHostTransferFromPresence({
          lobbyId,
          myUid: String(presenceId),
          candidateIds,
        })
        if (ht?.transferred) {
          devLog('[host-transfer] committed')
        } else if (ht?.casLost) {
          devLog('[host-transfer] CAS lost')
        } else if (ht?.reason === 'no-present') {
          devLog('[host-transfer] no present candidate')
        }
      } catch {
        // fail-safe
      }
      if (cancelled) return

      if (turnPresent2) {
        if (statusRef.current === 'waiting') {
          devLog('[auto-skip] cancelled player returned')
        }
        setStatus(null)
        return
      }

      setStatus('waiting')
      if (!amCoordinator) return
      if (wasAlreadySkipped(curTurnId, curTurnSeq)) return

      devLog('[auto-skip] waiting')
      setSharedSkipInFlight(true)
      try {
        try {
          await touchLobbyPlayer({
            lobbyId,
            playerId: String(presenceId),
            allowRecreateIfSeated: true,
          })
        } catch {}

        let presence2
        try {
          presence2 = await listLobbyPresence(lobbyId)
        } catch {
          return
        }
        if (cancelled) return

        const now2 = Date.now()
        if (String(turnPlayerIdRef.current || '') !== curTurnId) {
          devLog('[auto-skip] cancelled player returned')
          setStatus(null)
          return
        }
        if ((Number(turnSeqRef.current) || 0) !== curTurnSeq) return
        if (gameOverRef.current) return
        if (wasAlreadySkipped(curTurnId, curTurnSeq)) return

        if (isTurnPlayerPresent({
          turnPlayerId: curTurnId,
          presenceList: presence2,
          now: now2,
          thresholdMs: GAME_OFFLINE_THRESHOLD_MS,
        })) {
          devLog('[auto-skip] cancelled player returned')
          setStatus(null)
          return
        }

        const auth2 = resolveTurnSkipAuthority({
          rosterPlayers: roster,
          presenceList: presence2,
          now: now2,
          myUid: presenceId,
          lobbyHostId: lobbyHostIdRef.current,
        })
        if (!auth2.authorized) {
          devLog('[presence] authority=false')
          return
        }

        devLog('[auto-skip] attempt turnSeq=' + curTurnSeq)
        const ok = attemptSkipRef.current?.({
          expectedTurnPlayerId: curTurnId,
          expectedTurnSeq: curTurnSeq,
          reason: 'AUTO_SKIP_OFFLINE',
        })
        if (ok) {
          // Pending até CAS confirmar em commitGamePatch
          markPendingSharedSkipKey(curTurnId, curTurnSeq)
          setStatus('skipped')
          devLog('[auto-skip] local applied (pending CAS)')
        } else {
          releaseSharedSkipKey(curTurnId, curTurnSeq)
          devLog('[auto-skip] local rejected')
        }
      } finally {
        setSharedSkipInFlight(false)
      }
    }

    evaluate().catch(() => {})
    const t = setInterval(() => {
      evaluate().catch(() => {})
    }, GAME_PRESENCE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [enabled, lobbyId, myUid, lobbyHostId])
}
