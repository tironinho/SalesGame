// src/modals/BuyClientsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from './ModalContext'
import InsufficientFundsModal from './InsufficientFundsModal'

/**
 * Modal para compra de clientes.
 *
 * Props:
 *  - onResolve: function
 *      • { action:'BUY',
 *          qty:number,
 *          unitAcquisition:number,
 *          totalCost:number,
 *          unitMaintenance:number,
 *          maintenanceDelta:number,
 *          bensDelta:number,
 *          clientsAdded:number }
 *      • { action:'SKIP' }
 *  - unitAcquisition?: number   (preço por cliente)   -> padrão 1000
 *  - unitMaintenance?: number   (despesa por cliente) -> padrão 50
 *  - currentCash?: number       (saldo atual do jogador) -> obrigatório para validar saldo
 */
export default function BuyClientsModal({
  onResolve,
  unitAcquisition = 1000,
  unitMaintenance = 50,
  currentCash = 0,
}) {
  const closeRef = useRef(null)
  const inputRef = useRef(null)
  const { pushModal, awaitTop } = useModal()

  const [qty, setQty] = useState('')

  const qtyNum = useMemo(() => {
    const n = Math.floor(Number(qty))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [qty])

  const pricePer = Number(unitAcquisition || 0)
  const mPer     = Number(unitMaintenance || 0)
  const cashNow  = Number(currentCash || 0)

  const maxQtyByCash = useMemo(() => {
    if (pricePer <= 0) return 0
    return Math.max(0, Math.floor(cashNow / pricePer))
  }, [cashNow, pricePer])

  const totalCost        = qtyNum * pricePer
  const maintenanceDelta = qtyNum * mPer
  const canBuy           = qtyNum > 0

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  const handleBuy = async () => {
    if (!canBuy) return

    if (cashNow < totalCost) {
      pushModal(
        <InsufficientFundsModal
          requiredAmount={totalCost}
          currentCash={cashNow}
          title="Saldo insuficiente para comprar clientes"
          message="Você não possui saldo suficiente para concluir esta aquisição."
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }

    onResolve?.({
      action: 'BUY',
      qty: qtyNum,
      unitAcquisition: pricePer,
      totalCost,
      unitMaintenance: mPer,
      // ✅ EXTRA: manutenção deve ser POSITIVA (despesa mensal adicionada). O restante do jogo trata manutencao como número positivo.
      maintenanceDelta,
      bensDelta: totalCost,   // bens aumentam pelo valor da aquisição
      clientsAdded: qtyNum,   // útil para cálculos externos
    })
  }

  // UX: bloqueia scroll; foco no X e no input; Enter confirma
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t1 = setTimeout(() => closeRef.current?.focus?.(), 0)
    const t2 = setTimeout(() => inputRef.current?.focus?.(), 50)
    const onKeyDown = (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        handleBuy()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(t1); clearTimeout(t2)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setBoundedQty = (n) => {
    const v = Math.max(0, Math.min(Math.floor(Number(n) || 0), 1_000_000))
    setQty(String(v))
  }

  return (
    <div
      style={styles.wrap}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation() }}
    >
      <div style={styles.card} onMouseDown={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          style={styles.close}
          onClick={handleClose}
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 style={styles.title}>
          Você pode escolher quantos clientes quer comprar,
          <br />Digite o número de clientes:
        </h2>

        <p style={styles.warn}>
          <b>Mas cuidado com a capacidade de atendimento da sua equipe!</b><br />
          Se o jogador adquirir mais clientes do que os vendedores podem atender,
          assim que passar na casa <i>Faturamento do Mês</i> não receberá o faturamento
          dos clientes excedentes e perderá o(s) cliente(s) que não foram atendidos.
        </p>

        <div style={styles.inlineInfo}>
          <div>Saldo disponível: <b>$ {cashNow.toLocaleString()}</b></div>
          <div>Máximo por saldo: <b>{maxQtyByCash}</b></div>
        </div>

        <div style={styles.qtyRow}>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Digite o número de Clientes"
            value={qty}
            onChange={(e) => setBoundedQty(e.target.value)}
            style={styles.input}
          />
          <div style={styles.quickBtns}>
            <button type="button" style={styles.qbtn} onClick={() => setBoundedQty(qtyNum + 1)}>+1</button>
            <button type="button" style={styles.qbtn} onClick={() => setBoundedQty(qtyNum + 5)}>+5</button>
            <button type="button" style={styles.qbtn} onClick={() => setBoundedQty(qtyNum + 10)}>+10</button>
            <button
              type="button"
              style={styles.qbtn}
              onClick={() => setBoundedQty(maxQtyByCash)}
              title="Comprar o máximo possível com o saldo atual"
            >
              Máx
            </button>
          </div>
        </div>

        <div style={styles.summary}>
          <div>Preço por cliente: <b>$ {pricePer.toLocaleString()}</b></div>
          <div>Despesa mensal por cliente: <b>$ {mPer.toLocaleString()}</b></div>
        </div>

        <div style={styles.summaryStrong}>
          <div>Total compra: <b>$ {Number(totalCost).toLocaleString()}</b></div>
          <div>Manutenção mensal adicionada: <b>$ {Number(maintenanceDelta).toLocaleString()}</b></div>
        </div>

        <div style={styles.actions}>
          <button type="button" style={{ ...styles.bigBtn, background:'#666', color:'#fff' }} onClick={handleClose}>
            Não comprar
          </button>
          <button
            type="button"
            style={{ ...styles.bigBtn, background: canBuy ? '#3fbf49' : '#2f5d33', color:'#09110f' }}
            onClick={handleBuy}
            disabled={!canBuy}
            title={!canBuy ? 'Informe uma quantidade válida' : (cashNow < totalCost ? 'Saldo insuficiente' : undefined)}
          >
            Comprar {canBuy ? `($ ${totalCost.toLocaleString()})` : ''}
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
    width:'min(820px, 92vw)', maxWidth:820, background:'#1b1f2a',
    color:'#e9ecf1', borderRadius:16, padding:'20px 20px 16px',
    boxShadow:'0 10px 40px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.12)',
    position:'relative'
  },
  close: {
    position:'absolute', right:10, top:10, width:36, height:36,
    borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b',
    color:'#fff', cursor:'pointer'
  },
  title: { margin:'6px 0 12px', fontWeight:800, lineHeight:1.3 },
  warn: {
    background:'#271c12', border:'1px solid rgba(255,180,0,.35)',
    color:'#ffd489', borderRadius:10, padding:'10px 12px', margin:'0 0 12px'
  },
  inlineInfo: {
    display:'flex', justifyContent:'space-between', gap:10,
    margin:'0 0 8px', opacity:.95, fontWeight:700, flexWrap:'wrap'
  },
  qtyRow: { display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' },
  input: {
    flex:'1 1 260px', height:42, borderRadius:10, padding:'0 12px',
    border:'1px solid rgba(255,255,255,.18)', background:'#0f1320', color:'#fff',
    outline:'none'
  },
  quickBtns: { display:'flex', gap:6, flexWrap:'wrap' },
  qbtn: {
    height:42, padding:'0 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.18)',
    background:'#2a2f3b', color:'#fff', cursor:'pointer', fontWeight:800
  },
  summary: {
    display:'flex', justifyContent:'space-between', gap:10,
    border:'1px dashed rgba(255,255,255,.2)', borderRadius:10, padding:'8px 12px',
    marginBottom:8, fontWeight:700, flexWrap:'wrap'
  },
  summaryStrong: {
    display:'flex', justifyContent:'space-between', gap:10,
    border:'1px solid rgba(255,255,255,.25)', borderRadius:10, padding:'10px 12px',
    marginBottom:10, fontWeight:800, flexWrap:'wrap'
  },
  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:4, flexWrap:'wrap' },
  bigBtn: {
    minWidth:180, padding:'12px 18px', borderRadius:12, border:'none',
    fontWeight:900, cursor:'pointer'
  },
}
