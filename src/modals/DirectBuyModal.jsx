// src/modals/DirectBuyModal.jsx
import React, { useEffect, useRef, useState } from 'react'

// Importa as modais que serão chamadas
import MixProductsModal from './MixProductsModal'
import BuyManagerModal from './BuyManagerModal'
import InsideSalesModal from './InsideSalesModal'
import BuyFieldSalesModal from './BuyFieldSalesModal'
import BuyCommonSellersModal from './BuyCommonSellersModal'
import ERPSystemsModal from './ERPSystemsModal'
import BuyClientsModal from './BuyClientsModal'
import TrainingModal from './TrainingModal'

/**
 * Esta modal funciona como um “roteador de compras”.
 * Ao clicar em COMPRAR, ela substitui a si mesma pela
 * modal específica (sem fechar a promessa do topo).
 *
 * onResolve(payload)
 *  - repassa o payload da modal filha (ex.: { action:'BUY', ... })
 *  - { action:'SKIP' } ao cancelar aqui
 *
 * currentCash
 *  - saldo atual do jogador (repassado às modais para validação quando necessário)
 */
export default function DirectBuyModal({ onResolve, currentCash = 0 }) {
  const closeRef = useRef(null)
  const [next, setNext] = useState(null) // MIX | MANAGER | INSIDE | FIELD | COMMON | ERP | CLIENTS | TRAINING

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  // Bloqueia scroll do body e foca no botão de fechar (sem ESC/backdrop)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prev }
  }, [])

  // Quando o usuário escolhe uma opção, renderizamos a modal específica
  if (next) {
    if (next === 'MIX')      return <MixProductsModal onResolve={onResolve} />
    if (next === 'MANAGER')  return <BuyManagerModal  onResolve={onResolve} currentCash={currentCash} />
    if (next === 'INSIDE')   return <InsideSalesModal onResolve={onResolve} currentCash={currentCash} />
    if (next === 'FIELD')    return <BuyFieldSalesModal onResolve={onResolve} currentCash={currentCash} />
    if (next === 'COMMON')   return <BuyCommonSellersModal onResolve={onResolve} currentCash={currentCash} />
    if (next === 'ERP')      return <ERPSystemsModal  onResolve={onResolve} />
    // ✅ Passa o saldo atual para a modal de clientes
    if (next === 'CLIENTS')  return <BuyClientsModal  onResolve={onResolve} currentCash={currentCash} />
    if (next === 'TRAINING') return <TrainingModal    onResolve={onResolve} />
    return null
  }

  const CARDS = [
    {
      key: 'mix',
      title: 'Mix Produtos',
      lines: ['Nível A: $12000', 'Nível B: $6000', 'Nível C: $3000', 'Nível D: $1000'],
      onBuy: () => setNext('MIX'),
    },
    {
      key: 'gestor',
      title: 'Gestor Comercial',
      lines: ['Contratação: $5000', 'Manutenção: $3000'],
      onBuy: () => setNext('MANAGER'),
    },
    {
      key: 'inside',
      title: 'Inside Sales',
      lines: ['Contratação: $3000', 'Manutenção: $2000'],
      onBuy: () => setNext('INSIDE'),
    },
    {
      key: 'field',
      title: 'Field Sales',
      lines: ['Contratação: $3000', 'Manutenção: $2000'],
      onBuy: () => setNext('FIELD'),
    },
    {
      key: 'vendedor',
      title: 'Vendedor Comum',
      lines: ['Contratação: $1500', 'Despesas: $1000'],
      onBuy: () => setNext('COMMON'),
    },
    {
      key: 'erp',
      title: 'ERP/Sistemas',
      lines: ['Nível A: $10000', 'Nível B: $4000', 'Nível C: $1500', 'Nível D: $500'],
      onBuy: () => setNext('ERP'),
    },
    {
      key: 'carteira',
      title: 'Carteira de Clientes',
      lines: ['Aquisição: $1000'],
      onBuy: () => setNext('CLIENTS'),
    },
    {
      key: 'training',
      title: 'Treinamento',
      lines: ['Azul: $500', 'Amarelo: $500', 'Roxo: $500'],
      onBuy: () => setNext('TRAINING'),
    },
  ]

  return (
    <div
      style={styles.wrap}
      role="dialog"
      aria-modal="true"
    >
      <div style={styles.card}>
        <button
          ref={closeRef}
          type="button"
          style={styles.close}
          onClick={handleClose}
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 style={styles.title}>Direto de Compra — escolha uma casa para adquirir:</h2>

        <div style={styles.grid}>
          {CARDS.map((c) => (
            <div key={c.key} style={styles.cell}>
              <div style={styles.cellTitle}>{c.title}</div>
              <ul style={styles.lines}>
                {c.lines.map((ln, i) => <li key={i}>{ln}</li>)}
              </ul>
              <button type="button" style={styles.buyBtn} onClick={c.onBuy}>
                Comprar
              </button>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}>
          <button type="button" style={{ ...styles.buyBtn, background:'#666' }} onClick={handleClose}>
            Não Comprar
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.55)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
  },
  card: {
    width:'min(1000px, 94vw)', background:'#1b1f2a', color:'#e9ecf1',
    borderRadius:16, padding:'20px', boxShadow:'0 10px 40px rgba(0,0,0,.4)',
    border:'1px solid rgba(255,255,255,.12)', position:'relative'
  },
  close: {
    position:'absolute', right:10, top:10, width:36, height:36,
    borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b',
    color:'#fff', cursor:'pointer'
  },
  title: { margin:'6px 0 16px', fontWeight:800 },
  grid: {
    display:'grid',
    gridTemplateColumns:'repeat(4, minmax(180px, 1fr))',
    gap:12
  },
  cell: {
    background:'#0f1320', border:'1px solid rgba(255,255,255,.08)', borderRadius:12,
    padding:12, display:'flex', flexDirection:'column', gap:8, minHeight:160
  },
  cellTitle: { fontWeight:800, marginBottom:4 },
  lines: { margin:0, padding:'0 0 0 16px', opacity:.85, lineHeight:1.3 },
  buyBtn: {
    marginTop:'auto', alignSelf:'center',
    minWidth:140, padding:'10px 14px', borderRadius:10, border:'none',
    background:'#3fbf49', color:'#09110f', fontWeight:900, cursor:'pointer'
  }
}
