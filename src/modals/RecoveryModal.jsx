// src/modals/RecoveryModal.jsx
import React, { useMemo, useState } from 'react'
import { useModal } from './ModalContext'

/**
 * Modal de Recuperação Financeira
 * Fluxos:
 *  - Menu principal (3 botões)
 *  - Empréstimo (valor até 50% dos BENS)
 *  - Reduzir MIX/ERP (recebe 50% do valor de downgrade)  -> aqui usamos valores fixos simples
 *  - Demitir (recebe 50% do valor "total" dos cargos selecionados)
 *
 * Retorno via resolveTop({ type, amount, note })
 */

export default function RecoveryModal({ playerName = 'Jogador', bens = 4000 }) {
  const { resolveTop, popModal } = useModal?.() || {}
  const [step, setStep] = useState('menu')

  const close = () => (popModal ? popModal(false) : resolveTop?.(null))

  // ======== EMPRESTIMO ========
  const loanAvailable = useMemo(() => Math.max(0, Math.floor(bens * 0.5)), [bens])
  const [loanInput, setLoanInput] = useState('')

  const confirmLoan = () => {
    const val = Math.max(0, Math.min(loanAvailable, Math.floor(Number(loanInput)||0)))
    if (val > 0) resolveTop?.({ type: 'LOAN', amount: val, note: `Empréstimo +$${val}` })
    else resolveTop?.(null)
  }

  // ======== REDUZIR MIX/ERP (exemplo simples) ========
  // valores "redução" (metade do nível comprado). Você pode trocar esses números pelo seu estado real.
  const REDUCE_OPTIONS = [
    { key:'mix', label:'MIX PRODUTOS', credit: 1500 },
    { key:'erp', label:'ERP/SISTEMAS', credit: 1500 },
  ]
  const [reduceSel, setReduceSel] = useState(null)
  const confirmReduce = () => {
    if (!reduceSel) return resolveTop?.(null)
    resolveTop?.({ type:'REDUCE', amount: reduceSel.credit, note:`Redução ${reduceSel.label} +$${reduceSel.credit}` })
  }

  // ======== DEMITIR (exemplo com 4 funções) ========
  const ROLES = [
    { key:'comum',  label:'Vendedor Comum', total:1500 }, // metade = 750
    { key:'field',  label:'Field Sales',     total:0    },
    { key:'inside', label:'Inside Sales',    total:0    },
    { key:'gestor', label:'Gestor',          total:0    },
  ]
  const [qty, setQty] = useState({ comum:0, field:0, inside:0, gestor:0 })
  const add = (k, d) =>
    setQty(q => ({ ...q, [k]: Math.max(0, (q[k]||0) + d) }))

  const fireAmount = useMemo(() => {
    return ROLES.reduce((sum, r) => {
      const q = qty[r.key] || 0
      const creditUnit = Math.floor(r.total * 0.5)
      return sum + (q * creditUnit)
    }, 0)
  }, [qty])

  const confirmFire = () => {
    if (fireAmount > 0) resolveTop?.({ type:'FIRE', amount: fireAmount, note:`Demissões +$${fireAmount}` })
    else resolveTop?.(null)
  }

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        {/* header */}
        <div style={S.header}>
          <div style={{ fontWeight:900, fontSize:22 }}>RECUPERAÇÃO FINANCEIRA</div>
          <button onClick={close} style={S.closeBtn}>×</button>
        </div>

        {/* steps */}
        {step === 'menu' && (
          <div style={S.body}>
            <p style={S.lead}>
              Você está sem dinheiro, {playerName}. Escolha uma das opções:
            </p>

            <ul style={S.bullets}>
              <li>Pedir <b>empréstimo</b> único com 50% de juros garantido por 50% dos seus <b>BENS</b> (limite {`$ ${loanAvailable}`}).</li>
              <li><b>Reduzir</b> níveis de <b>MIX de Produtos</b> ou <b>ERP/Sistemas</b> e receber 50% do valor pago.</li>
              <li><b>Demitir</b> funcionários e receber 50% do valor total.</li>
            </ul>

            <div style={S.rowBtns}>
              <button style={{...S.cta, background:'#ef4444'}} onClick={() => setStep('fire')}>DEMITIR</button>
              <button style={{...S.cta, background:'#a16207'}} onClick={() => setStep('reduce')}>REDUZIR</button>
              <button style={{...S.cta, background:'#16a34a'}} onClick={() => setStep('loan')}>EMPRÉSTIMO</button>
            </div>
          </div>
        )}

        {step === 'loan' && (
          <div style={S.body}>
            <div style={S.subHeader}>
              <b style={{fontSize:20}}>EMPRÉSTIMO</b>
            </div>
            <p>Você pode realizar um empréstimo colocando <b>50% dos seus BENS</b> como garantia (pago na próxima “Despesas Operacionais”).</p>
            <div style={S.infoRow}>
              <span>Valor disponível:</span> <b>${loanAvailable}</b>
            </div>
            <div style={S.infoRow}>
              <span>Valor garantia:</span> <b>${loanAvailable}</b>
            </div>

            <input
              style={S.input}
              type="number"
              min={0}
              max={loanAvailable}
              placeholder="Digite o valor que quer emprestar"
              value={loanInput}
              onChange={e => setLoanInput(e.target.value)}
            />

            <div style={S.rowBtns}>
              <button style={S.back} onClick={() => setStep('menu')}>← Voltar</button>
              <button
                style={{...S.cta, background:'#16a34a', opacity:(Number(loanInput)>0 && Number(loanInput)<=loanAvailable)?1:.6}}
                onClick={confirmLoan}
              >
                Pegar Empréstimo
              </button>
            </div>
          </div>
        )}

        {step === 'reduce' && (
          <div style={S.body}>
            <div style={S.subHeader}><b style={{fontSize:20}}>REDUZIR NÍVEL MIX/ERP</b></div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
              {REDUCE_OPTIONS.map(op => (
                <button
                  key={op.key}
                  onClick={() => setReduceSel(op)}
                  style={{
                    ...S.option,
                    outline: reduceSel?.key===op.key ? '3px solid #a78bfa' : 'none'
                  }}
                >
                  <div style={{fontWeight:800, fontSize:16, marginBottom:6}}>{op.label}</div>
                  <div>Crédito ao reduzir: <b>${op.credit}</b></div>
                </button>
              ))}
            </div>

            <div style={S.rowBtns}>
              <button style={S.back} onClick={() => setStep('menu')}>← Voltar</button>
              <button
                style={{...S.cta, background:'#a16207', opacity:reduceSel?1:.6}}
                onClick={confirmReduce}
              >
                REDUZIR
              </button>
            </div>
          </div>
        )}

        {step === 'fire' && (
          <div style={S.body}>
            <div style={S.subHeader}><b style={{fontSize:20}}>DEMITIR FUNCIONÁRIOS</b></div>

            <div style={{display:'grid', gap:12}}>
              {ROLES.map(r => (
                <div key={r.key} style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1.2fr 1fr', alignItems:'center', gap:8}}>
                  <div><b>{r.label}</b></div>
                  <div>Valor Total: <b>${r.total}</b></div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <button style={S.spin} onClick={() => add(r.key, -1)}>-</button>
                    <div style={{minWidth:24, textAlign:'center'}}>{qty[r.key]||0}</div>
                    <button style={S.spin} onClick={() => add(r.key, +1)}>+</button>
                  </div>
                  <div>Valor: <b>${Math.floor(r.total*0.5) * (qty[r.key]||0)}</b></div>
                </div>
              ))}
            </div>

            <div style={{marginTop:12, textAlign:'right'}}>Total: <b>${fireAmount}</b></div>

            <div style={S.rowBtns}>
              <button style={S.back} onClick={() => setStep('menu')}>← Voltar</button>
              <button
                style={{...S.cta, background:'#ef4444', opacity:fireAmount>0?1:.6}}
                onClick={confirmFire}
              >
                DEMITIR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.6)',
    display:'grid', placeItems:'center', zIndex:9999
  },
  card: {
    width:'min(920px, 96vw)', maxHeight:'90vh', overflow:'auto',
    background:'#15161a', color:'#e9ecf1',
    border:'1px solid rgba(255,255,255,.08)',
    borderRadius:20, boxShadow:'0 20px 50px rgba(0,0,0,.5)',
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.08)'
  },
  closeBtn:{
    width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)',
    background:'transparent', color:'#fff', fontSize:20, cursor:'pointer'
  },
  body:{ padding:16 },
  lead:{ opacity:.95, lineHeight:1.5 },
  bullets:{ margin:'8px 0 16px 18px' },
  rowBtns:{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:12, flexWrap:'wrap' },
  cta:{
    padding:'12px 16px', border:0, borderRadius:12, color:'#fff',
    fontWeight:900, cursor:'pointer', boxShadow:'0 10px 24px rgba(0,0,0,.25)'
  },
  back:{
    padding:'10px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,.15)',
    background:'transparent', color:'#e9ecf1', cursor:'pointer'
  },
  subHeader:{ marginBottom:8 },
  infoRow:{ display:'flex', gap:8, alignItems:'baseline', margin:'4px 0' },
  input:{
    width:'100%', padding:'12px 12px', borderRadius:12, background:'#0f1115',
    color:'#fff', border:'1px solid rgba(255,255,255,.15)', marginTop:10
  },
  option:{
    padding:16, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
    borderRadius:14, textAlign:'center', cursor:'pointer'
  },
  spin:{
    width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,.15)',
    background:'transparent', color:'#fff', fontSize:18, cursor:'pointer'
  }
}
