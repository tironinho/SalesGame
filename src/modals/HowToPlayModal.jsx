import React, { useEffect } from 'react'
import ModalBase from './ModalBase'

const SECTIONS = [
  {
    title: 'Objetivo',
    body: 'A duração é escolhida pelo host entre 1 e 5 rodadas. O padrão é 5. Termine com o maior patrimônio.',
  },
  {
    title: 'Caixa',
    body: 'Dinheiro disponível para compras, despesas e decisões.',
  },
  {
    title: 'Patrimônio',
    body: 'Soma do caixa disponível com o valor dos bens.',
  },
  {
    title: 'Faturamento',
    body: 'Valor gerado pelas vendas e recursos da empresa.',
  },
  {
    title: 'Despesas e manutenção',
    body: 'Custos cobrados para manter vendedores, gestores, sistemas e recursos.',
  },
  {
    title: 'Capacidade',
    body: 'Quantidade de clientes que a equipe consegue atender.',
  },
  {
    title: 'Empréstimos',
    body: 'Recurso de recuperação financeira que aumenta o caixa, mas gera obrigações.',
  },
  {
    title: 'Turnos',
    body: 'Cada jogador lança o dado, se movimenta, resolve a casa e passa a vez.',
  },
]

/**
 * Modal educacional da tela inicial.
 * Controle 100% local (não usa ModalProvider / pushModal).
 */
export default function HowToPlayModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <ModalBase onClose={onClose} zIndex={4000}>
      <div className="howToPlay">
        <div className="howToPlayHeader">
          <h2 className="howToPlayTitle">Como jogar</h2>
          <button
            type="button"
            className="howToPlayCloseX"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="howToPlayBody">
          {SECTIONS.map((section) => (
            <div key={section.title} className="howToPlaySection">
              <h3 className="howToPlaySectionTitle">{section.title}</h3>
              <p className="howToPlaySectionBody">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="howToPlayActions">
          <button type="button" className="howToPlayCloseBtn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
