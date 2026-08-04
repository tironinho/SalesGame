import React, { useEffect, useState } from 'react'
import ModalBase from '../modals/ModalBase'

export const TUTORIAL_STORAGE_KEY = 'salesgame_tutorial_seen_v1'

const STEPS = [
  {
    title: 'Objetivo',
    body: [
      'No SalesGame, você administra a empresa e toma decisões comerciais ao longo da partida.',
      'O objetivo é terminar com o maior patrimônio. Patrimônio é a soma do caixa com os bens.',
    ],
  },
  {
    title: 'Rodadas',
    body: [
      'A duração da partida é configurada pelo host antes do início, entre 1 e 5 rodadas (o padrão é 5).',
      'A partida termina após a quantidade de rodadas definida para aquela sala.',
    ],
  },
  {
    title: 'Seu turno',
    body: [
      'Na sua vez, use “Rolar Dado & Andar” para lançar o dado e movimentar o jogador pelo tabuleiro.',
      'Em seguida, resolva o que a casa pedir e aguarde o próximo participante — cada jogador joga na sua vez.',
    ],
  },
  {
    title: 'Gestão da empresa',
    body: [
      'Acompanhe o caixa (saldo disponível), o faturamento gerado pelas vendas e recursos, e as despesas de manutenção da operação.',
      'A capacidade indica quantos clientes a equipe consegue atender. Empréstimos entram pela recuperação financeira e aumentam o caixa, gerando obrigações.',
    ],
  },
  {
    title: 'Final da partida',
    body: [
      'Ao fim da duração configurada, vence quem tiver o maior patrimônio (Saldo + Bens).',
      'Em caso de empate no patrimônio, prevalece quem tiver mais saldo; se ainda empatar, o desempate é pelo nome. A partida também pode terminar se restar apenas um jogador ativo.',
    ],
  },
]

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Tutorial inicial em etapas.
 * Isolado do ModalProvider / engine — não altera regras do jogo.
 */
export default function TutorialModal({ open, onClose }) {
  const [stepIndex, setStepIndex] = useState(0)
  const total = STEPS.length
  const step = STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  useEffect(() => {
    if (open) setStepIndex(0)
  }, [open])

  function handleClose() {
    markTutorialSeen()
    onClose?.()
  }

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        markTutorialSeen()
        onClose?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function goNext() {
    if (isLast) {
      handleClose()
      return
    }
    setStepIndex((i) => Math.min(total - 1, i + 1))
  }

  if (!open || !step) return null

  return (
    <ModalBase onClose={handleClose} zIndex={4000}>
      <div className="tutorialModal">
        <div className="tutorialHeader">
          <div className="tutorialHeaderText">
            <h2 className="tutorialTitle">Como jogar</h2>
            <span className="tutorialStepLabel" aria-live="polite">
              {stepIndex + 1} de {total}
            </span>
          </div>
          <button
            type="button"
            className="tutorialCloseX"
            onClick={handleClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="tutorialBody">
          <h3 className="tutorialStepTitle">{step.title}</h3>
          {step.body.map((paragraph) => (
            <p key={paragraph} className="tutorialStepBody">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="tutorialActions">
          <button
            type="button"
            className="tutorialBtnSecondary"
            onClick={goPrev}
            disabled={isFirst}
          >
            Anterior
          </button>
          <button type="button" className="tutorialBtnPrimary" onClick={goNext}>
            {isLast ? 'Começar a jogar' : 'Próximo'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
