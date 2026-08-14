import { useCallback, useEffect, useState } from 'react'

import {
  canFullscreen,
  exitAppFullscreen,
  isFullscreenActive,
  requestAppFullscreen,
} from '../utils/fullscreen.js'

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => isFullscreenActive())

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const update = () => setIsFullscreen(isFullscreenActive())

    document.addEventListener('fullscreenchange', update)
    document.addEventListener('webkitfullscreenchange', update)
    document.addEventListener('MSFullscreenChange', update)

    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('webkitfullscreenchange', update)
      document.removeEventListener('MSFullscreenChange', update)
    }
  }, [])

  const enterFullscreen = useCallback(async () => {
    const ok = await requestAppFullscreen()
    setIsFullscreen(isFullscreenActive())
    return ok
  }, [])

  const exitFullscreen = useCallback(async () => {
    const ok = await exitAppFullscreen()
    setIsFullscreen(isFullscreenActive())
    return ok
  }, [])

  return {
    isFullscreen,
    canFullscreen: canFullscreen(),
    enterFullscreen,
    exitFullscreen,
  }
}
