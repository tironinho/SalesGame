import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizePlayerAliases,
  normalizePlayersAliases,
} from '../playerShape.js'

test('unifica gestores / gestoresComerciais / managers', () => {
  const a = normalizePlayerAliases({ id: '1', gestores: 2 })
  assert.equal(a.gestores, 2)
  assert.equal(a.gestoresComerciais, 2)
  assert.equal(a.managers, 2)

  const b = normalizePlayerAliases({ id: '2', managers: 3 })
  assert.equal(b.gestores, 3)
  assert.equal(b.gestoresComerciais, 3)
  assert.equal(b.managers, 3)
})

test('unifica trainingsByVendor / trainingByVendor', () => {
  const p = normalizePlayerAliases({
    id: '1',
    trainingByVendor: { comum: ['personalizado'] },
  })
  assert.deepEqual(p.trainingsByVendor, { comum: ['personalizado'] })
  assert.deepEqual(p.trainingByVendor, { comum: ['personalizado'] })
})

test('unifica erpOwned/erp e mixOwned/mix', () => {
  const p = normalizePlayerAliases({
    id: '1',
    erp: { A: true },
    mixOwned: { B: true },
  })
  assert.deepEqual(p.erpOwned, { A: true })
  assert.deepEqual(p.erp, { A: true })
  assert.deepEqual(p.mixOwned, { B: true })
  assert.deepEqual(p.mix, { B: true })
})

test('normalizePlayersAliases aplica em lista', () => {
  const list = normalizePlayersAliases([
    { id: 'a', gestoresComerciais: 1 },
    null,
  ])
  assert.equal(list.length, 2)
  assert.equal(list[0].gestores, 1)
  assert.equal(list[1], null)
})
