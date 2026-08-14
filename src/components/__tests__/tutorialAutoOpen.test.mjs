import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_SESSION_KEY,
  shouldAutoOpenTutorial,
  hasShownTutorialThisSession,
  markTutorialSessionShown,
  markTutorialSeen,
} from '../tutorialStorage.js'

function installStorage() {
  const store = new Map()
  const session = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
  globalThis.sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => { session.set(k, String(v)) },
    removeItem: (k) => { session.delete(k) },
  }
  return { store, session }
}

test('tutorial auto-open: sessão limpa abre; após mark não reabre na mesma partida', () => {
  const { session } = installStorage()
  const match = 'lobby-abc'

  assert.equal(shouldAutoOpenTutorial(match), true)
  assert.equal(sessionStorage.getItem(`${TUTORIAL_SESSION_KEY}:${match}`), null)
  markTutorialSessionShown(match)
  assert.equal(sessionStorage.getItem(`${TUTORIAL_SESSION_KEY}:${match}`), '1')
  assert.equal(hasShownTutorialThisSession(match), true)
  assert.equal(shouldAutoOpenTutorial(match), false)
  assert.equal(localStorage.getItem(TUTORIAL_STORAGE_KEY), null)
  // Outra partida na mesma aba ainda pode abrir
  assert.equal(shouldAutoOpenTutorial('lobby-xyz'), true)

  session.clear()
  assert.equal(shouldAutoOpenTutorial(match), true)
  markTutorialSeen({ matchKey: match })
  assert.equal(localStorage.getItem(TUTORIAL_STORAGE_KEY), '1')
  assert.equal(shouldAutoOpenTutorial(match), false)

  // Nova sessão (session limpa) → abre de novo mesmo com localStorage marcado
  session.clear()
  assert.equal(shouldAutoOpenTutorial(match), true)
})

test('StartScreen não bloqueia auto-open do tabuleiro (markSession=false)', () => {
  installStorage()
  const match = 'lobby-board'
  assert.equal(shouldAutoOpenTutorial(match), true)
  markTutorialSeen({ markSession: false })
  assert.equal(localStorage.getItem(TUTORIAL_STORAGE_KEY), '1')
  assert.equal(shouldAutoOpenTutorial(match), true)
})
