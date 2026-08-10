import React, { useEffect, useState } from 'react'
import ModalBase from '../modals/ModalBase'

export const TUTORIAL_STORAGE_KEY = 'salesgame_tutorial_seen_v1'

const STEPS = [
  {
    title: 'Objetivo',
    body: [
      'No SalesGame, você administra a empresa e toma decisões comerciais ao longo da partida.',
      'O vencedor é quem terminar com o maior PATRIMÔNIO.',
      'Patrimônio = Caixa + Bens.',
      'Em empate de patrimônio, desempata quem tiver maior caixa; se ainda empatar, o desempate é pelo nome.',
    ],
  },
  {
    title: 'Rodadas',
    body: [
      'A duração da partida é configurada pelo host antes do início, entre 1 e 5 rodadas (o padrão é 5).',
      'A partida termina após o número de rodadas configurado pelo host para aquela sala.',
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
      'Ao fim das rodadas configuradas pelo host, vence quem tiver o maior patrimônio (Caixa + Bens).',
      'Em empate de patrimônio, prevalece quem tiver mais caixa. A partida também pode terminar se restar apenas um jogador ativo.',
    ],
  },
]

/** Glossário curto (1–2 frases) — ajuda contextual, sem alterar regras. */
export const TUTORIAL_GLOSSARY = [
  {
    title: 'Caixa',
    body: 'Dinheiro disponível para compras, despesas e decisões. Aparece no placar como saldo.',
  },
  {
    title: 'Patrimônio',
    body: 'Caixa + Bens. É o critério de vitória no fim da partida.',
  },
  {
    title: 'Faturamento',
    body: 'Valor gerado pelas vendas e recursos da empresa a cada ciclo.',
  },
  {
    title: 'Manutenção',
    body: 'Custos periódicos para manter vendedores, gestores, sistemas e outros recursos.',
  },
  {
    title: 'Capacidade',
    body: 'Quantidade de clientes que a equipe consegue atender ao mesmo tempo.',
  },
  {
    title: 'Clientes',
    body: 'Base atendida pela equipe. Sem capacidade suficiente, o excesso pode ser perdido no faturamento do mês.',
  },
  {
    title: 'ERP',
    body: 'Sistemas da empresa. Níveis melhores elevam faturamento e despesas conforme o tamanho da equipe.',
  },
  {
    title: 'Vendedor Comum',
    body: 'Colaborador de linha. Aumenta capacidade e contribui com faturamento e despesas.',
  },
  {
    title: 'Field Sales',
    body: 'Vendedor externo com maior capacidade por pessoa e impacto operacional próprio.',
  },
  {
    title: 'Inside Sales',
    body: 'Vendedor interno; costuma atender mais clientes por pessoa com perfil de custo diferente do Field.',
  },
  {
    title: 'Gestor',
    body: 'Gestor comercial. Não aumenta capacidade; com certificado, impulsiona o time.',
  },
  {
    title: 'Certificados',
    body: 'Treinamentos (cores) que alteram faturamento e despesas dos vendedores ou habilitam o boost do gestor.',
  },
  {
    title: 'Empréstimo',
    body: 'Opção da recuperação financeira: aumenta o caixa agora e gera obrigação futura nas despesas.',
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
 * Tutorial inicial em etapas + glossário opcional.
 * Isolado do ModalProvider / engine — não altera regras do jogo.
 */
export default function TutorialModal({ open, onClose }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [showGlossary, setShowGlossary] = useState(false)
  const total = STEPS.length
  const step = STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  useEffect(() => {
    if (open) {
      setStepIndex(0)
      setShowGlossary(false)
    }
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
            {!showGlossary && (
              <span className="tutorialStepLabel" aria-live="polite">
                {stepIndex + 1} de {total}
              </span>
            )}
            {showGlossary && (
              <span className="tutorialStepLabel" aria-live="polite">
                Glossário
              </span>
            )}
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
          {showGlossary ? (
            <>
              <h3 className="tutorialStepTitle">Conceitos rápidos</h3>
              <p className="tutorialStepBody">
                Referência curta. Não muda regras — só explica os termos da partida.
              </p>
              {TUTORIAL_GLOSSARY.map((item) => (
                <div key={item.title} className="tutorialGlossaryItem">
                  <h4 className="tutorialGlossaryTitle">{item.title}</h4>
                  <p className="tutorialGlossaryBody">{item.body}</p>
                </div>
              ))}
            </>
          ) : (
            <>
              <h3 className="tutorialStepTitle">{step.title}</h3>
              {step.body.map((paragraph) => (
                <p key={paragraph} className="tutorialStepBody">
                  {paragraph}
                </p>
              ))}
            </>
          )}
        </div>

        <div className="tutorialActions">
          {showGlossary ? (
            <button
              type="button"
              className="tutorialBtnSecondary"
              onClick={() => setShowGlossary(false)}
            >
              Voltar às etapas
            </button>
          ) : (
            <>
              <button
                type="button"
                className="tutorialBtnSecondary"
                onClick={goPrev}
                disabled={isFirst}
              >
                Anterior
              </button>
              <button
                type="button"
                className="tutorialBtnGhost"
                onClick={() => setShowGlossary(true)}
              >
                Glossário
              </button>
              <button type="button" className="tutorialBtnPrimary" onClick={goNext}>
                {isLast ? 'Começar a jogar' : 'Próximo'}
              </button>
            </>
          )}
          {showGlossary && (
            <button type="button" className="tutorialBtnPrimary" onClick={handleClose}>
              Começar a jogar
            </button>
          )}
        </div>
      </div>
    </ModalBase>
  )
}
