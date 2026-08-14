/** Persistência entre sessões (histórico local). */
export const TUTORIAL_STORAGE_KEY = 'salesgame_tutorial_seen_v3'
/**
 * Auto-open do tour ao entrar no tabuleiro (1× por partida nesta aba).
 * v3: chave por match/lobby — fechar o tour na StartScreen NÃO bloqueia o tabuleiro.
 * (v2 era global na aba e marcava também no StartScreen via markTutorialSeen.)
 */
export const TUTORIAL_SESSION_KEY = 'salesgame_tutorial_game_session_v3'
/** @deprecated legado */
export const TUTORIAL_START_SESSION_KEY = 'salesgame_tutorial_session_shown_v3'

function sessionSlotKey(matchKey = '') {
  const id = String(matchKey || '').trim()
  return id ? `${TUTORIAL_SESSION_KEY}:${id}` : TUTORIAL_SESSION_KEY
}

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Já mostrou/fechou o auto-open do tour nesta aba para esta partida. */
export function hasShownTutorialThisSession(matchKey = '') {
  try {
    return sessionStorage.getItem(sessionSlotKey(matchKey)) === '1'
  } catch {
    return false
  }
}

/**
 * Auto-open ao entrar no tabuleiro (phase === 'game'): uma vez por partida/aba.
 * A sessão só é marcada ao fechar/pular o tour do TABULEIRO (não na StartScreen).
 */
export function shouldAutoOpenTutorial(matchKey = '') {
  return !hasShownTutorialThisSession(matchKey)
}

/** Marca só a sessão desta partida (evita reabrir o auto-open na mesma partida). */
export function markTutorialSessionShown(matchKey = '') {
  try {
    sessionStorage.setItem(sessionSlotKey(matchKey), '1')
  } catch {
    // ignore
  }
}

/**
 * @param {{ markSession?: boolean, matchKey?: string }} [options]
 * markSession=false → só localStorage (ex.: StartScreen).
 * markSession=true (padrão no tabuleiro) → também marca a sessão da partida.
 */
export function markTutorialSeen(options = {}) {
  const { markSession = true, matchKey = '' } = options
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
  if (markSession) {
    markTutorialSessionShown(matchKey)
  }
}
