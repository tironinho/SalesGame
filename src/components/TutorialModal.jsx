import React, { useEffect, useState } from 'react'
import ModalBase from '../modals/ModalBase'
import {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_SESSION_KEY,
  hasSeenTutorial,
  hasShownTutorialThisSession,
  shouldAutoOpenTutorial,
  markTutorialSeen,
} from './tutorialStorage.js'
import {
  TOUR_WELCOME,
  TOUR_STEPS,
  TOUR_TILES,
  TOUR_HUD,
  TOUR_RECOVERY,
} from './tutorialContent.js'

export {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_SESSION_KEY,
  hasSeenTutorial,
  hasShownTutorialThisSession,
  shouldAutoOpenTutorial,
  markTutorialSeen,
}

export { TOUR_STEPS, TOUR_TILES, TOUR_HUD, TOUR_RECOVERY }

/**
 * Tour guiado interativo na entrada (e reabertura via “Como jogar”).
 * Isolado do ModalProvider / engine — não altera regras.
 */
export default function TutorialModal({ open, onClose }) {
  const [phase, setPhase] = useState('welcome') // 'welcome' | 'tour'
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedTile, setSelectedTile] = useState(TOUR_TILES[0]?.key || null)
  const total = TOUR_STEPS.length
  const step = TOUR_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  useEffect(() => {
    if (!open) return
    setPhase('welcome')
    setStepIndex(0)
    setSelectedTile(TOUR_TILES[0]?.key || null)
  }, [open])

  function handleClose() {
    markTutorialSeen()
    onClose?.()
  }

  function startTour() {
    setPhase('tour')
    setStepIndex(0)
  }

  function skipTour() {
    handleClose()
  }

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') handleClose()
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

  if (!open) return null

  const selectedTileData = TOUR_TILES.find((t) => t.key === selectedTile) || TOUR_TILES[0]

  return (
    <ModalBase onClose={handleClose} zIndex={4000}>
      <div className="tutorialModal tutorialModal--tour">
        <div className="tutorialHeader">
          <div className="tutorialHeaderText">
            <h2 className="tutorialTitle">
              {phase === 'welcome' ? 'Tour guiado' : 'Como jogar'}
            </h2>
            {phase === 'tour' && step && (
              <span className="tutorialStepLabel" aria-live="polite">
                {stepIndex + 1} de {total}
                {step.icon ? ` · ${step.icon}` : ''}
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

        {phase === 'tour' && (
          <div className="tutorialProgress" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`tutorialProgressDot${i === stepIndex ? ' is-active' : ''}${i < stepIndex ? ' is-done' : ''}`}
                title={s.title}
                onClick={() => setStepIndex(i)}
              />
            ))}
          </div>
        )}

        <div className="tutorialBody">
          {phase === 'welcome' ? (
            <>
              <h3 className="tutorialStepTitle">{TOUR_WELCOME.title}</h3>
              <p className="tutorialWelcomeKicker">{TOUR_WELCOME.subtitle}</p>
              {TOUR_WELCOME.body.map((paragraph) => (
                <p key={paragraph} className="tutorialStepBody">
                  {paragraph}
                </p>
              ))}
              <ul className="tutorialWelcomeList">
                <li>Objetivo e vitória (Caixa + Bens)</li>
                <li>Casas do tabuleiro</li>
                <li>HUD / placar</li>
                <li>Recuperação financeira e falência</li>
              </ul>
            </>
          ) : (
            step && (
              <>
                <h3 className="tutorialStepTitle">
                  {step.icon ? <span className="tutorialStepIcon">{step.icon}</span> : null}
                  {step.title}
                </h3>
                {step.body.map((paragraph) => (
                  <p key={paragraph} className="tutorialStepBody">
                    {paragraph}
                  </p>
                ))}
                {step.highlight && (
                  <p className="tutorialHighlight" role="note">
                    {step.highlight}
                  </p>
                )}

                {step.interactive === 'tiles' && (
                  <div className="tutorialInteractive">
                    <div className="tutorialChipGrid" role="list">
                      {TOUR_TILES.map((tile) => (
                        <button
                          key={tile.key}
                          type="button"
                          role="listitem"
                          className={`tutorialChip${selectedTile === tile.key ? ' is-selected' : ''}`}
                          onClick={() => setSelectedTile(tile.key)}
                        >
                          {tile.title}
                        </button>
                      ))}
                    </div>
                    {selectedTileData && (
                      <div className="tutorialChipDetail">
                        <strong>{selectedTileData.title}</strong>
                        <p>{selectedTileData.body}</p>
                      </div>
                    )}
                  </div>
                )}

                {step.interactive === 'hud' && (
                  <div className="tutorialCardGrid">
                    {TOUR_HUD.map((item) => (
                      <article key={item.title} className="tutorialInfoCard">
                        <h4>{item.title}</h4>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                )}

                {step.interactive === 'recovery' && (
                  <div className="tutorialCardGrid">
                    {TOUR_RECOVERY.map((item) => (
                      <article key={item.title} className="tutorialInfoCard tutorialInfoCard--accent">
                        <h4>{item.title}</h4>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>

        <div className="tutorialActions">
          {phase === 'welcome' ? (
            <>
              <button type="button" className="tutorialBtnGhost" onClick={skipTour}>
                Pular tutorial
              </button>
              <button type="button" className="tutorialBtnPrimary" onClick={startTour}>
                Seguir o tour
              </button>
            </>
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
              <button type="button" className="tutorialBtnGhost" onClick={skipTour}>
                Pular
              </button>
              <button type="button" className="tutorialBtnPrimary" onClick={goNext}>
                {isLast ? 'Começar a jogar' : 'Próximo'}
              </button>
            </>
          )}
        </div>
      </div>
    </ModalBase>
  )
}
