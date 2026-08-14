/** Persistência entre sessões (histórico local). */
export const TUTORIAL_STORAGE_KEY = 'salesgame_tutorial_seen_v3'
/** Auto-open do tour ao entrar no tabuleiro (1× por aba/sessão). */
export const TUTORIAL_SESSION_KEY = 'salesgame_tutorial_game_session_v1'
/** @deprecated legado — StartScreen não auto-abre mais */
export const TUTORIAL_START_SESSION_KEY = 'salesgame_tutorial_session_shown_v3'

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Já mostrou o auto-open do tour nesta aba/sessão (ao entrar no tabuleiro). */
export function hasShownTutorialThisSession() {
  try {
    return sessionStorage.getItem(TUTORIAL_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Auto-open ao entrar no tabuleiro (phase === 'game'): uma vez por sessão de aba.
 * Fechar/pular marca a sessão para não reabrir no refresh.
 */
export function shouldAutoOpenTutorial() {
  return !hasShownTutorialThisSession()
}

/** Marca só a sessão (evita reabrir o auto-open no mesmo tabuleiro/sessão). */
export function markTutorialSessionShown() {
  try {
    sessionStorage.setItem(TUTORIAL_SESSION_KEY, '1')
  } catch {
    // ignore
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
  markTutorialSessionShown()
}
