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

test('tutorial auto-open: sessão limpa abre; após mark não reabre na mesma sessão', () => {
  // jsdom/node sem storage real — polyfill mínimo
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

  assert.equal(shouldAutoOpenTutorial(), true)
  // Abrir NÃO marca sessão — só fechar/pular
  assert.equal(sessionStorage.getItem(TUTORIAL_SESSION_KEY), null)
  markTutorialSessionShown()
  assert.equal(sessionStorage.getItem(TUTORIAL_SESSION_KEY), '1')
  assert.equal(hasShownTutorialThisSession(), true)
  assert.equal(shouldAutoOpenTutorial(), false)
  assert.equal(localStorage.getItem(TUTORIAL_STORAGE_KEY), null)

  session.clear()
  assert.equal(shouldAutoOpenTutorial(), true)
  markTutorialSeen()
  assert.equal(localStorage.getItem(TUTORIAL_STORAGE_KEY), '1')
  assert.equal(shouldAutoOpenTutorial(), false)

  // Nova sessão (session limpa) → abre de novo mesmo com localStorage marcado
  session.clear()
  assert.equal(shouldAutoOpenTutorial(), true)
})
