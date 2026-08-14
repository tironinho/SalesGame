import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const credit = readFileSync(join(root, 'src/components/TironiCredit.jsx'), 'utf8')
const start = readFileSync(join(root, 'src/components/StartScreen.jsx'), 'utf8')
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const lobby = readFileSync(join(root, 'src/pages/LobbyList.jsx'), 'utf8')

test('crédito Tironi Tech aponta para o site oficial', () => {
  assert.match(credit, /https:\/\/tironitech\.com\//)
  assert.match(credit, /Desenvolvido por/)
  assert.match(credit, /Tironi Tech/)
  assert.match(credit, /noopener noreferrer/)
  assert.match(start, /TironiCredit/)
  assert.match(app, /shouldAutoOpenTutorial/)
  assert.match(app, /markTutorialSessionShown/)
  assert.match(app, /TironiCredit/)
  assert.match(lobby, /TironiCredit/)
})

test('crédito Tironi no tabuleiro usa rodapé flutuante (não some fora da viewport)', () => {
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
  assert.match(css, /\.foot\s*\{[^}]*position:\s*fixed/s)
  assert.doesNotMatch(css, /\.foot\s*\{\s*display:\s*none/s)
})
