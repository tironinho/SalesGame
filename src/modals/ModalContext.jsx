// src/modals/ModalContext.jsx
import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from 'react'

const ModalCtx = createContext(null)

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([]) // [{id, el}]
  const resolverRef = useRef(null)       // resolve da modal do topo

  // fecha a modal do topo e resolve a promise (se houver)
  const resolveTop = (payload) => {
    const res = resolverRef.current
    resolverRef.current = null
    setStack((s) => s.slice(0, -1)) // pop
    if (res) res(payload)
  }

  // abre uma modal (topo). Clonamos o elemento para injetar onResolve.
  const pushModal = (element) => {
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random())
    const elWithResolve = React.cloneElement(element, {
      onResolve: (payload) => resolveTop(payload),
    })
    setStack((s) => [...s, { id, el: elWithResolve }])
  }

  // retorna uma promise que será resolvida quando a modal do topo chamar onResolve
  const awaitTop = () =>
    new Promise((resolve) => {
      resolverRef.current = resolve
    })

  // Esc fecha a modal do topo (se a modal não tratar por conta própria)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && stack.length > 0 && !resolverRef.current?._blocked) {
        resolveTop({ action: 'SKIP' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stack.length])

  const value = useMemo(() => ({ pushModal, awaitTop }), [])

  return (
    <ModalCtx.Provider value={value}>
      {children}
      {/* renderiza todas as modais empilhadas */}
      {stack.map(({ id, el }) => (
        <React.Fragment key={id}>{el}</React.Fragment>
      ))}
    </ModalCtx.Provider>
  )
}

export const useModal = () => useContext(ModalCtx)
