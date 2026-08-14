import test from 'node:test'
import assert from 'node:assert/strict'

import { PREFERRED_LOCK } from '../../../utils/screenOrientation.js'

test('orientação preferida no mobile é landscape (não portrait)', () => {
  assert.equal(PREFERRED_LOCK, 'landscape')
})

test('guard de orientação só deve atuar com enabled (tabuleiro)', () => {
  // Contrato: enabled=false → sem bloqueio (nome/lobby); enabled=true → landscape no jogo.
  const shouldBlock = (enabled, enforceDevice, isPortrait) => (
    Boolean(enabled) && Boolean(enforceDevice) && Boolean(isPortrait)
  )
  assert.equal(shouldBlock(false, true, true), false)
  assert.equal(shouldBlock(true, true, true), true)
  assert.equal(shouldBlock(true, true, false), false)
  assert.equal(shouldBlock(true, false, true), false)
})
