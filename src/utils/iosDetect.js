/**
 * Detecta iPhone / iPad / iPod (inclui Chrome/Firefox no iOS — todos usam WebKit).
 * NÃO marca Android nem desktop. Usado só para layout/viewport iOS.
 */
export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = String(navigator.userAgent || '')
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  // iPadOS 13+: reporta-se como MacIntel com touch
  const platform = String(navigator.platform || '')
  if (platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1) {
    return true
  }
  return false
}
