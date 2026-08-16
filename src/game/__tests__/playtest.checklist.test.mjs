/**
 * Checklist de validação formal — cobre os itens do playtest de integridade.
 * node --test src/game/__tests__/playtest.checklist.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computeFaturamentoFor,
  computeDespesasFor,
} from '../gameMath.js'
import { MANUAL_CONSTANTS } from '../manualConstants.js'
import { VENDOR_RULES, managerBoostPct, MANAGER_BOOST_MAX_CERTS } from '../gameRules.js'
import { pickWinnerByPatrimonio, computePatrimonio } from '../patrimonio.js'
import {
  canTakeLoan,
  applyLoanTake,
  armLoanAfterRevenue,
  applyLoanCharge,
  shouldChargeLoan,
} from '../loanCycle.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const kitPlayer = (over = {}) => ({
  cash: MANUAL_CONSTANTS.startCash,
  bens: MANUAL_CONSTANTS.startBens,
  clients: 1,
  vendedoresComuns: 1,
  fieldSales: 0,
  insideSales: 0,
  gestores: 0,
  mixProdutos: 'D',
  erpLevel: 'D',
  ...over,
})

const credit = (hire) => Math.floor(Number(hire) * MANUAL_CONSTANTS.recoveryCreditRatio)

// --- pt1: demissão créditos ---
test('pt1 demissão: Comum $1000; Field/Inside/Gestor = 50% do hire', () => {
  assert.equal(credit(MANUAL_CONSTANTS.commonHire), 1000)
  assert.equal(credit(VENDOR_RULES.field.hire), Math.floor(VENDOR_RULES.field.hire * 0.5))
  assert.equal(credit(VENDOR_RULES.inside.hire), Math.floor(VENDOR_RULES.inside.hire * 0.5))
  assert.equal(credit(MANUAL_CONSTANTS.managerHire), 2500)

  const recovery = read('src/modals/RecoveryModal.jsx')
  assert.match(recovery, /unit:\s*MANUAL_CONSTANTS\.commonHire/)
  assert.match(recovery, /unit:\s*VENDOR_RULES\.field\.hire/)
  assert.match(recovery, /unit:\s*VENDOR_RULES\.inside\.hire/)
  assert.match(recovery, /unit:\s*MANUAL_CONSTANTS\.managerHire/)
  assert.match(read('src/modals/RecoveryFire.jsx'), /recoveryCreditRatio/)
})

// --- pt2: boost gestor ---
test('pt2 gestor boost: máx 3 certs = 40%; 4 não sobe', () => {
  assert.equal(MANAGER_BOOST_MAX_CERTS, 3)
  assert.equal(managerBoostPct(0), 0)
  assert.equal(managerBoostPct(3), 0.4)
  assert.equal(managerBoostPct(4), 0.4)

  const with3 = kitPlayer({
    gestores: 1,
    trainingsByVendor: { gestor: ['a', 'b', 'c'] },
  })
  const with4 = kitPlayer({
    gestores: 1,
    trainingsByVendor: { gestor: ['a', 'b', 'c', 'd'] },
  })
  assert.equal(computeFaturamentoFor(with3), computeFaturamentoFor(with4))

  const training = read('src/modals/TrainingModal.jsx')
  assert.match(training, /MANAGER_BOOST_MAX_CERTS/)
  assert.doesNotMatch(
    training,
    /Math\.max\(0,\s*\(MANAGER_BOOST_BY_CERT \|\| \[\]\)\.length - 1\)/,
  )
})

// --- pt3: kit inicial ---
test('pt3 kit start: 18k / 4k / fat 770 / desp 1150', () => {
  assert.equal(MANUAL_CONSTANTS.startCash, 18000)
  assert.equal(MANUAL_CONSTANTS.startBens, 4000)
  const p = kitPlayer()
  assert.equal(computeFaturamentoFor(p), 770)
  assert.equal(computeDespesasFor(p), 1150)
  assert.equal(computePatrimonio(p), 22000)
})

// --- pt4: empréstimo ---
test('pt4 empréstimo: take → arm → charge → bloqueia 2ª', () => {
  let p = { id: 'p1', cash: 500, loanTakenInMatch: false, loanPending: null }
  assert.equal(canTakeLoan(p), true)

  const taken = applyLoanTake(p, 2000, 1)
  assert.equal(taken.ok, true)
  p = taken.player
  assert.equal(p.cash, 2500)
  assert.equal(p.loanTakenInMatch, true)
  assert.equal(p.loanPending.waitingFullLap, true)
  assert.equal(p.loanPending.eligibleOnExpenses, false)

  // Antes de armar: não cobra
  let charge = applyLoanCharge(p)
  assert.equal(charge.charged, false)

  // 2ª tentativa bloqueada
  assert.equal(canTakeLoan(p), false)
  assert.equal(applyLoanTake(p, 1000, 2).ok, false)

  // Após faturamento (volta): arma
  p = {
    ...p,
    loanPending: armLoanAfterRevenue(p.loanPending),
  }
  assert.equal(p.loanPending.eligibleOnExpenses, true)
  assert.equal(
    shouldChargeLoan({ loanPending: { ...p.loanPending, loanId: 'loan:p1:1' }, lastChargedLoanId: null }),
    true,
  )

  charge = applyLoanCharge({ ...p, loanPending: { ...p.loanPending, loanId: 'loan:p1:1' } })
  assert.equal(charge.charged, true)
  assert.equal(charge.amount, 2000)
  assert.equal(charge.player.cash, 500)
  assert.equal(charge.player.loanPending, null)
  assert.equal(charge.player.lastChargedLoanId, 'loan:p1:1')

  // Ainda bloqueado na partida
  assert.equal(canTakeLoan(charge.player), false)
})

// --- pt5: falência / patrimônio ---
test('pt5 endgame: patrimônio cash+bens; falido=0; desempate caixa', () => {
  const winner = pickWinnerByPatrimonio([
    { id: 'a', name: 'Ana', cash: 5000, bens: 5000 },
    { id: 'b', name: 'Bruno', cash: 8000, bens: 2000 },
    { id: 'c', name: 'Carla', cash: 99999, bens: 99999, bankrupt: true },
  ])
  assert.equal(winner.name, 'Bruno')
  assert.equal(computePatrimonio({ cash: 100, bens: 50, bankrupt: true }), 0)
})

// --- pt6: Android pagehide ---
test('pt6 Android: sem leaveLobby/leaveRoom em pagehide/beforeunload', () => {
  for (const file of [
    'src/App.jsx',
    'src/pages/PlayersLobby.jsx',
    'src/pages/RoomLobby.jsx',
  ]) {
    const src = read(file)
    assert.doesNotMatch(src, /addEventListener\(\s*['"]pagehide['"]/)
    assert.doesNotMatch(src, /addEventListener\(\s*['"]beforeunload['"]/)
  }
  assert.match(read('src/pages/PlayersLobby.jsx'), /leaveLobby/)
  assert.match(read('src/App.jsx'), /leaveRoom|leaveLobby/)
})

// --- pt7: reset SPA ---
test('pt7 restart: resetMatchLocalUi existe e limpa gameOver/turnLock/hydrate', () => {
  const app = read('src/App.jsx')
  assert.match(app, /const resetMatchLocalUi = React\.useCallback/)
  assert.match(app, /setGameOver\(false\)/)
  assert.match(app, /setTurnLock\(false\)/)
  assert.match(app, /hydratedFromNetRef\.current = false/)
  const calls = app.match(/resetMatchLocalUi\(\)/g) || []
  assert.ok(calls.length >= 3, `esperado ≥3 usos, got ${calls.length}`)
})

// --- pt8: sync helpers existem (smoke; E2E live ainda manual) ---
test('pt8 sync: testes de merge de players presentes no suite', () => {
  const syncTest = read('src/game/__tests__/playerStateSync.test.mjs')
  assert.match(syncTest, /merge|sync|player/i)
})
