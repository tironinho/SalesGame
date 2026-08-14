/**
 * Orientação preferida no browser (web Vite + React DOM).
 * Sem Expo / React Native. Preferência: landscape no mobile.
 * Em muitos browsers (esp. iOS Safari) lock() falha sem gesture + fullscreen;
 * o OrientationGuard cobre com overlay visual.
 */

export const PREFERRED_LOCK = 'landscape'

export function canLockOrientation() {
  if (typeof window === 'undefined') return false
  const orientation = window.screen?.orientation
  if (orientation && typeof orientation.lock === 'function') return true
  const legacy = window.screen
  if (legacy && typeof legacy.lockOrientation === 'function') return true
  if (legacy && typeof legacy.mozLockOrientation === 'function') return true
  return false
}

/**
 * Tenta travar landscape via Screen Orientation API.
 * @returns {Promise<{ ok: boolean, method?: string, reason?: string }>}
 */
export async function lockPreferredLandscape() {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'no-window' }
  }

  const orientation = window.screen?.orientation
  if (orientation && typeof orientation.lock === 'function') {
    try {
      await orientation.lock('landscape')
      return { ok: true, method: 'screen.orientation.lock(landscape)' }
    } catch {
      try {
        await orientation.lock('landscape-primary')
        return { ok: true, method: 'screen.orientation.lock(landscape-primary)' }
      } catch (e2) {
        return {
          ok: false,
          reason: e2?.name || e2?.message || 'lock-rejected',
        }
      }
    }
  }

  try {
    const legacy = window.screen
    if (legacy && typeof legacy.lockOrientation === 'function') {
      const locked = legacy.lockOrientation('landscape')
      if (locked) return { ok: true, method: 'screen.lockOrientation' }
    }
    if (legacy && typeof legacy.mozLockOrientation === 'function') {
      const locked = legacy.mozLockOrientation('landscape')
      if (locked) return { ok: true, method: 'screen.mozLockOrientation' }
    }
  } catch {
    // ignore
  }

  return { ok: false, reason: 'unsupported' }
}

/** @deprecated Use lockPreferredLandscape — mantido só para imports legados. */
export async function lockPreferredPortrait() {
  return lockPreferredLandscape()
}

export async function unlockOrientation() {
  try {
    const orientation = typeof window !== 'undefined'
      ? window.screen?.orientation
      : null
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock()
      return { ok: true }
    }
  } catch {
    // ignore
  }
  return { ok: false }
}

/**
 * Lê orientação atual. Prioriza matchMedia; fallback width/height.
 * @returns {'portrait' | 'landscape'}
 */
export function readOrientation() {
  if (typeof window === 'undefined') return 'landscape'

  try {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(orientation: portrait)').matches) return 'portrait'
      if (window.matchMedia('(orientation: landscape)').matches) return 'landscape'
    }
  } catch {
    // ignore
  }

  const type = window.screen?.orientation?.type
  if (typeof type === 'string') {
    if (type.startsWith('portrait')) return 'portrait'
    if (type.startsWith('landscape')) return 'landscape'
  }

  return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape'
}

/**
 * Mobile/tablet onde faz sentido exigir landscape.
 * Evita bloquear desktop com janela estreita (pointer fine).
 */
export function shouldEnforceLandscape() {
  if (typeof window === 'undefined') return false
  try {
    const coarse = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches
    const narrow = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 960px)').matches
      : window.innerWidth <= 960
    return Boolean(coarse && narrow)
  } catch {
    return false
  }
}
