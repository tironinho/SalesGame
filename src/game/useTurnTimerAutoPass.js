// Auto-pass por tempo esgotado — autoridade = mesmo coordinator do auto-skip offline.
// Não remove nem reutiliza a lógica de presença; só compartilha o CAS de avanço.

import { useEffect, useRef } from 'react'
import {
  listLobbyPresence,
  pickSkipCoordinator,
} from '../lib/lobbies.js'
import {
  shouldAttemptTimerAutoPass,
} from './turnTimerLogic.js'
import {
  getLastSharedSkipKey,
  getSharedSkipInFlight,
  markSharedSkipKey,
  setSharedSkipInFlight,
  clearSharedSkipKeyIfStale,
  wasAlreadySkipped,
} from './sharedTurnSkipGuard.js'

const DEV = !!import.meta.env.DEV
const POLL_MS = 500

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
 * @param {number|null} opts.turnDeadlineAt
 * @param {boolean} opts.turnLock
 * @param {boolean} opts.gameOver
 * @param {number} opts.turnTimeSec
 * @param {(args: object) => boolean|void} opts.attemptSkipTurn
 */
export function useTurnTimerAutoPass({
  enabled,
  lobbyId,
  myUid,
  players,
  turnPlayerId,
  turnSeq,
  turnDeadlineAt,
  turnLock,
  gameOver,
  turnTimeSec,
  attemptSkipTurn,
} = {}) {
  const playersRef = useRef(players)
  const turnPlayerIdRef = useRef(turnPlayerId)
  const turnSeqRef = useRef(turnSeq)
  const deadlineRef = useRef(turnDeadlineAt)
  const turnLockRef = useRef(turnLock)
  const gameOverRef = useRef(gameOver)
  const attemptRef = useRef(attemptSkipTurn)
  const turnTimeSecRef = useRef(turnTimeSec)

  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { turnPlayerIdRef.current = turnPlayerId }, [turnPlayerId])
  useEffect(() => { turnSeqRef.current = turnSeq }, [turnSeq])
  useEffect(() => { deadlineRef.current = turnDeadlineAt }, [turnDeadlineAt])
  useEffect(() => { turnLockRef.current = turnLock }, [turnLock])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { attemptRef.current = attemptSkipTurn }, [attemptSkipTurn])
  useEffect(() => { turnTimeSecRef.current = turnTimeSec }, [turnTimeSec])

  useEffect(() => {
    if (!enabled) return undefined
    if (!myUid) return undefined

    let cancelled = false

    const evaluate = async () => {
      if (cancelled) return
      clearSharedSkipKeyIfStale(turnPlayerIdRef.current, turnSeqRef.current)

      const curTurnId = turnPlayerIdRef.current != null
        ? String(turnPlayerIdRef.current)
        : ''
      const curTurnSeq = Number(turnSeqRef.current) || 0

      if (wasAlreadySkipped(curTurnId, curTurnSeq)) return
      if (getSharedSkipInFlight()) return

      const roster = Array.isArray(playersRef.current) ? playersRef.current : []
      const now = Date.now()

      let amCoordinator = false
      if (lobbyId) {
        let presence = []
        try {
          presence = await listLobbyPresence(lobbyId)
        } catch {
          return
        }
        if (cancelled) return
        const coordinatorId = pickSkipCoordinator(roster, presence, now)
        amCoordinator =
          coordinatorId != null && String(coordinatorId) === String(myUid)
      } else {
        // Sem lobby (modo local): este cliente pode efetivar o auto-pass.
        amCoordinator = true
      }

      const decision = shouldAttemptTimerAutoPass({
        now,
        turnDeadlineAt: deadlineRef.current,
        turnLock: !!turnLockRef.current,
        gameOver: !!gameOverRef.current,
        amCoordinator,
        turnPlayerId: curTurnId,
        turnSeq: curTurnSeq,
        lastAttemptKey: getLastSharedSkipKey(),
        inFlight: getSharedSkipInFlight(),
      })

      if (!decision.ok) {
        if (decision.reason === 'turn-locked' && DEV) {
          devLog('[turn-timer] waiting turnLock clear')
        }
        return
      }

      setSharedSkipInFlight(true)
      try {
        if (String(turnPlayerIdRef.current || '') !== curTurnId) return
        if ((Number(turnSeqRef.current) || 0) !== curTurnSeq) return
        if (gameOverRef.current) return
        if (turnLockRef.current) return

        if (lobbyId) {
          let presence2 = []
          try {
            presence2 = await listLobbyPresence(lobbyId)
          } catch {
            return
          }
          if (cancelled) return
          const coord2 = pickSkipCoordinator(roster, presence2, Date.now())
          if (!coord2 || String(coord2) !== String(myUid)) {
            devLog('[turn-timer] coordinator=false')
            return
          }
        }

        if (wasAlreadySkipped(curTurnId, curTurnSeq)) return

        devLog('[turn-timer] attempt turnSeq=' + curTurnSeq)
        const ok = attemptRef.current?.({
          expectedTurnPlayerId: curTurnId,
          expectedTurnSeq: curTurnSeq,
          reason: 'AUTO_PASS_TIMER',
        })
        if (ok) {
          markSharedSkipKey(curTurnId, curTurnSeq)
          devLog('[turn-timer] committed')
        } else {
          devLog('[turn-timer] CAS lost')
        }
      } finally {
        setSharedSkipInFlight(false)
      }
    }

    evaluate().catch(() => {})
    const t = setInterval(() => {
      evaluate().catch(() => {})
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [enabled, lobbyId, myUid])
}
