import React from 'react'

function formatMoney(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n).toLocaleString()
  if (n > 0) return `+ $ ${abs}`
  if (n < 0) return `- $ ${abs}`
  return `$ ${abs}`
}

function formatNumber(value) {
  const n = Number(value || 0)
  if (n > 0) return `+${n.toLocaleString()}`
  if (n < 0) return n.toLocaleString()
  return n.toLocaleString()
}

function deltaClass(value) {
  const n = Number(value || 0)
  if (n > 0) return 'purchasePreviewDeltaPositive'
  if (n < 0) return 'purchasePreviewDeltaNegative'
  return 'purchasePreviewDeltaNeutral'
}

/**
 * Bloco visual reutilizável de preview financeiro.
 * Apenas apresenta dados; não aplica compra nem altera estado.
 */
export default function PurchaseImpactPreview({ impact }) {
  if (!impact) return null

  const { immediateCost, current, after, difference } = impact

  return (
    <div className="purchasePreview">
      <div className="purchasePreviewTitle">Impacto estimado da compra</div>

      <div className="purchasePreviewGrid">
        <div className="purchasePreviewRow purchasePreviewRowStrong">
          <span>Custo imediato</span>
          <span className="purchasePreviewDeltaNegative">
            $ {Number(immediateCost || 0).toLocaleString()}
          </span>
        </div>

        <div className="purchasePreviewRow">
          <span>Caixa atual</span>
          <span>$ {Number(current.cash || 0).toLocaleString()}</span>
        </div>
        <div className="purchasePreviewRow">
          <span>Caixa após a compra</span>
          <span className={deltaClass(difference.cash)}>
            $ {Number(after.cash || 0).toLocaleString()}
            <small> ({formatMoney(difference.cash)})</small>
          </span>
        </div>

        <div className="purchasePreviewRow">
          <span>Faturamento atual → futuro</span>
          <span>
            $ {Number(current.revenue || 0).toLocaleString()}
            {' → '}
            $ {Number(after.revenue || 0).toLocaleString()}
            <small className={deltaClass(difference.revenue)}>
              {' '}({formatMoney(difference.revenue)})
            </small>
          </span>
        </div>

        <div className="purchasePreviewRow">
          <span>Despesas atuais → futuras</span>
          <span>
            $ {Number(current.expenses || 0).toLocaleString()}
            {' → '}
            $ {Number(after.expenses || 0).toLocaleString()}
            <small className={deltaClass(difference.expenses)}>
              {' '}({formatMoney(difference.expenses)})
            </small>
          </span>
        </div>

        <div className="purchasePreviewRow">
          <span>Capacidade atual → futura</span>
          <span>
            {Number(current.capacity || 0).toLocaleString()}
            {' → '}
            {Number(after.capacity || 0).toLocaleString()}
            <small className={deltaClass(difference.capacity)}>
              {' '}({formatNumber(difference.capacity)})
            </small>
          </span>
        </div>

        <div className="purchasePreviewRow">
          <span>Patrimônio atual → futuro</span>
          <span>
            $ {Number(current.patrimonio || 0).toLocaleString()}
            {' → '}
            $ {Number(after.patrimonio || 0).toLocaleString()}
            <small className={deltaClass(difference.patrimonio)}>
              {' '}({formatMoney(difference.patrimonio)})
            </small>
          </span>
        </div>

        <div className="purchasePreviewRow purchasePreviewRowStrong">
          <span>Impacto líquido mensal estimado</span>
          <span className={deltaClass(difference.monthlyNet)}>
            {formatMoney(difference.monthlyNet)}
          </span>
        </div>
      </div>
    </div>
  )
}
