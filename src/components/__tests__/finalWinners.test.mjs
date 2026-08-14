/**
 * Contrato da tela de pódio final.
 * Executar: node --test src/components/__tests__/finalWinners.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const final = readFileSync(join(root, 'src/components/FinalWinners.jsx'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')

test('FinalWinners usa ranking por patrimônio e layout responsivo', () => {
  assert.match(final, /rankPlayersByPatrimonio/)
  assert.match(final, /Caixa \+ Bens/)
  assert.match(final, /finalWinnersPodium/)
  assert.match(final, /Voltar aos Lobbies/)
  assert.match(css, /\.finalWinners\s*\{/)
  assert.match(css, /finalMedalCol--first/)
  assert.match(css, /orientation:\s*landscape/)
  assert.match(app, /gameOver && \(/)
  assert.match(app, /<FinalWinners/)
})
