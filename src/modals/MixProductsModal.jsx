// src/modals/MixProductsModal.jsx
import React, { useEffect, useRef } from 'react'
import { useModal } from './ModalContext'
import InsufficientFundsModal from './InsufficientFundsModal'
import { MIX_RULES } from '../game/gameRules'

/**
 * Modal de escolha do Mix de Produtos (A/B/C/D)
 *
 * onResolve(payload):
 *  • { action:'BUY', level:'A'|'B'|'C'|'D', compra:number, despesa:number, faturamento:number }
 *  • { action:'SKIP' }
 *
 * Obs.: "despesa" e "faturamento" são valores-base por cliente (multiplicar pelos clientes totais).
 * 
 * Props:
 *  - currentCash?: number (saldo atual do jogador; usado para validar compra)
 *  - currentLevel?: string (nível atual do Mix: 'A', 'B', 'C', 'D' ou null)
 *  - mixOwned?: object (níveis possuídos: { A:boolean, B:boolean, C:boolean, D:boolean })
 */
export default function MixProductsModal({ onResolve, currentCash, currentLevel = null, mixOwned = null }) {
  const closeRef = useRef(null)
  const { pushModal, awaitTop } = useModal()

  // Mantém os mesmos valores do print/implementação anterior
  const LEVELS = {
    A: { compra: 12000, despesa: MIX_RULES.A.despPerClient, faturamento: MIX_RULES.A.fatPerClient, color:'#1d4ed8', pill:'NÍVEL A', label:'100 produtos' },
    B: { compra:  6000, despesa: MIX_RULES.B.despPerClient, faturamento: MIX_RULES.B.fatPerClient, color:'#16a34a', pill:'NÍVEL B', label:'50 produtos'  },
    C: { compra:  3000, despesa: MIX_RULES.C.despPerClient, faturamento: MIX_RULES.C.fatPerClient, color:'#f59e0b', pill:'NÍVEL C', label:'20 produtos'  },
    D: { compra:  1000, despesa: MIX_RULES.D.despPerClient, faturamento: MIX_RULES.D.fatPerClient, color:'#6b7280', pill:'NÍVEL D', label:'5 produtos'   },
  }

  async function resolveBuy(level){
    // ✅ CORREÇÃO: Verifica se o nível já está possuído (permite recompra de níveis reduzidos)
    // Se mixOwned foi fornecido, verifica se o nível está possuído
    // Se não foi fornecido, usa currentLevel como fallback
    const isOwned = mixOwned 
      ? (mixOwned[level] === true)
      : (currentLevel === level)
    
    if (isOwned) {
      return // Não permite comprar o mesmo nível que já está possuído
    }

    const row = LEVELS[level]
    const need = Number(row?.compra || 0)
    const cash = Number(currentCash)

    // valida saldo somente se currentCash foi fornecido
    if (Number.isFinite(cash) && cash >= 0 && cash < need) {
      pushModal(
        <InsufficientFundsModal
          requiredAmount={need}
          currentCash={cash}
          title="Saldo insuficiente para adquirir o Mix de Produtos"
          message={`Você precisa de $ ${need.toLocaleString()} mas possui $ ${cash.toLocaleString()}.`}
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }
    onResolve?.({ action:'BUY', level, ...row })
  }

  function resolveSkip(){ onResolve?.({ action:'SKIP' }) }

  // UX: trava scroll e foca no X (ESC/backdrop não fecham)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div style={S.wrap} role="dialog" aria-modal="true" aria-label="Mix de Produtos">
      <div style={S.card}>
        <button ref={closeRef} type="button" style={S.close} onClick={resolveSkip} aria-label="Fechar">✕</button>

        <h2 style={S.title}>Escolha um <b>mix de produtos</b>:</h2>

        <div style={S.note}>
          <div style={{fontWeight:900, marginBottom:4}}>MIX DE PRODUTOS</div>
          <div>Base para cálculo de <b>Despesa</b>/<b>Faturamento</b>: multiplicar pela <b>quantidade total de clientes</b>.</div>
        </div>

        {Number.isFinite(Number(currentCash)) && (
          <div style={S.saldo}>Saldo disponível: <b>$ {Number(currentCash || 0).toLocaleString()}</b></div>
        )}

        {/* Cards (mesmo estilo da modal anterior) */}
        <div style={S.cards}>
          {(['A','B','C','D']).map((k) => {
            const v = LEVELS[k]
            // ✅ CORREÇÃO: Verifica se o nível já está possuído (permite recompra de níveis reduzidos)
            const isOwned = mixOwned 
              ? (mixOwned[k] === true)
              : (currentLevel === k)
            const isDisabled = isOwned
            
            return (
              <div key={k} style={{
                ...S.cardItem, 
                borderColor: isOwned ? '#16a34a' : 'rgba(255,255,255,.15)',
                opacity: isDisabled ? 0.6 : 1
              }}>
                <div style={{
                  ...S.pill, 
                  background: isOwned ? '#16a34a' : '#fff', 
                  color: isOwned ? '#fff' : '#111'
                }}>
                  {isOwned ? '✓ ADQUIRIDO' : v.pill}
                </div>
                <div style={{...S.cardBadge, background:v.color}} />
                <ul style={S.lines}>
                  <li><b>{v.label}</b></li>
                  <li>Compra: <b>$ {v.compra.toLocaleString()}</b></li>
                  <li>Despesa: <b>$ {v.despesa.toLocaleString()}</b></li>
                  <li>Faturamento: <b>$ {v.faturamento.toLocaleString()}</b></li>
                </ul>
                <button
                  type="button"
                  style={{
                    ...S.buyBtn,
                    background: isDisabled ? '#6b7280' : '#2442f9',
                    cursor: isDisabled ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => resolveBuy(k)}
                  disabled={isDisabled}
                  title={isDisabled ? `Mix nível ${k} já adquirido` : `Comprar Mix de Produtos ${k}`}
                >
                  {isDisabled ? 'Já Adquirido' : `Comprar ${k}`}
                </button>
              </div>
            )
          })}
        </div>

        <div style={S.actions}>
          <button type="button" style={{ ...S.bigBtn, background:'#444', color:'#fff' }} onClick={resolveSkip}>
            Não comprar
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap: { position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  card: {
    width:'min(980px, 94vw)', background:'#1b1f2a', color:'#e9ecf1',
    borderRadius:16, padding:'20px', boxShadow:'0 10px 40px rgba(0,0,0,.4)',
    border:'1px solid rgba(255,255,255,.12)', position:'relative'
  },
  close: { position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  title:{ margin:'6px 0 12px', fontWeight:900 },

  note: {
    background:'#2a2f3b',
    border:'1px solid rgba(255,255,255,.15)',
    borderRadius:12,
    padding:'10px 12px',
    margin:'0 0 10px'
  },

  saldo:{ margin:'0 0 10px', padding:'8px 12px', border:'1px dashed rgba(255,255,255,.25)', borderRadius:10 },

  // --- Cards (igual padrão anterior)
  cards:{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginTop:8 },
  cardItem:{ background:'#0f1320', border:'1px solid', borderRadius:14, padding:'12px', display:'flex', flexDirection:'column', gap:8 },
  cardBadge:{ width:'100%', height:6, borderRadius:999, opacity:.9 },
  pill:{ alignSelf:'flex-start', fontSize:12, fontWeight:900, padding:'4px 8px', borderRadius:999, color:'#111' },
  lines:{ margin:0, padding:'0 0 0 16px', lineHeight:1.35 },

  buyBtn:{ marginTop:'auto', padding:'10px 12px', borderRadius:10, border:'none', fontWeight:900, cursor:'pointer', background:'#2442f9', color:'#fff' },

  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:14 },
  bigBtn: { minWidth:160, padding:'14px 18px', borderRadius:12, border:'none', fontWeight:900, cursor:'pointer' },
}
