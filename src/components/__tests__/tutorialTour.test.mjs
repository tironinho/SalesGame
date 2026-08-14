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
  TOUR_GLOSSARY,
} from '../tutorialContent.js'
import { VENDOR_RULES, ERP_RULES } from '../../game/gameRules.js'
import { MANUAL_CONSTANTS, MIX_PURCHASE_PRICES } from '../../game/manualConstants.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const modal = readFileSync(join(root, 'src/components/TutorialModal.jsx'), 'utf8')

test('tour tem etapas de vitória, casas, glossário, HUD, recuperação e falência', () => {
  assert.match(TOUR_WELCOME.title, /Sales Game/i)
  const ids = TOUR_STEPS.map((s) => s.id)
  assert.ok(ids.includes('objetivo'))
  assert.ok(ids.includes('casas'))
  assert.ok(ids.includes('glossario'))
  assert.ok(ids.includes('hud'))
  assert.ok(ids.includes('recuperacao'))
  assert.ok(ids.includes('falencia'))
  assert.ok(ids.includes('pronto'))

  const objetivo = TOUR_STEPS.find((s) => s.id === 'objetivo')
  assert.match(objetivo.body.join(' '), /Patrimônio\s*=\s*Caixa\s*\+\s*Bens/i)
  assert.match(objetivo.highlight, /Caixa\s*\+\s*Bens/i)

  const glossario = TOUR_STEPS.find((s) => s.id === 'glossario')
  assert.equal(glossario.interactive, 'glossary')

  assert.ok(TOUR_TILES.length >= 10)
  assert.ok(TOUR_TILES.some((t) => t.key === 'LUCK'))
  assert.ok(TOUR_TILES.some((t) => t.key === 'REVENUE'))
  assert.ok(TOUR_HUD.some((h) => /Placar/i.test(h.title)))
  assert.ok(TOUR_RECOVERY.some((r) => /Empréstimo/i.test(r.title)))
  assert.ok(TOUR_RECOVERY.some((r) => /falência/i.test(r.title)))
})

test('glossário inclui tabelas alinhadas ao motor (equipe, mix, erp, certs)', () => {
  assert.ok(TOUR_GLOSSARY.length >= 8)
  const ids = TOUR_GLOSSARY.map((s) => s.id)
  assert.ok(ids.includes('equipe'))
  assert.ok(ids.includes('mix'))
  assert.ok(ids.includes('erp'))
  assert.ok(ids.includes('certs'))
  assert.ok(ids.includes('faturamento'))
  assert.ok(ids.includes('despesas'))

  const equipe = TOUR_GLOSSARY.find((s) => s.id === 'equipe')
  const flat = equipe.rows.flat().join(' ')
  assert.match(flat, new RegExp(String(VENDOR_RULES.field.cap)))
  assert.match(flat, new RegExp(String(VENDOR_RULES.inside.cap)))
  assert.match(flat, /4\.000|4000/)

  const erp = TOUR_GLOSSARY.find((s) => s.id === 'erp')
  assert.ok(erp.rows.some((r) => r.includes(`$ ${ERP_RULES.A.price.toLocaleString('pt-BR')}`) || r.includes(String(ERP_RULES.A.price))))

  assert.equal(MIX_PURCHASE_PRICES.A, 12000)
  assert.equal(MANUAL_CONSTANTS.clientPrice, 1000)
})

test('casas do tour usam capacidade oficial do motor (não cartela antiga)', () => {
  const field = TOUR_TILES.find((t) => t.key === 'FIELD')
  const inside = TOUR_TILES.find((t) => t.key === 'INSIDE')
  assert.match(field.body, new RegExp(`Capacidade ${VENDOR_RULES.field.cap}`))
  assert.match(inside.body, new RegExp(`Capacidade ${VENDOR_RULES.inside.cap}`))
  assert.doesNotMatch(field.body, /até 5/)
})

test('TutorialModal permite pular, seguir e renderiza glossário', () => {
  assert.match(modal, /Pular tutorial/)
  assert.match(modal, /Seguir o tour/)
  assert.match(modal, /phase === 'welcome'/)
  assert.match(modal, /interactive === 'tiles'/)
  assert.match(modal, /interactive === 'glossary'/)
  assert.match(modal, /interactive === 'hud'/)
  assert.match(modal, /interactive === 'recovery'/)
  assert.match(modal, /TOUR_GLOSSARY/)
})

test('tour usa linguagem didática e detalhada', () => {
  assert.match(TOUR_WELCOME.body.join(' '), /lojinha|empresa|passo a passo|devagar/i)
  const objetivo = TOUR_STEPS.find((s) => s.id === 'objetivo')
  assert.match(objetivo.body.join(' '), /CAIXA|BENS|Patrimônio/i)
  const glossario = TOUR_GLOSSARY.find((s) => s.id === 'faturamento')
  assert.ok(glossario.bullets.some((b) => /1\)|passo/i.test(b)))
})
