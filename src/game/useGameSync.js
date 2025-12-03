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

  function broadcastState(nextPlayers, nextTurnIdx, nextRound) {
    console.log('[SG][BC] SYNC -> turnIdx=%d round=%d', nextTurnIdx, nextRound)
    // 1) rede (outros computadores)
    commitRemoteState(nextPlayers, nextTurnIdx, nextRound)
    // 2) entre abas (mesma máquina)
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round:   nextRound,
        source:  meId,
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
  // ✅ CORREÇÃO: Ref para rastrear mudanças locais recentes
  const lastLocalStateRef = useRef(null)
  
  // Rastreia mudanças locais
  useEffect(() => {
    lastLocalStateRef.current = { players, turnIdx, round, timestamp: Date.now() }
  }, [players, turnIdx, round])
  
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

        if (d.type === 'SYNC' && phase === 'game') {
          console.log('[SG][BC] SYNC <- turnIdx=%d round=%d', d.turnIdx, d.round)
          
          // ✅ CORREÇÃO: Protege mudanças locais recentes
          const now = Date.now()
          const lastLocal = lastLocalStateRef.current
          
          // Sincroniza turnIdx apenas se não houver mudança local muito recente
          if (d.turnIdx !== turnIdx) {
            if (lastLocal && (now - lastLocal.timestamp) < 3000) {
              const localTurnIdxChanged = lastLocal.turnIdx !== turnIdx
              if (localTurnIdxChanged) {
                console.log('[SG][BC] Ignorando turnIdx remoto - turnIdx local mudou recentemente (< 3s)')
              } else {
                setTurnIdx(d.turnIdx)
              }
            } else {
              setTurnIdx(d.turnIdx)
            }
          }
          
          // Sincroniza round apenas se não houver mudança local muito recente
          if (d.round !== round) {
            if (lastLocal && (now - lastLocal.timestamp) < 3000) {
              const localRoundChanged = lastLocal.round !== round
              if (localRoundChanged) {
                console.log('[SG][BC] Ignorando round remoto - round local mudou recentemente (< 3s)')
              } else {
                setRound(d.round)
              }
            } else {
              setRound(d.round)
            }
          }
          
          setPlayers(d.players)
        }
      }
      bcRef.current = bc
      return () => bc.close()
    } catch (e) {
      console.warn('[SG][App] BroadcastChannel init failed:', e)
    }
  }, [syncKey, meId, myName, phase, applyStarterKit, setPlayers, setTurnIdx, setRound, turnIdx, round]) // eslint-disable-line

  // ===== Estado remoto (espelha local quando muda) =====
  useEffect(() => {
    if (!netState) return
    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round)   ? netState.round   : null

    let changed = false
    
    // ✅ CORREÇÃO: Protege mudanças locais recentes para turnIdx e round
    if (nt !== null && nt !== turnIdx) {
      const now = Date.now()
      const lastLocal = lastLocalStateRef.current
      if (lastLocal && (now - lastLocal.timestamp) < 3000) {
        const localTurnIdxChanged = lastLocal.turnIdx !== turnIdx
        if (localTurnIdxChanged) {
          console.log('[SG][NET] Ignorando turnIdx remoto - turnIdx local mudou recentemente (< 3s)')
        } else {
          setTurnIdx(nt)
          changed = true
        }
      } else {
        setTurnIdx(nt)
        changed = true
      }
    }
    
    if (nr !== null && nr !== round) {
      const now = Date.now()
      const lastLocal = lastLocalStateRef.current
      if (lastLocal && (now - lastLocal.timestamp) < 3000) {
        const localRoundChanged = lastLocal.round !== round
        if (localRoundChanged) {
          console.log('[SG][NET] Ignorando round remoto - round local mudou recentemente (< 3s)')
        } else {
          setRound(nr)
          changed = true
        }
      } else {
        setRound(nr)
        changed = true
      }
    }
    
    // ✅ CORREÇÃO: Ignora estado remoto de players se houver mudança local muito recente
    if (np && JSON.stringify(np) !== JSON.stringify(players)) {
      const now = Date.now()
      const lastLocal = lastLocalStateRef.current
      if (lastLocal && (now - lastLocal.timestamp) < 1000) {
        console.log('[SG][NET] Ignorando estado remoto de players - mudança local muito recente (< 1s)')
      } else {
        setPlayers(np)
        changed = true
      }
    }

    if (changed) console.log('[SG][NET] applied remote state v=%d', netVersion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netVersion])

  return { bcRef, broadcastState, broadcastStart }
}
