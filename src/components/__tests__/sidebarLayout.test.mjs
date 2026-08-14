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
    assert.match(hud, /className=["'`][^"'`]*\bpanel\b/)
    assert.match(hud, /game-stats-card/)
    assert.match(hud, /game-stats-section/)
    assert.match(hud, /Placar/)
    assert.match(hud, /export default function HUD\(\{\s*totals,\s*players\s*\}\)/)
    assert.match(app, /<HUD\s+totals=\{totals\}\s+players=\{players\}/)
    assert.match(hud, /Faturamento|buildGameStatSections/)
    assert.match(hud, /Manutenção|buildGameStatSections/)
    assert.match(hud, /Capacidade|buildGameStatSections/)
    assert.match(hud, /Em Atendimento|buildGameStatSections/)
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

  it('desktop largo landscape: sidebar sem scroll interno; HUD e ação principal preservados', () => {
    const marker = css.indexOf('/* SIDEBAR DESKTOP — caber sem scroll')
    assert.ok(marker >= 0, 'bloco compacto sem scroll deve existir')
    const compact = css.slice(marker, marker + 4500)
    assert.match(compact, /@media \(min-width:\s*1200px\) and \(orientation:\s*landscape\)/)
    assert.match(compact, /\.sideSecondary\s*\{[^}]*overflow:\s*visible/)
    assert.doesNotMatch(compact, /overflow-y:\s*(auto|scroll)/)
    assert.doesNotMatch(compact, /\.side\s*\{[^}]*overflow:\s*hidden/)

    const hudBlock = firstBlock(css, '.hud')
    const primary = firstBlock(css, '.turnPrimaryActions')
    assert.match(hudBlock, /flex:\s*0\s+0\s+auto/)
    assert.match(primary, /flex:\s*0\s+0\s+auto/)
    assert.doesNotMatch(hudBlock, /position:\s*(fixed|sticky)/)
    assert.doesNotMatch(primary, /position:\s*(fixed|sticky|absolute)/)
    assert.doesNotMatch(firstBlock(css, '.hud .panel'), /position:\s*fixed/)

    const side = sideMarkup()
    const hudStart = side.indexOf('<HUD')
    const secondaryStart = side.indexOf('sideSecondary')
    const primaryStart = side.indexOf('turnPrimaryActions')
    assert.ok(hudStart >= 0 && secondaryStart > hudStart)
    assert.ok(primaryStart > secondaryStart)
  })

  it('desktop alto: HUD com altura natural; ação principal usa a sobra', () => {
    const marker = css.indexOf('/* SIDEBAR DESKTOP — telas altas')
    assert.ok(marker >= 0, 'bloco de telas altas deve existir')
    const tall = css.slice(marker, marker + 5500)
    assert.match(tall, /@media \(min-width:\s*1200px\) and \(min-height:\s*820px\)/)
    assert.match(tall, /\.side\s*>\s*\.hud\s*\{[^}]*flex:\s*0\s+0\s+auto/)
    assert.match(tall, /grid-template-rows:\s*auto\s+auto/)
    assert.match(tall, /\.game-stats-card\s*\{[^}]*height:\s*auto/)
    assert.doesNotMatch(tall, /grid-template-rows:\s*minmax\(0,\s*1fr\)/)
    assert.doesNotMatch(tall, /align-content:\s*space-evenly/)
    assert.match(tall, /flex:\s*1\s+1\s+135px/)
    assert.match(tall, /min-height:\s*125px/)
    assert.match(tall, /max-height:\s*165px/)
    assert.match(tall, /\.turnPrimaryActions\s*\{[^}]*display:\s*grid/)
    assert.match(tall, /\.btn\.go\s*\{[^}]*min-height:\s*58px/)
    assert.match(tall, /min-height:\s*clamp\(88px,\s*10dvh,\s*108px\)/)
    assert.doesNotMatch(tall, /\.side\s*>\s*\.turnPrimaryActions/)
  })

  it('notebook baixo (<=1599×700): sidebar mais larga, sem scroll e botões em uma linha', () => {
    const marker = css.indexOf('/* SIDEBAR DESKTOP — notebook baixo')
    assert.ok(marker >= 0, 'bloco de notebook baixo deve existir')
    const end = css.indexOf('/* SIDEBAR DESKTOP — telas altas', marker)
    const low = css.slice(marker, end > marker ? end : marker + 4500)
    assert.match(
      low,
      /@media \(min-width:\s*1200px\) and \(max-width:\s*1599px\) and \(max-height:\s*700px\)/,
    )
    assert.match(low, /--side-w:\s*clamp\(360px,\s*28vw,\s*390px\)/)
    assert.match(low, /white-space:\s*nowrap/)
    assert.match(low, /\.btn\.go\s*\{[^}]*min-height:\s*54px/)
    assert.match(low, /padding-bottom:\s*8px/)
    assert.doesNotMatch(low, /overflow-y:\s*(auto|scroll)/)
    assert.doesNotMatch(low, /@media[^{]*min-height:\s*820px/)
  })

  it('tablet paisagem baixa (900–1199): board full + sidebar com 2 colunas e controles', () => {
    const marker = css.indexOf('/* TABLET paisagem baixa')
    assert.ok(marker >= 0, 'bloco de tablet deve existir')
    const end = css.indexOf('/* DESKTOP >= 1200px', marker)
    const tablet = css.slice(marker, end > marker ? end : marker + 5000)
    assert.match(
      tablet,
      /@media \(min-width:\s*900px\) and \(max-width:\s*1199px\) and \(orientation:\s*landscape\) and \(max-height:\s*700px\)/,
    )
    assert.match(tablet, /--side-w:\s*clamp\(290px,\s*30vw,\s*320px\)/)
    assert.match(tablet, /aspect-ratio:\s*auto/)
    assert.match(tablet, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    assert.match(tablet, /\.diceResult\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/)
    assert.match(tablet, /\.btn\.go\s*\{[^}]*min-height:\s*58px/)
    assert.match(tablet, /\.sideSecondary\s*\{[^}]*flex:\s*1\s+1\s+auto/)
    assert.doesNotMatch(tablet, /aspect-ratio:\s*13\s*\/\s*9/)
    assert.doesNotMatch(tablet, /display:\s*none/)
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
    assert.doesNotMatch(controls, /Vez de/)
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

  it('mobile landscape touch: board-first e não colapsa o tabuleiro', () => {
    assert.match(
      css,
      /@media \(max-width:\s*960px\) and \(orientation:\s*landscape\) and \(pointer:\s*coarse\)/,
    )
    const idx = css.search(
      /@media \(max-width:\s*960px\) and \(orientation:\s*landscape\) and \(pointer:\s*coarse\)/,
    )
    const block = css.slice(idx)
    assert.match(block, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(160px,\s*28%\)/)
    assert.match(block, /container-type:\s*size/)
    assert.match(block, /aspect-ratio:\s*13\s*\/\s*9/)
    assert.match(block, /100cqh/)
  })
})
