import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ModalCtx = createContext(null)

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([]) // [{id, el}]
  const stackRef = useRef(stack)
  const resolversByIdRef = useRef(new Map()) // id -> resolve(payload)

  useEffect(() => {
    stackRef.current = stack
  }, [stack])

  const mkId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    } catch {}
    return String(Date.now() + Math.random())
  }

  const closeById = React.useCallback((id, payload) => {
    const key = String(id ?? '')
    if (!key) return
    const resolver = resolversByIdRef.current.get(key)
    if (resolver) {
      resolversByIdRef.current.delete(key)
      try { resolver(payload) } catch {}
    }
    setStack((prev) => prev.filter((m) => String(m.id) !== key))
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

  const closeAll = React.useCallback((payload = { type: 'MODAL_FORCE_CLOSED' }) => {
    setStack((prev) => {
      try {
        for (const m of prev) {
          const key = String(m?.id ?? '')
          if (!key) continue
          const resolver = resolversByIdRef.current.get(key)
          if (typeof resolver === 'function') {
            try { resolver(payload) } catch {}
          }
          resolversByIdRef.current.delete(key)
        }
      } catch {}
      return []
    })
  }, [])

  // utilitários para botões
  const closeModal = () => closeTop({ action: 'SKIP' })
  const popModal = () => closeTop(false)

  // abre uma modal (topo). Clonamos o elemento para injetar onResolve.
  const pushModal = (element) => {
    const id = mkId()
    const elWithResolve = React.cloneElement(element, {
      onResolve: (payload) => closeById(id, payload),
    })
    setStack((s) => [...s, { id, el: elWithResolve }])
    return id
  }

  // retorna uma promise que será resolvida quando a modal do topo chamar onResolve / closeTop
  const awaitTop = () =>
    new Promise((resolve) => {
      const cur = stackRef.current
      if (!cur || cur.length === 0) {
        resolve(null)
        return
      }
      const top = cur[cur.length - 1]
      resolversByIdRef.current.set(String(top.id), resolve)
    })

  // ⚠️ Sem listener de ESC: somente botões fecham a modal

  const value = useMemo(
    () => ({ stack, pushModal, awaitTop, resolveTop, closeTop, closeAll, closeById, popModal, closeModal }),
    [stack, closeAll, closeById, closeTop]
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
