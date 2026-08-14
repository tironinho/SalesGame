import test from 'node:test'
import assert from 'node:assert/strict'

import { TILE_CONTEXT, getTileContext } from '../tileContext.js'

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
