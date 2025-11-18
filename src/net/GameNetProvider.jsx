// src/net/GameNetProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
// use sempre o único client central
import { supabase } from '../lib/supabaseClient.js'

const Ctx = createContext(null)
export const useGameNet = () => useContext(Ctx)

/**
 * Tabela rooms: { id, code (UNIQUE), host_id, state (jsonb), version (int), updated_at }
 * Props:
 *  - roomCode: string que identifica a sala (use o UUID do lobby!)
 *  - hostId: opcional
 */
function GameNetProvider({ roomCode, hostId, children }) {
  const enabled = !!supabase && !!roomCode
  const code = String(roomCode || '').trim()

  const [ready, setReady] = useState(false)
  const [state, setState] = useState({})
  const [version, setVersion] = useState(0)

  const stateRef = useRef(state)
  const versionRef = useRef(version)
  const lastEvtRef = useRef(0)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { versionRef.current = version }, [version])

  // bootstrap: carrega/cria pelo code
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const { data: rows, error } = await supabase
        .from('rooms')
        .select('code, host_id, state, version')
        .eq('code', code)
        .limit(1)

      if (error) { console.warn('[NET] rooms/load:', error.message || error); return }

      if (!rows || rows.length === 0) {
        const initial = { code, state: {}, version: 0, host_id: hostId || null }
        const { data, error: upErr } = await supabase
          .from('rooms')
          .upsert(initial, { onConflict: 'code', ignoreDuplicates: false })
          .select('code, host_id, state, version')
          .single()
        if (upErr) { console.warn('[NET] rooms/create:', upErr.message || upErr); return }
        if (cancelled) return
        setState(data?.state || {}); setVersion(data?.version ?? 0)
      } else {
        if (cancelled) return
        const row = rows[0]
        setState(row?.state || {}); setVersion(row?.version ?? 0)
      }
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [enabled, code, hostId])

  // realtime por code
  useEffect(() => {
    if (!enabled) return
    const ch = supabase
      .channel(`rooms:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          const row = payload.new || payload.old || {}
          if (typeof row.version === 'number' && row.version !== versionRef.current) setVersion(row.version)
          if (row.state && JSON.stringify(row.state) !== JSON.stringify(stateRef.current)) setState(row.state)
          lastEvtRef.current = Date.now()
        }
      )
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [enabled, code])

  // polling de segurança (se o realtime estiver off)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(async () => {
      if (Date.now() - (lastEvtRef.current || 0) < 2000) return
      const { data, error } = await supabase
        .from('rooms')
        .select('state, version')
        .eq('code', code)
        .single()
      if (!error && data) {
        if (data.version !== versionRef.current) setVersion(data.version)
        if (JSON.stringify(data.state || {}) !== JSON.stringify(stateRef.current)) setState(data.state || {})
      }
    }, 700)
    return () => clearInterval(id)
  }, [enabled, code])

  // commit
  const commit = async (updater) => {
    if (!enabled || !ready) return
    const prev = stateRef.current || {}
    const next = typeof updater === 'function' ? (updater(prev) || {}) : (updater || {})
    const newVersion = (versionRef.current || 0) + 1
    const { data, error } = await supabase
      .from('rooms')
      .update({ state: next, version: newVersion, updated_at: new Date().toISOString() })
      .eq('code', code)
      .select('state, version')
      .single()
    if (error) { console.warn('[NET] commit:', error.message || error); return }
    setState(data?.state || next); setVersion(data?.version ?? newVersion)
  }

  const value = useMemo(() => ({ enabled, ready, state, version, commit }), [enabled, ready, state, version])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default GameNetProvider
export { GameNetProvider }
