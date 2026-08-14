import { useEffect, useState } from 'react'

import { shouldEnforceLandscape } from '../utils/screenOrientation.js'

/**
 * Detecta se devemos exigir landscape (touch + viewport estreito).
 * Desktop com janela estreita (pointer fine) não é bloqueado.
 */
export function useDeviceType() {
  const [enforce, setEnforce] = useState(() => shouldEnforceLandscape())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const update = () => {
      setEnforce(shouldEnforceLandscape())
    }

    update()

    const coarse = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)')
      : null
    const narrow = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 960px)')
      : null

    const bind = (mq) => {
      if (!mq) return () => {}
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', update)
        return () => mq.removeEventListener('change', update)
      }
      if (typeof mq.addListener === 'function') {
        mq.addListener(update)
        return () => mq.removeListener(update)
      }
      return () => {}
    }

    const unbindCoarse = bind(coarse)
    const unbindNarrow = bind(narrow)
    window.addEventListener('resize', update)

    return () => {
      unbindCoarse()
      unbindNarrow()
      window.removeEventListener('resize', update)
    }
  }, [])

  return {
    isMobileOrTablet: enforce,
    shouldEnforceLandscape: enforce,
  }
}
