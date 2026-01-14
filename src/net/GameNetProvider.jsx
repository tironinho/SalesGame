// src/net/GameNetProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
// use sempre o único client central
import { supabase } from '../lib/supabaseClient.js'

const Ctx = createContext(null)
// ✅ CORREÇÃO: useGameNet retorna null de forma segura se não houver provider
export const useGameNet = () => {
  try {
    return useContext(Ctx)
  } catch {
    // Se não houver provider, retorna null (não explode)
    return null
  }
}

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
  const activeRoomIdRef = useRef(null)
  const latestKnownUpdatedAtRef = useRef(null)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { versionRef.current = version }, [version])

  // Helper: obtém a row mais recente por code (evita erro de .single() com duplicatas)
  const getLatestRoomByCode = async (roomCode) => {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, code, host_id, state, version, updated_at')
      .eq('code', roomCode)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (error) {
      console.warn('[NET] getLatestRoomByCode error:', error.message || error)
      return null
    }
    return data
  }

  // bootstrap: carrega/cria pelo code
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      let current = await getLatestRoomByCode(code)

      if (!current) {
        // Se não existe, cria uma nova row
        const initial = { code, state: {}, version: 0, host_id: hostId || null }
        const { data, error: upErr } = await supabase
          .from('rooms')
          .insert(initial)
          .select('id, code, host_id, state, version, updated_at')
          .maybeSingle()
        if (upErr) { 
          console.warn('[NET] rooms/create:', upErr.message || upErr)
          return 
        }
        if (cancelled) return
        if (data) {
          current = data
        } else {
          // Se insert não retornou, tenta buscar novamente
          current = await getLatestRoomByCode(code)
        }
      }

      if (cancelled) return
      if (current) {
        activeRoomIdRef.current = current.id
        latestKnownUpdatedAtRef.current = current.updated_at
        setState(current.state || {})
        setVersion(current.version ?? 0)
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
          // ✅ CORREÇÃO MULTIPLAYER: Usa SOMENTE version como autoridade (removido updatedAt check)
          if (typeof row.version === 'number' && row.version > versionRef.current) {
            setVersion(row.version)
            if (row.state) setState(row.state)
            if (row.updated_at) latestKnownUpdatedAtRef.current = row.updated_at
            if (row.id) activeRoomIdRef.current = row.id
            lastEvtRef.current = Date.now()
            console.log('[NET] ✅ applied remote v=%d (realtime)', row.version)
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
      const current = await getLatestRoomByCode(code)
      if (current) {
        // ✅ CORREÇÃO: Só aplica se versão for maior (nunca aceita regressão)
        if (current.version > versionRef.current) {
          setVersion(current.version)
          setState(current.state || {})
          if (current.updated_at) latestKnownUpdatedAtRef.current = current.updated_at
          if (current.id) activeRoomIdRef.current = current.id
        }
      }
    }, 700)
    return () => clearInterval(id)
  }, [enabled, code])

  // commit (CAS robusto usando ID em vez de code)
  const commit = async (updater) => {
    if (!enabled || !ready) return

    const MAX_ATTEMPTS = 3
    const nowISO = new Date().toISOString()

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // 1) lê snapshot mais recente usando helper
      let current = await getLatestRoomByCode(code)

      if (!current) {
        // Se não existe, cria uma nova row
        const initial = { code, state: {}, version: 0, host_id: hostId || null }
        const { data, error: insErr } = await supabase
          .from('rooms')
          .insert(initial)
          .select('id, code, host_id, state, version, updated_at')
          .maybeSingle()
        if (insErr) {
          console.warn(`[NET] commit - insert failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, insErr.message || insErr)
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 50 * attempt))
            continue
          }
          return
        }
        if (data) {
          current = data
          activeRoomIdRef.current = current.id
          latestKnownUpdatedAtRef.current = current.updated_at
        } else {
          // Tenta buscar novamente
          current = await getLatestRoomByCode(code)
          if (!current) {
            console.warn(`[NET] commit - no row after insert (attempt ${attempt}/${MAX_ATTEMPTS})`)
            if (attempt < MAX_ATTEMPTS) {
              await new Promise(resolve => setTimeout(resolve, 50 * attempt))
              continue
            }
            return
          }
        }
      }

      // Atualiza activeRoomIdRef se necessário
      if (current.id) activeRoomIdRef.current = current.id

      let base = current.state || {}
      let next = typeof updater === 'function' ? (updater(base) || {}) : (updater || {})

      // 2) CAS usando ID (não code) para evitar conflitos com duplicatas
      const targetId = activeRoomIdRef.current || current.id
      if (!targetId) {
        console.warn('[NET] commit - no target ID available')
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 50 * attempt))
          continue
        }
        return
      }

      const { data: updated, error: e2 } = await supabase
        .from('rooms')
        .update({
          state: next,
          version: (current.version || 0) + 1,
          updated_at: nowISO,
        })
        .eq('id', targetId)
        .eq('version', current.version)
        .select('state, version, updated_at')
        .maybeSingle()

      if (!e2 && updated) {
        setState(updated.state || {})
        setVersion(updated.version ?? ((current.version || 0) + 1))
        if (updated.updated_at) latestKnownUpdatedAtRef.current = updated.updated_at
        if (attempt > 1) {
          console.log(`[NET] commit succeeded on attempt ${attempt}/${MAX_ATTEMPTS}`)
        }
        return
      }

      // ✅ CORREÇÃO: Trata conflito de versão, "0 rows", ou "Cannot coerce" como conflito e re-tenta
      const isConflict = e2?.code === 'PGRST116' || 
                         e2?.message?.includes('0 rows') ||
                         e2?.message?.includes('Cannot coerce') ||
                         e2?.code === '23505' || // unique violation
                         (e2?.message && e2.message.includes('version')) ||
                         !updated // Se não retornou row, é conflito de versão
      
      if (isConflict && attempt < MAX_ATTEMPTS) {
        console.warn(`[NET] commit conflict (attempt ${attempt}/${MAX_ATTEMPTS}):`, e2?.message || e2 || 'no rows updated', '- retrying with merge monotônico...')
        
        // ✅ CORREÇÃO 2: Retry robusto com merge monotônico
        // Re-fetch estado mais recente
        const fresh = await getLatestRoomByCode(code)
        if (fresh) {
          current = fresh
          activeRoomIdRef.current = fresh.id
          latestKnownUpdatedAtRef.current = fresh.updated_at
          
          // Re-aplica updater no estado mais recente (faz merge)
          base = fresh.state || {}
          const localState = typeof updater === 'function' ? (updater(base) || {}) : (updater || {})
          
          // ✅ CORREÇÃO: Merge monotônico - garante que versão sempre avança
          const freshStateVersion = fresh.state?.stateVersion ?? 0
          const localStateVersion = localState?.stateVersion ?? 0
          const mergedStateVersion = Math.max(freshStateVersion, localStateVersion) + 1
          
          // Merge: preserva campos do fresh que não foram alterados localmente
          next = {
            ...base, // Estado remoto como base
            ...localState, // Aplica mudanças locais
            stateVersion: mergedStateVersion // ✅ Versão monotônica garantida
          }
        }
        
        // Pequeno delay antes de re-tentar para evitar race condition
        await new Promise(resolve => setTimeout(resolve, 50 * attempt))
        continue
      }

      console.warn(`[NET] commit conflict (attempt ${attempt}/${MAX_ATTEMPTS}):`, e2?.message || e2 || 'no rows updated')
    }

    // fallback: resync final
    const current = await getLatestRoomByCode(code)
    if (current) { 
      setState(current.state || {})
      setVersion(current.version ?? 0)
      if (current.updated_at) latestKnownUpdatedAtRef.current = current.updated_at
      if (current.id) activeRoomIdRef.current = current.id
      console.warn('[NET] commit failed after retries, resynced to latest state')
    } else {
      console.warn('[NET] commit fallback resync failed: no row found')
    }
  }

  const value = useMemo(() => ({ enabled, ready, state, version, commit }), [enabled, ready, state, version])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default GameNetProvider
export { GameNetProvider }
