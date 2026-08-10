// src/modals/DirectBuyModal.jsx
import React, { useEffect, useRef } from 'react'
import { ERP_RULES, VENDOR_RULES } from '../game/gameRules.js'

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
      lines: [
        `Contratação: $${VENDOR_RULES.inside.hire}`,
        `Manutenção: $${VENDOR_RULES.inside.baseDesp}`,
      ],
      onBuy: open('INSIDE'),
    },
    {
      key: 'field',
      title: 'Field Sales',
      lines: [
        `Contratação: $${VENDOR_RULES.field.hire}`,
        `Manutenção: $${VENDOR_RULES.field.baseDesp}`,
      ],
      onBuy: open('FIELD'),
    },
    {
      key: 'vendedor',
      title: 'Vendedor Comum',
      lines: ['Contratação: $2000', 'Despesas: $1000'],
      onBuy: open('COMMON'),
    },
    {
      key: 'erp',
      title: 'ERP/Sistemas',
      lines: [
        `Nível A: $${ERP_RULES.A.price}`,
        `Nível B: $${ERP_RULES.B.price}`,
        `Nível C: $${ERP_RULES.C.price}`,
        `Nível D: $${ERP_RULES.D.price}`,
      ],
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
      className="directBuyWrap"
      role="dialog"
      aria-modal="true"
    >
      <div className="directBuyCard">
        <button
          ref={closeRef}
          type="button"
          style={styles.close}
          onClick={handleClose}
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 className="directBuyTitle">Direto de Compra — escolha uma casa para adquirir:</h2>

        <div style={{ marginBottom: 8, opacity: .8, fontSize: 13 }}>
          Saldo atual: <b>${Number(currentCash).toLocaleString()}</b>
        </div>

        <div className="directBuyGrid">
          {CARDS.map((c) => (
            <div key={c.key} style={styles.cell}>
              <div style={styles.cellTitle}>{c.title}</div>
              <ul style={styles.lines}>
                {c.lines.map((ln, i) => <li key={i}>{ln}</li>)}
              </ul>
              <button type="button" className="directBuyBtn" style={{ background:'#3fbf49', color:'#09110f' }} onClick={c.onBuy}>
                Comprar
              </button>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}>
          <button type="button" className="directBuyBtn" style={{ background:'#666', color:'#09110f' }} onClick={handleClose}>
            Não Comprar
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  /* wrap, card, grid, título e botões migraram para classes CSS responsivas
     (.directBuyWrap, .directBuyCard, .directBuyGrid, .directBuyTitle,
      .directBuyBtn em styles.css) */
  close: {
    position:'absolute', right:10, top:10, width:36, height:36,
    borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b',
    color:'#fff', cursor:'pointer', flex:'0 0 auto'
  },
  cell: {
    background:'#0f1320', border:'1px solid rgba(255,255,255,.08)', borderRadius:12,
    padding:12, display:'flex', flexDirection:'column', gap:8, minHeight:160
  },
  cellTitle: { fontWeight:800, marginBottom:4 },
  lines: { margin:0, padding:'0 0 0 16px', opacity:.85, lineHeight:1.3 },
}
