// src/game/useGameSync.js
import { useEffect, useMemo, useRef } from 'react'
import { useGameNet } from '../net/GameNetProvider.jsx'

export function useGameSync({
  roomId,
  meId,
  myUid,
  phase,
  players, round, turnIdx,
  setPlayers, setTurnIdx, setRound,
  setTurnLock,          // (opcional) setter do cadeado
  setLockOwner,         // (opcional) dono do cadeado
  applyStarterKit,
  isMine,
  myName,
}) {
  const syncKey = useMemo(() => `sg-sync:${roomId || 'local'}`, [roomId])
  const bcRef = useRef(null)
  const broadcastSeqRef = useRef(0)  // seq monotônico para ordenar mensagens
  const lastSeqRef = useRef(0)  // seq monotônico para evitar estados antigos

  // ===== Realtime provider (opcional) =====
  const net = (() => {
    try { return useGameNet?.() } catch { return null }
  })() || null
  const netState   = net?.state
  const netVersion = net?.version
  const netCommit  = net?.commit

  async function commitRemoteState(nextPlayers, nextTurnIdx, nextRound) {
    if (typeof netCommit === 'function') {
      try {
        await netCommit(prev => ({
          ...(prev || {}),
          players: nextPlayers,
          turnIdx: nextTurnIdx,
          round:   nextRound,
        }))
      } catch (e) {
        console.warn('[SG][NET] commit failed:', e?.message || e)
      }
    }
  }

  function broadcastState(nextPlayers, nextTurnIdx, nextRound, extra = {}) {
    broadcastSeqRef.current += 1
    console.log('[SG][BC] GAME_STATE -> turnIdx=%d round=%d seq=%d', nextTurnIdx, nextRound, broadcastSeqRef.current)
    // 1) rede (outros computadores)
    commitRemoteState(nextPlayers, nextTurnIdx, nextRound)
    // 2) entre abas (mesma máquina) - agora com tipo GAME_STATE e seq
    try {
      bcRef.current?.postMessage?.({
        type: 'GAME_STATE',
        players: nextPlayers,          // inclui posições/tile atualizados
        turnIdx: nextTurnIdx,
        round:   nextRound,
        seq: broadcastSeqRef.current,
        ts: Date.now(),
        source:  meId,
        ...extra          // (opcional) dados de UX
      })
    } catch (e) { console.warn('[SG][App] broadcastState failed:', e) }
  }

  function broadcastStart(nextPlayers) {
    console.log('[SG][BC] START ->')
    commitRemoteState(nextPlayers, 0, 1)
    try {
      bcRef.current?.postMessage?.({
        type: 'START',
        players: nextPlayers,
        source:  meId,
      })
    } catch (e) { console.warn('[SG][App] broadcastStart failed:', e) }
  }

  // ===== BroadcastChannel entre abas =====
  useEffect(() => {
    try {
      bcRef.current?.close?.()
      const bc = new BroadcastChannel(syncKey)
      bc.onmessage = (e) => {
        const d = e.data || {}
        if (String(d.source) === String(meId)) return

        if (d.type === 'START') {
          console.log('[SG][BC] START received')
          const mapped = Array.isArray(d.players) ? d.players.map(applyStarterKit) : []
          if (!mapped.length) return

          // tenta usar UID global; se ausente, alinha por nome
          try {
            const wuid = (typeof window !== 'undefined' && (window.__MY_UID || window.__myUid || window.__playerId)) || null
            if (wuid) {
              // não temos setMyUid aqui; assumimos que quem chamou já configurou
            } else {
              const mineByName = mapped.find(p => (p?.name || '').trim().toLowerCase()
                === (myName || '').trim().toLowerCase())
              if (mineByName?.id) {
                // idem: o App decide myUid
              }
            }
          } catch {}

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          return
        }

        if (d.type === 'TURNLOCK') {
          console.log('[SG][BC] TURNLOCK <-', d.value, 'owner=', d.owner)
          setTurnLock?.(!!d.value)
          setLockOwner?.(d.owner || null)
          return
        }

        // ✅ CORREÇÃO: Suporta tanto SYNC (antigo) quanto GAME_STATE (novo com seq)
        if ((d.type === 'SYNC' || d.type === 'GAME_STATE') && phase === 'game') {
          // Para GAME_STATE, verifica seq para evitar estados antigos/duplicados
          if (d.type === 'GAME_STATE' && typeof d.seq === 'number') {
            if (d.seq <= lastSeqRef.current) {
              console.log('[SG][BC] GAME_STATE <- ⚠️ Ignorando estado antigo (seq: %d <= lastSeq: %d)', d.seq, lastSeqRef.current)
              return
            }
            lastSeqRef.current = d.seq
            console.log('[SG][BC] GAME_STATE <- ✅ Seq válido: %d', d.seq)
          }
          console.log('[SG][BC] %s <- turnIdx=%d round=%d', d.type, d.turnIdx, d.round)
          // aplica estado completo — tokens se movem nas duas telas
          setPlayers(d.players)
          setTurnIdx(d.turnIdx)
          setRound(d.round)
        }
      }
      bcRef.current = bc
      return () => bc.close()
    } catch (e) {
      console.warn('[SG][App] BroadcastChannel init failed:', e)
    }
  }, [syncKey, meId, myName, phase, applyStarterKit, setPlayers, setTurnIdx, setRound]) // eslint-disable-line

  // ===== Estado remoto (espelha local quando muda) =====
  useEffect(() => {
    if (!netState) return
    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round)   ? netState.round   : null

    let changed = false
    if (np && JSON.stringify(np) !== JSON.stringify(players)) { setPlayers(np); changed = true }
    if (nt !== null && nt !== turnIdx) { setTurnIdx(nt); changed = true }
    if (nr !== null && nr !== round)  { setRound(nr); changed = true }

    if (changed) console.log('[SG][NET] applied remote state v=%d', netVersion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netVersion])

  return { bcRef, broadcastState, broadcastStart }
}
