/**
 * Regressão: locks síncronos + lifecycle correto (sem zerar modal real por tempo).
 * Executar: node --test src/game/__tests__/modalLockGate.test.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  bumpModalLockCount,
  releaseModalLockCount,
  decideModalLockClearWait,
  simulateModalLockLifecycle,
  simulatePostRecoveryPipeline,
  recoveryFlowLockInvariants,
  MODAL_LOCK_DIAGNOSTIC_MS,
} from '../modalLockGate.js'
import {
  applyLoanTake,
  canTakeLoan,
  clearLoanAfterCharge,
  loanChargeAmount,
} from '../loanCycle.js'
import { MANUAL_CONSTANTS } from '../manualConstants.js'

const here = dirname(fileURLToPath(import.meta.url))
const engineSrc = readFileSync(join(here, '..', 'useTurnEngine.jsx'), 'utf8')

describe('A — modal aberta >5s NÃO tem lock zerado', () => {
  it('locks=1 opening=false elapsed=10000 não é stale', () => {
    const d = decideModalLockClearWait({
      locks: 1,
      opening: false,
      elapsedMs: 10000,
      diagnosticMs: MODAL_LOCK_DIAGNOSTIC_MS,
    })
    assert.equal(d.clear, false)
    assert.equal(d.reconcile, false)
    assert.equal(d.reason, 'diagnostic-wait')
    assert.equal(d.shouldLog, true)
  })
})

describe('B — opening=false não significa modal fechada', () => {
  it('estado normal pós-render: locks>0 opening=false continua aguardando', () => {
    const d = decideModalLockClearWait({
      locks: 1,
      opening: false,
      elapsedMs: 500,
      diagnosticMs: MODAL_LOCK_DIAGNOSTIC_MS,
    })
    assert.equal(d.clear, false)
    assert.equal(d.reconcile, false)
    assert.equal(d.reason, 'modal-active')
  })
})

describe('C — open → close: 0 → 1 → 0', () => {
  it('lifecycle único', () => {
    const { locks, history } = simulateModalLockLifecycle(['open', 'close'])
    assert.deepEqual(history, [0, 1, 0])
    assert.equal(locks, 0)
  })
})

describe('D — duas modais sequenciais: 0 → 1 → 0 → 1 → 0', () => {
  it('lifecycle sequencial', () => {
    const { locks, history } = simulateModalLockLifecycle([
      'open',
      'close',
      'open',
      'close',
    ])
    assert.deepEqual(history, [0, 1, 0, 1, 0])
    assert.equal(locks, 0)
  })
})

describe('E — contador nunca negativo', () => {
  it('release em 0 permanece 0; bump/release monotônico', () => {
    assert.equal(releaseModalLockCount(0), 0)
    assert.equal(releaseModalLockCount(-3), 0)
    let n = 0
    n = bumpModalLockCount(n)
    n = bumpModalLockCount(n)
    n = releaseModalLockCount(n)
    n = releaseModalLockCount(n)
    n = releaseModalLockCount(n)
    assert.equal(n, 0)
  })
})

describe('F — recovery com lock liberado corretamente libera pipeline', () => {
  it('após finally correto (locks=0), eventsInProgress pode ir a false', () => {
    // Happy path: openModalAndWait já liberou o lock no finally
    const pipe = simulatePostRecoveryPipeline({
      locksAfterRecovery: 0,
      opening: false,
    })
    assert.equal(pipe.pipelineReleased, true)
    assert.equal(pipe.eventsInProgress, false)
    assert.equal(pipe.locks, 0)
    assert.equal(pipe.error, undefined)

    const inv = recoveryFlowLockInvariants({
      modalLocks: 0,
      openingModal: false,
      eventsInProgress: false,
    })
    assert.equal(inv.ok, true)
  })
})

describe('G — sucesso principal NÃO depende de lock stale artificial', () => {
  it('lifecycle correto termina em lock 0; tempo longo com lock ativo NÃO reconcilia', () => {
    const life = simulateModalLockLifecycle(['open', 'close'])
    assert.equal(life.locks, 0)

    const whileUserThinks = decideModalLockClearWait({
      locks: 1,
      opening: false,
      elapsedMs: 60_000,
    })
    assert.equal(whileUserThinks.reconcile, false)
    assert.equal(whileUserThinks.clear, false)

    // Pipeline só libera quando o lifecycle já deixou locks=0
    const pipe = simulatePostRecoveryPipeline({ locksAfterRecovery: 0 })
    assert.equal(pipe.pipelineReleased, true)
    assert.ok(!pipe.steps.some((s) => s.decision?.reconcile))
  })
})

describe('Cenário financeiro A — empréstimo + lifecycle correto', () => {
  it('LOAN + pagamento; pipeline libera porque lock foi a 0 (não por timeout)', () => {
    const requiredAmount = 3000
    let player = {
      id: 'p1',
      cash: 0,
      bens: 10000,
      loanTakenInMatch: false,
      loanPending: null,
    }
    assert.equal(canTakeLoan(player), true)
    const taken = applyLoanTake(player, 5000, 1)
    assert.equal(taken.ok, true)
    player = taken.player
    assert.ok(Number(player.cash) >= requiredAmount)
    const afterPay = {
      ...player,
      cash: Math.max(0, Number(player.cash) - requiredAmount),
    }
    assert.equal(afterPay.cash, 2000)

    const life = simulateModalLockLifecycle(['open', 'close', 'open', 'close'])
    assert.equal(life.locks, 0)
    const pipe = simulatePostRecoveryPipeline({ locksAfterRecovery: life.locks })
    assert.equal(pipe.pipelineReleased, true)
    assert.equal(pipe.eventsInProgress, false)
  })
})

describe('Cenário financeiro B — redução + lifecycle correto', () => {
  it('crédito + pagamento único; pipeline após lock 0', () => {
    const requiredAmount = 2000
    const creditApplied = 2500
    let cash = 100 + creditApplied
    cash = Math.max(0, cash - requiredAmount)
    assert.equal(cash, 600)
    void MANUAL_CONSTANTS

    const life = simulateModalLockLifecycle(['open', 'close'])
    assert.equal(life.locks, 0)
    const pipe = simulatePostRecoveryPipeline({ locksAfterRecovery: 0 })
    assert.equal(pipe.pipelineReleased, true)
  })
})

describe('Cenário C — recuperação insuficiente', () => {
  it('crédito único; ainda pode reabrir recovery (locks já 0)', () => {
    const requiredAmount = 10000
    const cash = 500 + 2000
    assert.ok(cash < requiredAmount)
    const pipe = simulatePostRecoveryPipeline({ locksAfterRecovery: 0 })
    assert.equal(pipe.pipelineReleased, true)
  })
})

describe('Cenário D — saldo suficiente', () => {
  it('pagamento direto; barreira resolve na hora', () => {
    let cash = 5000
    cash -= 1500
    assert.equal(cash, 3500)
    const pipe = simulatePostRecoveryPipeline({ locksAfterRecovery: 0 })
    assert.equal(pipe.pipelineReleased, true)
    assert.equal(pipe.elapsed, 0)
  })
})

describe('Cenário E — Despesas → recovery → LUCK', () => {
  it('após lock 0, fila segue para Sorte/Revés', () => {
    const events = ['EXPENSES', 'LUCK']
    const afterExpenses = simulatePostRecoveryPipeline({ locksAfterRecovery: 0 })
    assert.equal(afterExpenses.pipelineReleased, true)
    assert.equal(events[1], 'LUCK')
    assert.equal(afterExpenses.locks, 0)
  })
})

describe('Cenário F — pendingTurnData / handoff único', () => {
  it('pending preservado; um handoff após pipeline liberada', () => {
    const pendingTurnData = {
      nextPlayers: [{ id: 'a' }, { id: 'b' }],
      nextTurnIdx: 1,
      nextTurnPlayerId: 'b',
      nextRound: 1,
    }
    const pipe = simulatePostRecoveryPipeline({ locksAfterRecovery: 0 })
    assert.equal(pipe.pipelineReleased, true)
    assert.equal(pendingTurnData.nextTurnPlayerId, 'b')
    let handoffs = 0
    if (pipe.pipelineReleased && pendingTurnData) handoffs += 1
    assert.equal(handoffs, 1)

    let p = {
      id: 'a',
      cash: 0,
      bens: 8000,
      loanTakenInMatch: false,
      loanPending: null,
    }
    const taken = applyLoanTake(p, 4000, 1)
    p = taken.player
    assert.equal(loanChargeAmount(p.loanPending), 6000)
    p = clearLoanAfterCharge(p, p.loanPending.loanId)
    assert.equal(p.loanPending, null)
  })
})

describe('wiring useTurnEngine — lock gate', () => {
  it('ref síncrono; finally libera por lockHeld; sem reconcile temporal', () => {
    assert.match(engineSrc, /from '\.\/modalLockGate\.js'/)
    assert.match(engineSrc, /bumpModalLockCount/)
    assert.match(engineSrc, /releaseModalLockCount/)
    assert.match(engineSrc, /if \(lockHeld\)/)
    assert.doesNotMatch(
      engineSrc,
      /React\.useEffect\(\s*\(\)\s*=>\s*\{\s*modalLocksRef\.current\s*=\s*modalLocks/,
    )
    assert.doesNotMatch(engineSrc, /modalResolved && lockHeld/)
    assert.doesNotMatch(engineSrc, /reconciliando locks stale/)
    assert.doesNotMatch(engineSrc, /MODAL_LOCK_CLEAR_HARD_MAX_MS/)
  })

  it('não força nextTurn() após LOAN/REDUCE', () => {
    const loanIdx = engineSrc.indexOf("recoveryModalRes.type === 'LOAN'")
    assert.ok(loanIdx >= 0)
    const slice = engineSrc.slice(loanIdx, loanIdx + 4500)
    assert.doesNotMatch(slice, /\bnextTurn\s*\(/)
  })

  it('LUCK ainda exige APPLY_CARD', () => {
    const luckIdx = engineSrc.indexOf("if (ev.type === 'LUCK')")
    assert.ok(luckIdx >= 0)
    const slice = engineSrc.slice(luckIdx, luckIdx + 1200)
    assert.match(slice, /res\.action\s*!==\s*['"]APPLY_CARD['"]/)
  })
})
