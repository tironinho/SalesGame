import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ModalCtx = createContext(null)

export function ModalProvider({ registry, children }) {
  const [stack, setStack] = useState([]) // [{ key, name, props, resolve, reject }]

  const openModal = useCallback((name, props = {}) => {
    return new Promise((resolve, reject) => {
      const key = `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setStack(s => [...s, { key, name, props, resolve, reject }])
    })
  }, [])

  const closeModal = useCallback(() => setStack(s => s.slice(0, -1)), [])

  const resolveTop = useCallback((value) => {
    setStack(s => {
      const top = s[s.length - 1]
      if (top?.resolve) top.resolve(value)
      return s.slice(0, -1)
    })
  }, [])

  const rejectTop = useCallback((err) => {
    setStack(s => {
      const top = s[s.length - 1]
      if (top?.reject) top.reject(err)
      return s.slice(0, -1)
    })
  }, [])

  const value = useMemo(() => ({ openModal, closeModal, resolveTop, rejectTop, registry }), [
    openModal, closeModal, resolveTop, rejectTop, registry
  ])

  return (
    <ModalCtx.Provider value={value}>
      {children}
      <ModalRoot stack={stack} />
    </ModalCtx.Provider>
  )
}

export function useModal(){
  const ctx = useContext(ModalCtx)
  if (!ctx) throw new Error('useModal must be used within <ModalProvider>')
  return ctx
}

// Root: renderiza o topo da pilha
function ModalRoot({ stack }){
  if (!stack.length) return null
  const top = stack[stack.length - 1]
  const Comp = ModalRoot.registry?.[top.name]
  if (!Comp) return null
  return <Comp {...top.props} />
}

// injeta o registry no Root
ModalRoot.registry = {}
export function bindRegistryToRoot(registry){ ModalRoot.registry = registry }
