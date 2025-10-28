// src/modals/DirectBuyModal.jsx
import React, { useEffect, useRef } from 'react'

/**
 * Modal “roteador de compras”.
 *
 * IMPORTANTE: Esta modal NÃO abre as modais filhas por conta própria.
 * Ela apenas resolve com { action:'OPEN', open:'<ALVO>' } para que
 * o App.jsx decida qual modal abrir (contrato atual do app).
 *
 * onResolve(payload)
 *   - { action: 'OPEN', open: 'MIX' | 'MANAGER' | 'INSIDE' | 'FIELD' | 'COMMON' | 'ERP' | 'CLIENTS' | 'TRAINING' }
 *   - { action: 'SKIP' } quando o usuário cancela
 *
 * currentCash
 *   - saldo atual do jogador (somente para exibição/validações se quiser,
 *     o App.jsx é quem repassa para as modais apropriadas)
 */
export default function DirectBuyModal({ onResolve, currentCash = 0 }) {
  const closeRef = useRef(null)

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    console.log('[🎲 MODAL] Jogador clicou em "Não Comprar" ou botão X')
    onResolve?.({ action: 'SKIP' })
  }

  // Bloqueia scroll do body e foca no botão de fechar (sem ESC/backdrop)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prev }
  }, [])

  // Dispara a intenção de abertura para o App.jsx
  const open = (target) => () => {
    // Mantemos o formato exato que o App.jsx espera:
    // if (res.action === 'OPEN') { const open = res.open ... }
    onResolve?.({ action: 'OPEN', open: String(target).toUpperCase() })
  }

  const CARDS = [
    {
      key: 'mix',
      title: 'Mix Produtos',
      lines: ['Nível A: $12000', 'Nível B: $6000', 'Nível C: $3000', 'Nível D: $1000'],
      onBuy: open('MIX'),
    },
    {
      key: 'gestor',
      title: 'Gestor Comercial',
      lines: ['Contratação: $5000', 'Manutenção: $3000'],
      onBuy: open('MANAGER'),
    },
    {
      key: 'inside',
      title: 'Inside Sales',
      lines: ['Contratação: $3000', 'Manutenção: $2000'],
      onBuy: open('INSIDE'),
    },
    {
      key: 'field',
      title: 'Field Sales',
      lines: ['Contratação: $3000', 'Manutenção: $2000'],
      onBuy: open('FIELD'),
    },
    {
      key: 'vendedor',
      title: 'Vendedor Comum',
      lines: ['Contratação: $1500', 'Despesas: $1000'],
      onBuy: open('COMMON'),
    },
    {
      key: 'erp',
      title: 'ERP/Sistemas',
      lines: ['Nível A: $10000', 'Nível B: $4000', 'Nível C: $1500', 'Nível D: $500'],
      onBuy: open('ERP'),
    },
    {
      key: 'carteira',
      title: 'Carteira de Clientes',
      lines: ['Aquisição: $1000'],
      onBuy: open('CLIENTS'),
    },
    {
      key: 'training',
      title: 'Treinamento',
      lines: ['Azul: $500', 'Amarelo: $500', 'Roxo: $500'],
      onBuy: open('TRAINING'),
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

        <div style={{ marginBottom: 8, opacity: .8, fontSize: 13 }}>
          Saldo atual: <b>${Number(currentCash).toLocaleString()}</b>
        </div>

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
