/** Persistência entre sessões (histórico local). */
export const TUTORIAL_STORAGE_KEY = 'salesgame_tutorial_seen_v3'
/** Uma abertura automática por aba/sessão do browser. */
export const TUTORIAL_SESSION_KEY = 'salesgame_tutorial_session_shown_v3'

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Já mostrou o auto-open nesta aba/sessão (sobrevive a refresh). */
export function hasShownTutorialThisSession() {
  try {
    return sessionStorage.getItem(TUTORIAL_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Auto-open na StartScreen: uma vez por sessão de aba.
 * Ignora o “já vi em outro dia” do localStorage — o tutorial volta a aparecer
 * ao abrir uma nova aba/sessão. Fechar marca a sessão para não reabrir no refresh.
 */
export function shouldAutoOpenTutorial() {
  return !hasShownTutorialThisSession()
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
  try {
    sessionStorage.setItem(TUTORIAL_SESSION_KEY, '1')
  } catch {
    // ignore
  }
}
