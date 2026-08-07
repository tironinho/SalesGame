// Presença durante a partida + auto-skip do turno do jogador ausente.
// Reutiliza lobby_players.last_seen (não toca rooms.state no heartbeat).

import { useEffect, useRef } from 'react'
import {
  GAME_HEARTBEAT_INTERVAL_MS,
  GAME_OFFLINE_THRESHOLD_MS,
  GAME_PRESENCE_POLL_INTERVAL_MS,
  listLobbyPresence,
  isPresenceFresh,
  pickSkipCoordinator,
  startLobbyHeartbeat,
  touchLobbyPlayer,
  attemptHostTransferFromPresence,
} from '../lib/lobbies.js'

const DEV = !!import.meta.env.DEV

function devLog(...args) {
  if (DEV) console.log(...args)
}

/**
 * @param {object} opts
 * @param {boolean} opts.enabled
 * @param {string|null} opts.lobbyId
 * @param {string|null} opts.myUid
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
  const skipInFlightRef = useRef(false)
  const lastSkippedTurnKeyRef = useRef(null)
  const statusRef = useRef(null)

  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { turnPlayerIdRef.current = turnPlayerId }, [turnPlayerId])
  useEffect(() => { turnSeqRef.current = turnSeq }, [turnSeq])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { attemptSkipRef.current = attemptSkipTurn }, [attemptSkipTurn])
  useEffect(() => { onStatusRef.current = onStatus }, [onStatus])

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

  // Heartbeat durante game — imediato + a cada 10s; para no unmount / saída
  useEffect(() => {
    if (!enabled) return
    if (!lobbyId || !myUid) return

    const stop = startLobbyHeartbeat({
      lobbyId,
      playerId: String(myUid),
      intervalMs: GAME_HEARTBEAT_INTERVAL_MS,
      // Se cleanup removeu lobby_players, recria só para assento em rooms.state
      allowRecreateIfSeated: true,
    })
    devLog('[presence] heartbeat started')

    return () => {
      try { stop?.() } catch {}
    }
  }, [enabled, lobbyId, myUid])

  // Observa presença e (só o coordinator) tenta auto-skip
  useEffect(() => {
    if (!enabled) {
      setStatus(null)
      return
    }
    if (!lobbyId || !myUid) return

    let cancelled = false

    const evaluate = async () => {
      if (cancelled || skipInFlightRef.current) return
      if (gameOverRef.current) {
        setStatus(null)
        return
      }

      const roster = Array.isArray(playersRef.current) ? playersRef.current : []
      const curTurnId = turnPlayerIdRef.current != null
        ? String(turnPlayerIdRef.current)
        : ''
      const curTurnSeq = Number(turnSeqRef.current) || 0
      if (!curTurnId || roster.length === 0) {
        setStatus(null)
        return
      }

      // Atualiza meu last_seen antes de decidir ausência (reentrada / poll).
      // allowRecreateIfSeated: restaura row apagada pelo cleanup só se assentado.
      try {
        await touchLobbyPlayer({
          lobbyId,
          playerId: String(myUid),
          allowRecreateIfSeated: true,
        })
      } catch {}

      let presence
      try {
        presence = await listLobbyPresence(lobbyId)
      } catch {
        // Fail-safe: falha de rede → NÃO skip
        return
      }
      if (cancelled) return

      const now = Date.now()
      const presenceMap = new Map(
        (presence || []).map((p) => [String(p.playerId), p.lastSeen])
      )
      const turnLastSeen = presenceMap.get(curTurnId)
      const turnPresent = isPresenceFresh(turnLastSeen, now, GAME_OFFLINE_THRESHOLD_MS)

      devLog('[presence] current turn present=' + (turnPresent ? 'true' : 'false'))

      const coordinatorId = pickSkipCoordinator(roster, presence, now)
      const amCoordinator = coordinatorId != null && String(coordinatorId) === String(myUid)
      devLog('[presence] coordinator=' + (amCoordinator ? 'true' : 'false'))

      // Host transfer (independente do auto-skip): não mexe em rooms.state / turn
      try {
        const candidateIds = roster.map((p) => String(p?.id ?? '')).filter(Boolean)
        const ht = await attemptHostTransferFromPresence({
          lobbyId,
          myUid: String(myUid),
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
        // fail-safe: não derruba presença/auto-skip
      }
      if (cancelled) return

      if (turnPresent) {
        if (statusRef.current === 'waiting') {
          devLog('[auto-skip] cancelled player returned')
        }
        setStatus(null)
        return
      }

      setStatus('waiting')
      if (!amCoordinator) return

      const turnKey = `${curTurnId}|${curTurnSeq}`
      if (lastSkippedTurnKeyRef.current === turnKey) return

      devLog('[auto-skip] waiting')
      skipInFlightRef.current = true
      try {
        // Reconfirma presença imediatamente antes do commit
        try {
          await touchLobbyPlayer({
            lobbyId,
            playerId: String(myUid),
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
        // turn ainda o mesmo?
        if (String(turnPlayerIdRef.current || '') !== curTurnId) {
          devLog('[auto-skip] cancelled player returned')
          setStatus(null)
          return
        }
        if ((Number(turnSeqRef.current) || 0) !== curTurnSeq) return
        if (gameOverRef.current) return

        const map2 = new Map(
          (presence2 || []).map((p) => [String(p.playerId), p.lastSeen])
        )
        if (isPresenceFresh(map2.get(curTurnId), now2, GAME_OFFLINE_THRESHOLD_MS)) {
          devLog('[auto-skip] cancelled player returned')
          setStatus(null)
          return
        }

        // Coordinator ainda sou eu?
        const coord2 = pickSkipCoordinator(roster, presence2, now2)
        if (!coord2 || String(coord2) !== String(myUid)) {
          devLog('[presence] coordinator=false')
          return
        }

        devLog('[auto-skip] attempt turnSeq=' + curTurnSeq)
        const ok = attemptSkipRef.current?.({
          expectedTurnPlayerId: curTurnId,
          expectedTurnSeq: curTurnSeq,
        })
        if (ok) {
          lastSkippedTurnKeyRef.current = turnKey
          setStatus('skipped')
          devLog('[auto-skip] committed')
        } else {
          devLog('[auto-skip] CAS lost')
        }
      } finally {
        skipInFlightRef.current = false
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
  }, [enabled, lobbyId, myUid])
}
