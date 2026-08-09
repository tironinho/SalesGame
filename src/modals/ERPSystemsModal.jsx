// src/modals/ERPSystemsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from './ModalContext'
import InsufficientFundsModal from './InsufficientFundsModal'
import PurchaseImpactPreview from '../components/PurchaseImpactPreview.jsx'
import {
  buildErpPurchaseDeltas,
  calculateErpReturn,
  countErpCollaborators,
  getErpLevelView,
} from '../game/erpPurchase.js'
import { previewPurchaseImpact } from '../game/purchasePreview.js'
import { DEFAULT_MAX_ROUNDS, normalizeMaxRounds } from '../game/roundConfig'

const LEVEL_META = {
  A: { color: '#1d4ed8', pill: 'NÍVEL A' },
  B: { color: '#16a34a', pill: 'NÍVEL B' },
  C: { color: '#f59e0b', pill: 'NÍVEL C' },
  D: { color: '#6b7280', pill: 'NÍVEL D' },
}

function levelView(k) {
  const rule = getErpLevelView(k)
  const meta = LEVEL_META[k] || {}
  if (!rule) return null
  return {
    ...rule,
    color: meta.color,
    pill: meta.pill,
  }
}

/**
 * onResolve(payload)
 *  - {action:'BUY', level:'A'|'B'|'C'|'D', values:{...}}
 *  - {action:'SKIP'}
 */
export default function ERPSystemsModal({
  onResolve,
  currentCash = 0,
  currentLevel = null,
  erpOwned = null,
  allowBack = false,
  currentPlayer = null,
  horizonRounds = DEFAULT_MAX_ROUNDS,
}) {
  const closeRef = useRef(null)
  const { pushModal, awaitTop } = useModal()
  const [selectedLevel, setSelectedLevel] = useState(null)

  const normLevel = (v) => {
    const L = String(v || '').toUpperCase()
    return ['A', 'B', 'C', 'D'].includes(L) ? L : ''
  }
  const current = normLevel(currentLevel) || 'D'
  const cashNow = Number(currentCash || 0)
  const staffCount = countErpCollaborators(currentPlayer || { cash: cashNow })

  const LEVELS = useMemo(() => ({
    A: levelView('A'),
    B: levelView('B'),
    C: levelView('C'),
    D: levelView('D'),
  }), [])

  const draftPayload = useMemo(() => {
    const desired = normLevel(selectedLevel)
    if (!desired || desired === current) return null
    const values = LEVELS[desired]
    if (!values) return null
    return { action: 'BUY', level: desired, values }
  }, [selectedLevel, current, LEVELS])

  const purchaseImpact = useMemo(() => {
    if (!draftPayload) return null
    const playerSnapshot = {
      ...(currentPlayer || {}),
      cash: cashNow,
      erpLevel: current,
    }
    const deltas = buildErpPurchaseDeltas(draftPayload)
    return previewPurchaseImpact({
      player: playerSnapshot,
      deltas,
      immediateCost: draftPayload.values.compra,
    })
  }, [draftPayload, currentPlayer, cashNow, current])

  const safeHorizon = normalizeMaxRounds(horizonRounds, DEFAULT_MAX_ROUNDS)

  const erpReturn = useMemo(() => {
    if (!purchaseImpact) return null
    return calculateErpReturn({
      impact: purchaseImpact,
      horizonRounds: safeHorizon,
      staffCount,
    })
  }, [purchaseImpact, safeHorizon, staffCount])

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }
  const handleBack = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'BACK' })
  }

  const handleSelect = (level) => {
    const desired = normLevel(level)
    if (!desired) return
    if (desired === current) return
    setSelectedLevel(desired)
  }

  const handleBuy = async () => {
    if (!draftPayload) return

    const desired = draftPayload.level
    const values = draftPayload.values
    const need = Number(values?.compra || 0)

    if (cashNow < need) {
      pushModal(
        <InsufficientFundsModal
          requiredAmount={need}
          currentCash={cashNow}
          title="Saldo insuficiente para comprar ERP"
          message={`Você precisa de $ ${need.toLocaleString()} para o ERP nível ${desired}, mas possui $ ${cashNow.toLocaleString()}.`}
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }
    onResolve?.({ action: 'BUY', level: desired, values })
  }

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  const formatMoneySigned = (n) => {
    const v = Number(n || 0)
    const abs = Math.abs(v).toLocaleString()
    if (v > 0) return `+ $ ${abs}`
    if (v < 0) return `- $ ${abs}`
    return `$ ${abs}`
  }

  const paybackLabel = (() => {
    if (!erpReturn) return null
    if (erpReturn.status === 'no_financial_return' || erpReturn.paybackRounds == null) {
      return 'Sem retorno financeiro estimado (ganho líquido ≤ 0)'
    }
    if (erpReturn.paybackRounds === 0) {
      return 'Retorno estimado: 0 ciclos'
    }
    const rounded = Math.ceil(erpReturn.paybackRounds * 10) / 10
    return `Retorno estimado: ~${rounded} ciclos`
  })()

  return (
    <div className="erpWrap" role="dialog" aria-modal="true" aria-label="ERP/Sistemas">
      <div className="erpCard">
        <button ref={closeRef} type="button" style={S.close} onClick={handleClose} aria-label="Fechar">✕</button>

        <h2 className="erpTitle">Escolha o nível de <b>ERP / Sistemas</b>:</h2>

        <div style={S.note}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>ERP / SISTEMAS</div>
          <div>
            O benefício do ERP cresce conforme o tamanho da sua equipe.
          </div>
          <div style={{ marginTop: 4 }}>
            Quanto mais colaboradores sua empresa possui (vendedores e gestores),
            maior o impacto financeiro do sistema.
          </div>
        </div>

        <p className="purchasePreviewHint">
          O ERP gera faturamento e despesas por colaborador da equipe comercial.
          Ele não escala com a quantidade de clientes — o Mix de Produtos já cobre essa parte.
          Avalie o ganho líquido por ciclo e o tempo estimado para recuperar o investimento.
        </p>

        <div style={S.saldo}>
          Saldo disponível: <b>$ {cashNow.toLocaleString()}</b>
          {' · '}
          Equipe atual: <b>{staffCount}</b> colaborador{staffCount === 1 ? '' : 'es'}
        </div>

        <div className="erpTableScroll">
          <div className="erpTable">
            <div style={S.trHead}>
              <div className="erpStickyCell erpStickyHead" style={S.th}></div>
              <div style={{ ...S.th, background: '#10214d' }}>Nível A</div>
              <div style={{ ...S.th, background: '#0f3a1c' }}>Nível B</div>
              <div style={{ ...S.th, background: '#4a3705' }}>Nível C</div>
              <div style={{ ...S.th, background: '#2a2f3b' }}>Nível D</div>
            </div>
            <Row label="COMPRA" fmt vA={LEVELS.A.compra} vB={LEVELS.B.compra} vC={LEVELS.C.compra} vD={LEVELS.D.compra} />
            <Row label="DESPESA" fmt vA={LEVELS.A.despesa} vB={LEVELS.B.despesa} vC={LEVELS.C.despesa} vD={LEVELS.D.despesa} />
            <Row label="FATURAMENTO" fmt vA={LEVELS.A.faturamento} vB={LEVELS.B.faturamento} vC={LEVELS.C.faturamento} vD={LEVELS.D.faturamento} />
          </div>
        </div>
        <div style={S.perStaffNote}>
          Valores de despesa e faturamento na tabela são <b>por colaborador</b>. Upgrade cobra o preço cheio do nível escolhido.
        </div>

        <div className="erpCards">
          {(['A', 'B', 'C', 'D']).map((k) => {
            const v = LEVELS[k]
            const isOwned = current === k
            const isDisabled = isOwned
            const isSelected = selectedLevel === k

            return (
              <div
                key={k}
                style={{
                  ...S.cardItem,
                  borderColor: isOwned ? '#16a34a' : (isSelected ? '#2442f9' : 'rgba(255,255,255,.15)'),
                  opacity: isDisabled ? 0.6 : 1,
                }}
              >
                <div
                  className="erpPill"
                  style={{
                    ...S.pill,
                    background: isOwned ? '#16a34a' : '#fff',
                    color: isOwned ? '#fff' : '#111',
                  }}
                >
                  {isOwned ? '✓ ADQUIRIDO' : v.pill}
                </div>
                <div style={{ ...S.cardBadge, background: v.color }} />
                <ul style={S.lines}>
                  <li>Compra: <b>$ {v.compra.toLocaleString()}</b></li>
                  <li>Despesa: <b>$ {v.despesa.toLocaleString()}</b> / colab.</li>
                  <li>Faturamento: <b>$ {v.faturamento.toLocaleString()}</b> / colab.</li>
                </ul>
                <button
                  type="button"
                  className="erpBuyBtn"
                  style={{
                    ...S.buyBtn,
                    background: isDisabled ? '#6b7280' : (isSelected ? '#1d4ed8' : '#2442f9'),
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => handleSelect(k)}
                  disabled={isDisabled}
                  title={isDisabled ? `ERP nível ${k} já adquirido` : `Selecionar ERP nível ${k}`}
                >
                  {isDisabled ? 'Já Adquirido' : (isSelected ? `Selecionado ${k}` : `Selecionar ${k}`)}
                </button>
              </div>
            )
          })}
        </div>

        {purchaseImpact && erpReturn && (
          <>
            <PurchaseImpactPreview impact={purchaseImpact} />

            <div className="purchasePreviewExtra">
              <div className="purchasePreviewExtraTitle">Retorno do investimento (ERP)</div>
              <div className="purchasePreviewRow">
                <span>Investimento</span>
                <span>$ {Number(erpReturn.immediateCost || 0).toLocaleString()}</span>
              </div>
              <div className="purchasePreviewRow">
                <span>Equipe atual</span>
                <span>{staffCount} colaborador{staffCount === 1 ? '' : 'es'}</span>
              </div>
              <div className="purchasePreviewRow">
                <span>Faturamento adicional estimado por ciclo</span>
                <span>{formatMoneySigned(erpReturn.revenueDelta)}</span>
              </div>
              <div className="purchasePreviewRow">
                <span>Despesa adicional estimada por ciclo</span>
                <span>{formatMoneySigned(erpReturn.expensesDelta)}</span>
              </div>
              <div className="purchasePreviewRow purchasePreviewRowStrong">
                <span>Ganho líquido adicional por ciclo</span>
                <span>{formatMoneySigned(erpReturn.incrementalNet)}</span>
              </div>
              <div className="purchasePreviewRow purchasePreviewRowStrong">
                <span>{paybackLabel}</span>
              </div>
              {staffCount <= 0 && (
                <div className="purchasePreviewAlert">
                  Sem colaboradores, o ERP não gera faturamento nem despesa operacional neste momento.
                </div>
              )}
              {erpReturn && !erpReturn.paysBackWithinHorizon && erpReturn.status !== 'no_cost' && (
                <div className="purchasePreviewAlert">
                  Este investimento não se recupera no horizonte atual de {safeHorizon} rodada(s).
                </div>
              )}
            </div>
          </>
        )}

        <div style={S.actions}>
          {allowBack && (
            <button type="button" className="erpBigBtn" style={{ ...S.bigBtn, background: '#2a2f3b', color: '#fff' }} onClick={handleBack}>
              Voltar
            </button>
          )}
          <button type="button" className="erpBigBtn" style={{ ...S.bigBtn, background: '#444', color: '#fff' }} onClick={handleClose}>
            Não comprar
          </button>
          <button
            type="button"
            className="erpBigBtn"
            style={{
              ...S.bigBtn,
              background: draftPayload ? '#75e16c' : '#365b31',
              color: '#0b120a',
              cursor: draftPayload ? 'pointer' : 'not-allowed',
            }}
            onClick={handleBuy}
            disabled={!draftPayload}
            title={!draftPayload ? 'Selecione um nível diferente do atual' : `Confirmar compra do nível ${draftPayload.level}`}
          >
            {draftPayload ? `Confirmar compra ${draftPayload.level}` : 'Confirmar compra'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, vA, vB, vC, vD, fmt }) {
  const f = (n) => (fmt ? `$ ${Number(n).toLocaleString()}` : n)
  return (
    <div style={S.tr}>
      <div className="erpStickyCell" style={{ ...S.td, fontWeight: 700 }}>{label}</div>
      <div style={S.td}>{f(vA)}</div>
      <div style={S.td}>{f(vB)}</div>
      <div style={S.td}>{f(vC)}</div>
      <div style={S.td}>{f(vD)}</div>
    </div>
  )
}

const S = {
  close: { position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: '#2a2f3b', color: '#fff', cursor: 'pointer' },

  note: {
    background: '#2a2f3b',
    border: '1px solid rgba(255,255,255,.15)',
    borderRadius: 12,
    padding: '10px 12px',
    margin: '0 0 10px',
  },

  saldo: { margin: '0 0 10px', padding: '8px 12px', border: '1px dashed rgba(255,255,255,.25)', borderRadius: 10 },
  perStaffNote: { margin: '0 0 10px', fontSize: 13, opacity: 0.9 },

  trHead: { display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) repeat(4, minmax(0, 1fr))', background: '#121621' },
  th: { padding: '10px 12px', fontWeight: 800, borderLeft: '1px solid rgba(255,255,255,.06)' },
  tr: { display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) repeat(4, minmax(0, 1fr))', background: '#0f1320' },
  td: { padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.06)', borderLeft: '1px solid rgba(255,255,255,.06)' },

  cardItem: { border: '1px solid rgba(255,255,255,.15)', borderRadius: 14, padding: 12, background: '#121621', display: 'grid', gap: 8 },
  pill: { display: 'inline-block', padding: '4px 8px', borderRadius: 999, fontWeight: 900, fontSize: 12 },
  cardBadge: { height: 6, borderRadius: 999 },
  lines: { margin: 0, paddingLeft: 18, lineHeight: 1.45 },
  buyBtn: { border: 0, borderRadius: 10, padding: '10px 12px', color: '#fff', fontWeight: 800 },

  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 },
  bigBtn: { flex: '1 1 140px', border: 0, borderRadius: 12, padding: '12px 14px', fontWeight: 900 },
}
