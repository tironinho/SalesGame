/**
 * Patrimônio (UI/ranking) — mesma regra do pódio final.
 * Executar: node --test src/game/__tests__/patrimonio.test.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePatrimonio,
  rankPlayersByPatrimonio,
  pickWinnerByPatrimonio,
} from '../patrimonio.js'

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

describe('rankPlayersByPatrimonio / pickWinnerByPatrimonio', () => {
  it('vence quem tem maior patrimônio; desempate por caixa e nome', () => {
    const ranked = rankPlayersByPatrimonio([
      { id: 'a', name: 'Ana', cash: 5000, bens: 5000 }, // 10k, caixa 5k
      { id: 'b', name: 'Bruno', cash: 8000, bens: 2000 }, // 10k, caixa 8k → 1º
      { id: 'c', name: 'Carla', cash: 1000, bens: 9000 }, // 10k, caixa 1k
    ])
    assert.equal(ranked[0].name, 'Bruno')
    assert.equal(ranked[1].name, 'Ana')
    assert.equal(ranked[2].name, 'Carla')
    assert.equal(pickWinnerByPatrimonio(ranked).name, 'Bruno')
  })

  it('falidos ficam depois dos ativos', () => {
    const ranked = rankPlayersByPatrimonio([
      { id: 'a', name: 'FalidoRico', cash: 99999, bens: 99999, bankrupt: true },
      { id: 'b', name: 'Vivo', cash: 100, bens: 50 },
    ])
    assert.equal(ranked[0].name, 'Vivo')
    assert.equal(ranked[1].isBankrupt, true)
    assert.equal(pickWinnerByPatrimonio(ranked).name, 'Vivo')
  })

  it('ninguém vivo => sem campeão', () => {
    assert.equal(
      pickWinnerByPatrimonio([{ id: 'a', name: 'X', cash: 10, bens: 10, bankrupt: true }]),
      null,
    )
  })

  it('reordena 1º/2º/3º/4º quando caixa e bens mudam no andamento', () => {
    const start = rankPlayersByPatrimonio([
      { id: 'a', name: 'Ana', cash: 18000, bens: 4000 },
      { id: 'b', name: 'Bruno', cash: 18000, bens: 4000 },
      { id: 'c', name: 'Carla', cash: 18000, bens: 4000 },
      { id: 'd', name: 'Diego', cash: 18000, bens: 4000 },
    ])
    assert.deepEqual(start.map((p) => p.name), ['Ana', 'Bruno', 'Carla', 'Diego'])

    const later = rankPlayersByPatrimonio([
      { id: 'a', name: 'Ana', cash: 9000, bens: 4000 },
      { id: 'b', name: 'Bruno', cash: 5000, bens: 12000 },
      { id: 'c', name: 'Carla', cash: 22000, bens: 2000 },
      { id: 'd', name: 'Diego', cash: 1000, bens: 1000 },
    ])
    assert.deepEqual(later.map((p) => p.name), ['Carla', 'Bruno', 'Ana', 'Diego'])
    assert.equal(later[0].patrimonio, 24000)
    assert.equal(later[1].patrimonio, 17000)
  })
})
