/**
 * Patrimônio (UI/ranking) — mesma regra do pódio final.
 * Executar: node --test src/game/__tests__/patrimonio.test.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computePatrimonio } from '../patrimonio.js'

describe('computePatrimonio', () => {
  it('caixa + bens', () => {
    assert.equal(computePatrimonio({ cash: 1000, bens: 400 }), 1400)
  })

  it('falido = 0', () => {
    assert.equal(computePatrimonio({ cash: 5000, bens: 2000, bankrupt: true }), 0)
  })

  it('valores ausentes viram 0', () => {
    assert.equal(computePatrimonio({}), 0)
    assert.equal(computePatrimonio({ cash: 100 }), 100)
  })
})
