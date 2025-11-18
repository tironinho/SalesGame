import React, { createContext, useContext, useMemo, useRef, useState } from 'react'

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

  // utilitários para botões
  const closeModal = () => resolveTop({ action: 'SKIP' })
  const popModal   = () => resolveTop(false)

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

  // ⚠️ Sem listener de ESC: somente botões fecham a modal

  const value = useMemo(
    () => ({ pushModal, awaitTop, resolveTop, closeModal, popModal }),
    []
  )

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
