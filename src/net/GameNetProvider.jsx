import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { GameNet } from './gameNet'
import { getOrCreateTabPlayerId, getOrSetTabPlayerName } from '../auth'

const Ctx = createContext(null)

/**
 * Guarda o "estado autoritativo" vindo do Supabase e expõe helpers:
 * - state/version
 * - commit(produceNext)
 * - isMyTurn()
 */
export function GameNetProvider({ roomCode = 'ABCD', children }) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState(null)
  const playerId = useMemo(() => getOrCreateTabPlayerId(), [])
  const playerName = useMemo(() => getOrSetTabPlayerName(), [])
  const netRef = useRef(null)

  useEffect(() => {
    const net = new GameNet({
      roomCode,
      playerId,
      playerName,
      onRemoteState: ({ state, version }) => {
        setState(state)
        setVersion(version)
      }
    })
    netRef.current = net
    net.connect()
    return () => net.disconnect()
  }, [roomCode, playerId, playerName])

  const commit = async (produceNext) => {
    if (!netRef.current) return
    await netRef.current.commit(produceNext, version)
  }

  const value = useMemo(
    () => ({ state, version, commit, playerId, playerName }),
    [state, version, playerId, playerName]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGameNet() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGameNet must be used inside <GameNetProvider>')
  return ctx
}
