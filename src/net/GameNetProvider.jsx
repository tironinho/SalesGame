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
        // ✅ CORREÇÃO: Estado inicial com rev = 0
        const initial = { code, state: { rev: 0 }, version: 0, host_id: hostId || null }
        const { data, error: upErr } = await supabase
          .from('rooms')
          .upsert(initial, { onConflict: 'code', ignoreDuplicates: false })
          .select('code, host_id, state, version')
          .single()
        if (upErr) { console.warn('[NET] rooms/create:', upErr.message || upErr); return }
        if (cancelled) return
        // ✅ CORREÇÃO: Garante que o estado tenha rev
        const initialState = data?.state || {}
        if (typeof initialState.rev !== 'number') {
          initialState.rev = 0
        }
        setState(initialState)
        setVersion(data?.version ?? 0)
      } else {
        if (cancelled) return
        const row = rows[0]
        // ✅ CORREÇÃO: Garante que o estado tenha rev
        const rowState = row?.state || {}
        if (typeof rowState.rev !== 'number') {
          rowState.rev = 0
        }
        setState(rowState)
        setVersion(row?.version ?? 0)
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
          if (row.state) {
            // ✅ CORREÇÃO: Verifica rev antes de atualizar (aceita apenas rev maior)
            const incomingState = row.state || {}
            const incomingRev = typeof incomingState.rev === 'number' ? incomingState.rev : 0
            const localRev = typeof stateRef.current.rev === 'number' ? stateRef.current.rev : 0
            
            if (incomingRev > localRev) {
              console.log(`[NET] realtime - ✅ aceitando estado remoto (rev: ${localRev} → ${incomingRev})`)
              setState(incomingState)
              lastEvtRef.current = Date.now()
            } else if (incomingRev < localRev) {
              console.log(`[NET] realtime - ⚠️ ignorando estado remoto antigo (rev remoto: ${incomingRev} < local: ${localRev})`)
            } else {
              // rev igual: atualiza apenas se o conteúdo for diferente
              if (JSON.stringify(incomingState) !== JSON.stringify(stateRef.current)) {
                setState(incomingState)
                lastEvtRef.current = Date.now()
              }
            }
          }
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
        if (data.state) {
          // ✅ CORREÇÃO: Verifica rev antes de atualizar (aceita apenas rev maior)
          const incomingState = data.state || {}
          const incomingRev = typeof incomingState.rev === 'number' ? incomingState.rev : 0
          const localRev = typeof stateRef.current.rev === 'number' ? stateRef.current.rev : 0
          
          if (incomingRev > localRev) {
            console.log(`[NET] polling - ✅ aceitando estado remoto (rev: ${localRev} → ${incomingRev})`)
            setState(incomingState)
          } else if (incomingRev < localRev) {
            console.log(`[NET] polling - ⚠️ ignorando estado remoto antigo (rev remoto: ${incomingRev} < local: ${localRev})`)
          } else {
            // rev igual: atualiza apenas se o conteúdo for diferente
            if (JSON.stringify(incomingState) !== JSON.stringify(stateRef.current)) {
              setState(incomingState)
            }
          }
        }
      }
    }, 700)
    return () => clearInterval(id)
  }, [enabled, code])

  // commit com trava otimista por rev (revisão no estado JSON)
  const commit = async (updater) => {
    if (!enabled || !ready) return
    
    // ⭐ Trava otimista: carrega estado atual do servidor primeiro para verificar rev
    const { data: current, error: fetchError } = await supabase
      .from('rooms')
      .select('state, version')
      .eq('code', code)
      .single()
    
    if (fetchError) {
      console.warn('[NET] commit - erro ao buscar estado atual:', fetchError.message || fetchError)
      return
    }
    
    const currentState = current?.state || {}
    const currentRev = typeof currentState.rev === 'number' ? currentState.rev : 0
    const prevRev = typeof stateRef.current.rev === 'number' ? stateRef.current.rev : 0
    
    // Se o rev remoto é maior que o local, alguém gravou antes → recarrega e retorna
    if (currentRev > prevRev) {
      console.log(`[NET] commit - ⚠️ rev remoto (${currentRev}) > local (${prevRev}) - recarregando estado remoto`)
      setState(currentState)
      setVersion(current?.version ?? versionRef.current)
      return
    }
    
    // ✅ CORREÇÃO: Usa estado atual do servidor (pode ter sido atualizado por outro cliente)
    const prev = { ...currentState }
    const nextState = typeof updater === 'function' ? (updater(prev) || {}) : (updater || {})
    
    // ✅ CORREÇÃO: Incrementa rev baseado no rev atual do servidor
    const nextRev = currentRev + 1
    const next = {
      ...nextState,
      rev: nextRev
    }
    
    const prevVersion = current?.version ?? versionRef.current ?? 0
    const newVersion = prevVersion + 1
    
    console.log(`[NET] commit - rev: ${currentRev} → ${nextRev}, version: ${prevVersion} → ${newVersion}`)
    
    // Tenta atualizar com trava otimista (version na tabela)
    const { data, error } = await supabase
      .from('rooms')
      .update({ 
        state: next, 
        version: newVersion, 
        updated_at: new Date().toISOString() 
      })
      .eq('code', code)
      .eq('version', prevVersion) // trava otimista por version na tabela
      .select('state, version')
      .single()
    
    if (error || !data) {
      // Conflito: alguém gravou antes → recarrega estado remoto
      console.warn(`[NET] commit - conflito detectado (alguém gravou antes) - recarregando estado remoto. Erro:`, error?.message || error)
      const { data: reloaded, error: reloadError } = await supabase
        .from('rooms')
        .select('state, version')
        .eq('code', code)
        .single()
      if (!reloadError && reloaded) {
        setState(reloaded.state || {})
        setVersion(reloaded.version ?? prevVersion)
      }
      return
    }
    
    // Sucesso: atualiza estado local
    setState(data?.state || next)
    setVersion(data?.version ?? newVersion)
    console.log(`[NET] commit - ✅ sucesso - rev: ${data?.state?.rev ?? nextRev}, version: ${data?.version ?? newVersion}`)
  }

  const value = useMemo(() => ({ enabled, ready, state, version, commit }), [enabled, ready, state, version])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default GameNetProvider
export { GameNetProvider }
