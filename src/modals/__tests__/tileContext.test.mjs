import test from 'node:test'
import assert from 'node:assert/strict'

import { TILE_CONTEXT, TILE_HINTS, getTileContext, getTileHint } from '../tileContext.js'

test('tile context cobre as casas de compra e passagem', () => {
  const required = [
    'CLIENTS', 'COMMON', 'FIELD', 'INSIDE', 'MANAGER',
    'ERP', 'MIX', 'TRAINING', 'DIRECT_BUY', 'LUCK',
    'REVENUE', 'EXPENSES',
  ]
  for (const key of required) {
    assert.ok(TILE_CONTEXT[key], `falta contexto para ${key}`)
    assert.equal(getTileContext(key), TILE_CONTEXT[key])
    assert.ok(String(TILE_CONTEXT[key]).length > 20)
  }
  assert.equal(getTileContext('unknown'), '')
  assert.equal(getTileContext('clients'), TILE_CONTEXT.CLIENTS)
})

test('tile hints são curtos e cobrem todos os tipos do tabuleiro', () => {
  const required = [
    'CLIENTS', 'COMMON', 'FIELD', 'INSIDE', 'MANAGER',
    'ERP', 'MIX', 'TRAINING', 'DIRECT_BUY', 'LUCK',
    'REVENUE', 'EXPENSES',
  ]
  for (const key of required) {
    const hint = getTileHint(key)
    assert.ok(hint, `falta hint para ${key}`)
    assert.equal(hint, TILE_HINTS[key])
    assert.ok(hint.length >= 40, `${key} hint curto demais para explicar a função`)
    assert.ok(hint.length <= 160, `${key} hint longo demais: ${hint.length}`)
  }
  assert.equal(getTileHint('START_REVENUE'), TILE_HINTS.REVENUE)
  assert.equal(getTileHint('unknown'), '')
})
