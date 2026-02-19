import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ModalCtx = createContext(null)

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([]) // [{id, el}]
  const stackRef = useRef(stack)
  // Map<id, Set<resolve(payload)>>
  const resolversByIdRef = useRef(new Map())

  useEffect(() => {
    stackRef.current = stack
  }, [stack])

  // limpeza defensiva: se algum id sumir do stack por caminho indireto, limpa waiters órfãos
  useEffect(() => {
    const activeIds = new Set(stack.map((m) => String(m?.id ?? '')))
    for (const [id] of resolversByIdRef.current.entries()) {
      if (!activeIds.has(String(id))) {
        resolversByIdRef.current.delete(id)
      }
    }
  }, [stack])

  const mkId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    } catch {}
    return String(Date.now() + Math.random())
  }

  const resolveAllForId = React.useCallback((id, payload) => {
    const key = String(id ?? '')
    if (!key) return
    const waiters = resolversByIdRef.current.get(key)
    if (!waiters || waiters.size === 0) return
    resolversByIdRef.current.delete(key)
    for (const resolve of waiters) {
      try { resolve(payload ?? null) } catch {}
    }
  }, [])

  const closeById = React.useCallback((id, payload) => {
    const key = String(id ?? '')
    if (!key) return
    setStack((prev) => prev.filter((m) => String(m.id) !== key))
    resolveAllForId(key, payload)
  }, [resolveAllForId])

  const closeAll = React.useCallback((payload = { action: 'CLOSE_ALL' }) => {
    const entries = Array.from(resolversByIdRef.current.entries())
    setStack([])
    for (const [, waiters] of entries) {
      for (const resolve of waiters) {
        try { resolve(payload ?? null) } catch {}
      }
    }
    resolversByIdRef.current.clear()
  }, [])

  // ✅ API exigida pelo engine: fecha a modal do topo e resolve (se houver)
  const closeTop = React.useCallback((payload) => {
    const cur = stackRef.current
    if (!cur || cur.length === 0) return
    const top = cur[cur.length - 1]
    closeById(top.id, payload)
  }, [closeById])

  // Compatibilidade (código legado): resolveTop = closeTop
  const resolveTop = closeTop

  // utilitários para botões
  const closeModal = React.useCallback(() => closeTop({ action: 'SKIP' }), [closeTop])
  const popModal = React.useCallback(() => closeTop(false), [closeTop])

  // abre uma modal (topo). Clonamos o elemento para injetar onResolve.
  const pushModal = React.useCallback((element) => {
    const id = mkId()
    const elWithResolve = React.cloneElement(element, {
      onResolve: (payload) => closeById(id, payload),
    })
    setStack((s) => [...s, { id, el: elWithResolve }])
    return id
  }, [closeById])

  // retorna uma promise que será resolvida quando a modal do topo chamar onResolve / closeTop
  const awaitTop = React.useCallback(() =>
    new Promise((resolve) => {
      const cur = stackRef.current
      if (!cur || cur.length === 0) {
        resolve(null)
        return
      }
      const top = cur[cur.length - 1]
      const key = String(top.id)
      const map = resolversByIdRef.current
      let waiters = map.get(key)
      if (!waiters) {
        waiters = new Set()
        map.set(key, waiters)
      } else if (waiters.size > 0) {
        console.warn('[ModalContext] awaitTop duplicado para o mesmo modal id:', key, 'waiters:', waiters.size + 1)
      }
      waiters.add(resolve)
    }), [])

  // ⚠️ Sem listener de ESC: somente botões fecham a modal

  const value = useMemo(
    () => ({ stack, pushModal, awaitTop, resolveTop, closeTop, closeModal, popModal, closeById, closeAll }),
    [stack, pushModal, awaitTop, resolveTop, closeTop, closeModal, popModal, closeById, closeAll]
  )

  return (
    <ModalCtx.Provider value={value}>
      {children}
      {/* renderiza modais empilhadas com overlay visível (z-index alto) */}
      {stack.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* backdrop */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
            }}
          />

          {/* renderiza só o topo (comportamento esperado pelo engine/awaitTop) */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {stack[stack.length - 1]?.el}
          </div>
        </div>
      )}
    </ModalCtx.Provider>
  )
}

export const useModal = () => useContext(ModalCtx)
