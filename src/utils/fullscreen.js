/**
 * Fullscreen helpers (browser). Sem Expo.
 * Só chamar após gesto do usuário (click / touch).
 */

function getFullscreenElement() {
  if (typeof document === 'undefined') return null
  return (
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement
    || null
  )
}

export function canFullscreen() {
  if (typeof document === 'undefined') return false
  const el = document.documentElement
  return Boolean(
    el
    && (
      typeof el.requestFullscreen === 'function'
      || typeof el.webkitRequestFullscreen === 'function'
      || typeof el.msRequestFullscreen === 'function'
    ),
  )
}

export function isFullscreenActive() {
  return Boolean(getFullscreenElement())
}

export async function requestAppFullscreen(target) {
  if (typeof document === 'undefined') return false
  const element = target || document.documentElement
  if (!element) return false

  try {
    if (typeof element.requestFullscreen === 'function') {
      try {
        await element.requestFullscreen({ navigationUI: 'hide' })
      } catch {
        await element.requestFullscreen()
      }
      return true
    }
    if (typeof element.webkitRequestFullscreen === 'function') {
      element.webkitRequestFullscreen()
      return true
    }
    if (typeof element.msRequestFullscreen === 'function') {
      element.msRequestFullscreen()
      return true
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[Fullscreen] request refused:', error?.name || error)
    }
  }
  return false
}

export async function exitAppFullscreen() {
  if (typeof document === 'undefined') return false
  try {
    if (typeof document.exitFullscreen === 'function' && getFullscreenElement()) {
      await document.exitFullscreen()
      return true
    }
    if (typeof document.webkitExitFullscreen === 'function' && getFullscreenElement()) {
      document.webkitExitFullscreen()
      return true
    }
    if (typeof document.msExitFullscreen === 'function' && getFullscreenElement()) {
      document.msExitFullscreen()
      return true
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[Fullscreen] exit refused:', error?.name || error)
    }
  }
  return false
}

/**
 * Melhor esforço: fullscreen + lock landscape.
 * Falhas nunca devem quebrar o fluxo do jogo.
 */
export async function enterGamePresentation() {
  const fullscreenOk = await requestAppFullscreen()
  const { lockPreferredLandscape } = await import('./screenOrientation.js')
  const lockResult = await lockPreferredLandscape()
  return {
    fullscreenOk,
    lockOk: Boolean(lockResult?.ok),
    lockMethod: lockResult?.method,
    lockReason: lockResult?.reason,
  }
}
