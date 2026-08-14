import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TOUR_STEPS,
  TOUR_TILES,
  TOUR_HUD,
  TOUR_RECOVERY,
  TOUR_WELCOME,
} from '../tutorialContent.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const modal = readFileSync(join(root, 'src/components/TutorialModal.jsx'), 'utf8')

test('tour tem etapas de vitória, casas, HUD, recuperação e falência', () => {
  assert.match(TOUR_WELCOME.title, /Sales Game/i)
  const ids = TOUR_STEPS.map((s) => s.id)
  assert.ok(ids.includes('objetivo'))
  assert.ok(ids.includes('casas'))
  assert.ok(ids.includes('hud'))
  assert.ok(ids.includes('recuperacao'))
  assert.ok(ids.includes('falencia'))
  assert.ok(ids.includes('pronto'))

  const objetivo = TOUR_STEPS.find((s) => s.id === 'objetivo')
  assert.match(objetivo.body.join(' '), /Patrimônio\s*=\s*Caixa\s*\+\s*Bens/i)
  assert.match(objetivo.highlight, /Caixa\s*\+\s*Bens/i)

  assert.ok(TOUR_TILES.length >= 10)
  assert.ok(TOUR_TILES.some((t) => t.key === 'LUCK'))
  assert.ok(TOUR_TILES.some((t) => t.key === 'REVENUE'))
  assert.ok(TOUR_HUD.some((h) => /Placar/i.test(h.title)))
  assert.ok(TOUR_RECOVERY.some((r) => /Empréstimo/i.test(r.title)))
  assert.ok(TOUR_RECOVERY.some((r) => /falência/i.test(r.title)))
})

test('TutorialModal oferece pular ou seguir o tour', () => {
  assert.match(modal, /Pular tutorial/)
  assert.match(modal, /Seguir o tour/)
  assert.match(modal, /phase === 'welcome'/)
  assert.match(modal, /interactive === 'tiles'/)
  assert.match(modal, /interactive === 'hud'/)
  assert.match(modal, /interactive === 'recovery'/)
})
