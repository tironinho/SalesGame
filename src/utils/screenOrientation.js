/**
 * Orientação preferida no browser (web).
 * Não usa Expo — este projeto é Vite + React DOM.
 * Em muitos mobile browsers (esp. iOS Safari) lock() falha sem gesture;
 * o MobilePortraitGuard continua como fallback visual.
 */

export const PREFERRED_LOCK = 'portrait'

/**
 * Tenta travar portrait via Screen Orientation API.
 * @returns {Promise<{ ok: boolean, method?: string, reason?: string }>}
 */
export async function lockPreferredPortrait() {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'no-window' }
  }

  const orientation = window.screen?.orientation
  if (orientation && typeof orientation.lock === 'function') {
    try {
      await orientation.lock('portrait')
      return { ok: true, method: 'screen.orientation.lock(portrait)' }
    } catch {
      try {
        await orientation.lock('portrait-primary')
        return { ok: true, method: 'screen.orientation.lock(portrait-primary)' }
      } catch (e2) {
        return {
          ok: false,
          reason: e2?.name || e2?.message || 'lock-rejected',
        }
      }
    }
  }

  // Legacy (alguns Android WebViews)
  try {
    const legacy = window.screen
    if (legacy && typeof legacy.lockOrientation === 'function') {
      const locked = legacy.lockOrientation('portrait')
      if (locked) return { ok: true, method: 'screen.lockOrientation' }
    }
    if (legacy && typeof legacy.mozLockOrientation === 'function') {
      const locked = legacy.mozLockOrientation('portrait')
      if (locked) return { ok: true, method: 'screen.mozLockOrientation' }
    }
  } catch {
    // ignore
  }

  return { ok: false, reason: 'unsupported' }
}

export async function unlockOrientation() {
  try {
    const orientation = window?.screen?.orientation
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock()
      return { ok: true }
    }
  } catch {
    // ignore
  }
  return { ok: false }
}
