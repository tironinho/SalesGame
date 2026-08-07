// src/components/MobilePortraitGuard.jsx
// Overlay temporário: mobile landscape pede portrait.
// Visibilidade só via CSS — o jogo por baixo permanece montado.

import { useEffect } from 'react'

const GUARD_MQ = '(max-width: 960px) and (orientation: landscape) and (pointer: coarse)'

function blurActiveField () {
  const el = document.activeElement
  if (!el) return
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    el.blur()
  }
}

export default function MobilePortraitGuard () {
  // Ao entrar no landscape (guard visível), blur 1x se um campo estiver focado
  // — Safari pode manter zoom criado pelo foco ao girar.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia(GUARD_MQ)

    const onChange = () => {
      if (mq.matches) blurActiveField()
    }

    onChange()
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    mq.addListener(onChange)
    return () => mq.removeListener(onChange)
  }, [])

  return (
    <div
      className="mobilePortraitGuard"
      role="dialog"
      aria-modal="true"
      aria-label="Gire o celular para a posição vertical"
    >
      <div className="mobilePortraitGuardInner">
        <p className="mobilePortraitGuardTitle">
          <span className="mobilePortraitGuardIcon" aria-hidden="true">📱</span>
          {' '}Gire o celular
        </p>
        <p className="mobilePortraitGuardText">
          Para jogar o Sales Game, use o celular na posição vertical.
        </p>
        <div className="mobilePortraitGuardHint" aria-hidden="true">↻</div>
      </div>
    </div>
  )
}
