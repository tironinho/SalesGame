/**
 * Sidebar / HUD layout contract — resumo e ação principal visíveis.
 * Executar: node --test src/components/__tests__/sidebarLayout.test.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const hud = readFileSync(join(root, 'src/components/HUD.jsx'), 'utf8')
const controls = readFileSync(join(root, 'src/components/Controls.jsx'), 'utf8')

function firstBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`))
  return match ? match[0] : ''
}

function sideMarkup() {
  const start = app.indexOf('<aside className="side">')
  const end = app.indexOf('</aside>', start)
  return app.slice(start, end)
}

describe('sidebar player summary layout', () => {
  it('HUD continua renderizando o quadro de resumo (sem mudança de dados)', () => {
    assert.match(hud, /className="panel"/)
    assert.match(hud, /Faturamento/)
    assert.match(hud, /Manutenção/)
    assert.match(hud, /Capacidade/)
    assert.match(hud, /Em Atendimento/)
  })

  it('App mantém o HUD fora da região de scroll secundária', () => {
    const side = sideMarkup()
    const hudStart = side.indexOf('<HUD')
    const secondaryStart = side.indexOf('sideSecondary')
    assert.ok(hudStart >= 0)
    assert.ok(secondaryStart > hudStart)
  })

  it('região secundária envolve controles secundários, não o resumo nem o roll', () => {
    const side = sideMarkup()
    const secondaryStart = side.indexOf('sideSecondary')
    const primaryStart = side.indexOf('turnPrimaryActions')
    const secondary = side.slice(secondaryStart, primaryStart)
    assert.match(secondary, /controlsSticky/)
    assert.match(secondary, /section="secondary"/)
    assert.doesNotMatch(secondary, /section="primary"/)
    assert.doesNotMatch(secondary, /nextStepHint/)
    assert.ok(!secondary.includes('<HUD'))
  })

  it('ação principal fica fora do scroll, no rodapé flex da sidebar', () => {
    const side = sideMarkup()
    const secondaryStart = side.indexOf('sideSecondary')
    const primaryStart = side.indexOf('turnPrimaryActions')
    assert.ok(primaryStart > secondaryStart)
    const primary = side.slice(primaryStart)
    assert.match(primary, /nextStepHint/)
    assert.match(primary, /section="primary"/)
    assert.doesNotMatch(primary, /section="secondary"/)
  })

  it('desktop: HUD e ação principal não rolam; só .sideSecondary rola', () => {
    const secondary = firstBlock(css, '.sideSecondary')
    const hudBlock = firstBlock(css, '.hud')
    const primary = firstBlock(css, '.turnPrimaryActions')
    assert.match(secondary, /overflow-y:\s*auto/)
    assert.match(hudBlock, /flex:\s*0\s+0\s+auto/)
    assert.match(primary, /flex:\s*0\s+0\s+auto/)
    assert.doesNotMatch(hudBlock, /position:\s*(fixed|sticky)/)
    assert.doesNotMatch(primary, /position:\s*(fixed|sticky|absolute)/)
    assert.doesNotMatch(firstBlock(css, '.hud .panel'), /position:\s*fixed/)
  })

  it('controlsSticky e turnPrimaryActions não sobrepõem com sticky/fixed', () => {
    const sticky = firstBlock(css, '.controlsSticky')
    const primary = firstBlock(css, '.turnPrimaryActions')
    assert.ok(sticky)
    assert.ok(primary)
    assert.doesNotMatch(sticky, /position:\s*sticky/)
    assert.doesNotMatch(sticky, /position:\s*fixed/)
    assert.doesNotMatch(primary, /position:\s*sticky/)
    assert.doesNotMatch(primary, /position:\s*fixed/)
  })

  it('mobile não depende de filho direto .side > .controlsSticky', () => {
    assert.doesNotMatch(css, /\.side\s*>\s*\.controlsSticky/)
    assert.doesNotMatch(css, /\.side\s*>\s*\.turnPrimaryActions/)
    assert.match(css, /\.sideSecondary\s*>\s*\.controlsSticky/)
    assert.match(css, /\.side\s*>\s*\.hud/)
  })

  it('regras mobile de controlsSticky ainda atingem a nova estrutura', () => {
    const matches = [...css.matchAll(/\.sideSecondary\s*>\s*\.controlsSticky[\s\S]*?\{([\s\S]*?)\}/g)]
    assert.ok(matches.length >= 2, 'portrait e landscape devem ter o seletor novo')
    for (const match of matches) {
      assert.match(match[1], /position:\s*static/)
      assert.match(match[1], /order:\s*1/)
    }
  })

  it('Controls preserva canRoll e só fatia o JSX por section', () => {
    assert.match(controls, /const canRoll =/)
    assert.match(controls, /section = 'all'/)
    assert.match(controls, /onAction\?\.\(\{ type: 'ROLL'/)
    assert.match(controls, /Rolar Dado/)
  })

  it('desktop baixa altura tem modo compacto sem fixed/sticky e sem atingir mobile', () => {
    assert.match(css, /@media \(min-width:\s*961px\) and \(max-height:\s*800px\)/)
    assert.match(css, /@media \(min-width:\s*961px\) and \(max-height:\s*740px\)/)
    const compactIdx = css.search(/@media \(min-width:\s*961px\) and \(max-height:\s*800px\)/)
    const compact = css.slice(compactIdx)
    assert.match(compact, /\.hud \.panel/)
    assert.match(compact, /\.side \.diceResult/)
    assert.match(compact, /\.turnPrimaryActions \.nextStepHint/)
    assert.doesNotMatch(compact, /position:\s*(fixed|sticky)/)
  })
})
