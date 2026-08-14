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

test('crédito Tironi Tech só na tela de entrada', () => {
  assert.match(credit, /https:\/\/tironitech\.com\//)
  assert.match(credit, /Desenvolvido por/)
  assert.match(credit, /Tironi Tech/)
  assert.match(credit, /noopener noreferrer/)
  assert.match(start, /TironiCredit/)
  // Tabuleiro / lobbies: sem crédito (evita sobrepor o board)
  assert.doesNotMatch(app, /TironiCredit/)
  assert.doesNotMatch(lobby, /TironiCredit/)
  assert.match(app, /shouldAutoOpenTutorial/)
  const modal = readFileSync(join(root, 'src/components/TutorialModal.jsx'), 'utf8')
  assert.match(modal, /markTutorialSessionShown|markTutorialSeen/)
})
