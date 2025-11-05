import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from 'react'

const ModalCtx = createContext({
  pushModal: () => {},
  awaitTop: () => Promise.resolve(null),
  resolveTop: () => {},
  closeModal: () => {},
  popModal: () => {},
  closeAllModals: () => {}, // ✅ NOVO: função para fechar todas as modais
  stackLength: 0 // ✅ NOVO: expõe o tamanho da stack de modais
})

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([]) // [{id, el}]
  const resolverRef = useRef(null)       // resolve da modal do topo

  // fecha a modal do topo e resolve a promise (se houver)
  const resolveTop = React.useCallback((payload) => {
    console.group(`[🎲 MODAL] FECHANDO MODAL`)
    console.log('Stack ANTES:', stack.length, 'modais')
    console.log('Payload recebido:', payload)
    console.log('Resolver disponível:', resolverRef.current !== null)
    
    const res = resolverRef.current
    resolverRef.current = null
    
    // Logs para rastrear ações do jogador nas modais
    if (payload) {
      if (payload.action === 'SKIP') {
        console.log('✅ Ação: Jogador clicou em "Não comprar" ou fechou modal')
      } else if (payload.action === 'ACK') {
        console.log('✅ Ação: Jogador clicou em "OK" ou confirmou')
      } else if (payload.action === 'RECOVERY') {
        console.log('✅ Ação: Jogador escolheu "Recuperação Financeira"')
      } else if (payload.action === 'BANKRUPT') {
        console.log('✅ Ação: Jogador escolheu "Declarar Falência"')
      } else if (payload.type === 'LOAN' || payload.type === 'FIRE' || payload.type === 'REDUCE') {
        console.log(`✅ Ação: Jogador executou ação de recuperação: ${payload.type}`)
      } else if (payload.bought || payload.purchased) {
        console.log('✅ Ação: Jogador comprou algo na modal')
        console.log('  - Detalhes da compra:', payload)
      } else {
        console.log('✅ Ação: Jogador executou ação na modal:', payload)
      }
    } else {
      console.log('⚠️ Modal fechada sem payload')
    }
    
    setStack((s) => {
      const newStack = s.slice(0, -1) // pop
      console.log('Stack DEPOIS:', newStack.length, 'modais')
      console.log('IDs das modais restantes:', newStack.map(m => m.id))
      console.groupEnd()
      return newStack
    })
    
    if (res) {
      console.log('[🎲 MODAL] Resolvendo promise com payload:', payload)
      res(payload)
    } else {
      console.warn('[🎲 MODAL] ⚠️ Nenhum resolver encontrado!')
    }
  }, [stack])

  // utilitários para botões
  const closeModal = React.useCallback(() => resolveTop({ action: 'SKIP' }), [resolveTop])
  const popModal   = React.useCallback(() => resolveTop(false), [resolveTop])
  
  // ✅ NOVO: Fecha todas as modais de uma vez
  const closeAllModals = React.useCallback(() => {
    console.log('[ModalContext] closeAllModals - stackLength:', stack.length)
    // Resolve todas as promises pendentes
    if (resolverRef.current) {
      const res = resolverRef.current
      resolverRef.current = null
      res(null) // Resolve com null para indicar que foi fechado forçadamente
    }
    // Limpa a stack completamente
    setStack([])
    console.log('[ModalContext] closeAllModals - todas as modais foram fechadas, stackLength: 0')
  }, [])

  // abre uma modal (topo). Clonamos o elemento para injetar onResolve.
  const pushModal = React.useCallback((element) => {
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random())
    const elWithResolve = React.cloneElement(element, {
      onResolve: (payload) => resolveTop(payload),
    })
    console.group(`[🎲 MODAL] ABRINDO MODAL - ID: ${id}`)
    console.log('Stack ANTES:', stack.length, 'modais')
    console.log('Tipo do elemento:', element?.type?.name || element?.type || typeof element)
    console.log('Props do elemento:', element?.props || {})
    setStack((s) => {
      const newStack = [...s, { id, el: elWithResolve }]
      console.log('Stack DEPOIS:', newStack.length, 'modais')
      console.log('IDs das modais:', newStack.map(m => m.id))
      console.groupEnd()
      return newStack
    })
  }, [resolveTop, stack])

  // retorna uma promise que será resolvida quando a modal do topo chamar onResolve
  const awaitTop = React.useCallback(() => {
    console.log('[🎲 MODAL] awaitTop chamado - Criando promise para aguardar fechamento da modal')
    console.log('  - Stack atual:', stack.length, 'modais')
    return new Promise((resolve) => {
      resolverRef.current = resolve
      console.log('[🎲 MODAL] Promise criada - Aguardando resolução da modal')
    })
  }, [stack])

  // ⚠️ Sem listener de ESC: somente botões fecham a modal

  const value = useMemo(
    () => ({ 
      pushModal, 
      awaitTop, 
      resolveTop, 
      closeModal, 
      popModal,
      closeAllModals, // ✅ NOVO: função para fechar todas as modais
      stackLength: stack.length // ✅ NOVO: expõe o tamanho da stack
    }),
    [pushModal, awaitTop, resolveTop, closeModal, popModal, closeAllModals, stack.length]
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

export const useModal = () => {
  const context = useContext(ModalCtx)
  // Sempre retorna um objeto válido, mesmo que o ModalProvider não esteja montado
  return context || {
    pushModal: () => {},
    awaitTop: () => Promise.resolve(null),
    resolveTop: () => {},
    closeModal: () => {},
    popModal: () => {},
    closeAllModals: () => {}, // ✅ NOVO: fallback para função vazia
    stackLength: 0 // ✅ NOVO: fallback para 0
  }
}
