import React from 'react'

export const TIRONI_URL = 'https://tironitech.com/'

/**
 * Crédito “Desenvolvido por Tironi Tech” com link para o site.
 * @param {{ className?: string, compact?: boolean }} props
 */
export default function TironiCredit({ className = '', compact = false }) {
  return (
    <a
      className={`tironiCredit${compact ? ' tironiCredit--compact' : ''}${className ? ` ${className}` : ''}`}
      href={TIRONI_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Desenvolvido por Tironi Tech — abrir tironitech.com"
    >
      <span className="tironiCreditMark" aria-hidden="true">
        TT
      </span>
      <span className="tironiCreditText">
        {compact ? (
          <>
            Desenvolvido por <strong>Tironi Tech</strong>
          </>
        ) : (
          <>
            <span className="tironiCreditLabel">Desenvolvido por</span>
            <strong className="tironiCreditName">Tironi Tech</strong>
          </>
        )}
      </span>
    </a>
  )
}
