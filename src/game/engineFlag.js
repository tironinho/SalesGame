/**
 * Feature flag do ENGINE_V2.
 * Padrão: desligado. Shadow mode: observa reduceGame sem substituir o fluxo legado.
 *
 * Ativar observação:
 *   localStorage.setItem('SG_ENGINE_V2', '1')
 * ou VITE_ENGINE_V2=1
 *
 * Cutover completo (ainda incompleto — NÃO use em produção):
 *   localStorage.setItem('SG_ENGINE_V2_CUTOVER', '1')
 */

export function isEngineV2Enabled() {
  try {
    if (String(import.meta.env?.VITE_ENGINE_V2 || '') === '1') return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem('SG_ENGINE_V2') === '1') {
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * Cutover real ainda não está pronto (effects/modais incompletos).
 * Só permite cutover se explicitamente pedido E shadow não forçado.
 */
export function isEngineV2CutoverEnabled() {
  if (!isEngineV2Enabled()) return false
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem('SG_ENGINE_V2_CUTOVER') === '1'
  } catch {
    return false
  }
}

/** Shadow = roda reduceGame só para log/comparação; jogabilidade continua no legado. */
export function shouldRunEngineV2Shadow() {
  return isEngineV2Enabled() && !isEngineV2CutoverEnabled()
}
