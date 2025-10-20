// src/net/GameNetProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseAnon) ? createClient(supabaseUrl, supabaseAnon) : null

const Ctx = createContext(null)
export const useGameNet = () => useContext(Ctx)

/**
 * Armazena o estado autoritativo do jogo na tabela `public.rooms`:
 *   code (text UNIQUE), host_id (text), state (jsonb), version (int), updated_at (timestamptz)
 *
 * Props:
 *   - roomCode: string que identifica a sala (NOME da sala/lobby)
 *   - hostId: opcional (só guardamos como metadado)
 */
function GameNetProvider({ roomCode, hostId, children }) {
  const enabled = !!supabase && !!roomCode
  const code = String(roomCode || '').trim()

  const [ready, setReady] = useState(false)
  const [state, setState] = useState({})
  const [version, setVersion] = useState(0)

  const stateRef = useRef(state)
  const versionRef = useRef(version)
  const gotEventAtRef = useRef(0) // último evento realtime
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { versionRef.current = version }, [version])

  // --- bootstrap: cria ou carrega a sala pelo "code"
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    ;(async () => {
      try {
        const { data: rows, error } = await supabase
          .from('rooms')
          .select('code, host_id, state, version')
          .eq('code', code)
          .limit(1)

        if (error) {
          console.warn('[NET] rooms/load failed:', error.message || error)
          return
        }

        if (!rows || rows.length === 0) {
          // cria via upsert pelo code (UNIQUE)
          const initial = { code, state: {}, version: 0, host_id: hostId || null }
          const { data, error: upErr } = await supabase
            .from('rooms')
            .upsert(initial, { onConflict: 'code', ignoreDuplicates: false })
            .select('code, host_id, state, version')
            .single()

          if (upErr) {
            console.warn('[NET] rooms/create failed:', upErr.message || upErr)
            return
          }
          if (cancelled) return
          setState(data?.state || {})
          setVersion(data?.version ?? 0)
        } else {
          if (cancelled) return
          const row = rows[0]
          setState(row?.state || {})
          setVersion(row?.version ?? 0)
        }
        setReady(true)
      } catch (e) {
        console.warn('[NET] bootstrap error:', e?.message || e)
      }
    })()

    return () => { cancelled = true }
  }, [enabled, code, hostId])

  // --- Realtime subscribe (filtrado por code)
  useEffect(() => {
    if (!enabled) return
    const ch = supabase
      .channel(`rooms:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          const row = payload.new || payload.old || {}
          const v = typeof row.version === 'number' ? row.version : null
          const s = row.state

          if (v !== null && v !== versionRef.current) {
            setVersion(v)
          }
          if (s && JSON.stringify(s) !== JSON.stringify(stateRef.current)) {
            setState(s)
          }
          gotEventAtRef.current = Date.now()
          // console.log('[NET] realtime event -> v=', v)
        }
      )
      .subscribe((status) => {
        // console.log('[NET] realtime status:', status)
      })

    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [enabled, code])

  // --- Polling de segurança (caso Realtime esteja desativado ou bloqueado)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(async () => {
      const now = Date.now()
      const msDesdeEvento = now - (gotEventAtRef.current || 0)

      // Se não chegou NENHUM evento nos últimos 2s, fazemos um GET leve
      if (msDesdeEvento < 2000) return
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('state, version')
          .eq('code', code)
          .single()

        if (error) return

        const v = data?.version ?? 0
        const s = data?.state || {}
        if (v !== versionRef.current) setVersion(v)
        if (JSON.stringify(s) !== JSON.stringify(stateRef.current)) setState(s)
      } catch {}
    }, 700)

    return () => clearInterval(id)
  }, [enabled, code])

  // --- Commit (atualiza state e incrementa version em uma operação)
  const commit = async (updater) => {
    if (!enabled || !ready) return
    const prev = stateRef.current || {}
    const next = typeof updater === 'function' ? (updater(prev) || {}) : (updater || {})
    const newVersion = (versionRef.current || 0) + 1

    const { data, error } = await supabase
      .from('rooms')
      .update({ state: next, version: newVersion })
      .eq('code', code)
      .select('state, version')
      .single()

    if (error) {
      console.warn('[NET] commit failed:', error.message || error)
      return
    }
    // reflete localmente imediatamente
    setState(data?.state || next)
    setVersion(data?.version ?? newVersion)
  }

  const value = useMemo(() => ({
    enabled, ready, state, version, commit,
  }), [enabled, ready, state, version])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default GameNetProvider
export { GameNetProvider }   // named export (evita erro de import)
