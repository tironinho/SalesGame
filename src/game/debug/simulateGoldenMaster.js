// src/game/debug/simulateGoldenMaster.js
// ETAPA 6 — Golden Master (DEV)
//
// Não depende de Vitest: roda no console e valida invariantes.
// Como rodar:
//   import('./game/debug/simulateGoldenMaster.js').then(m => m.runGoldenMaster())

import { TRACK_LEN } from '../../data/track'
import { reduceGame } from '../engine/gameReducer'

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

export function runGoldenMaster() {
  // Estado mínimo (sem tocar schema persistido real) — apenas para simulação determinística.
  let state = {
    players: [
      { id: 'P1', name: 'P1', pos: 0, cash: 18000, bankrupt: false },
      { id: 'P2', name: 'P2', pos: 0, cash: 18000, bankrupt: false },
    ],
    turnIdx: 0,
    turnPlayerId: 'P1',
    // locks simulados
    turnLock: false,
    lockOwner: null,
    // campo auxiliar local (não persistido) — aqui só para testar canAct
  }

  const seq = [
    { actor: 'P1', type: 'ROLL', steps: 3 },
    { actor: 'P2', type: 'ROLL', steps: 2 },
    { actor: 'P1', type: 'ROLL', steps: 6 },
  ]

  const snapshots = []

  for (const step of seq) {
    const { nextState, events } = reduceGame(state, { type: 'ROLL', steps: step.steps }, { myUid: step.actor, trackLen: TRACK_LEN })
    state = nextState

    // invariantes
    for (const p of state.players) {
      assert(Number.isFinite(p.pos), 'pos deve ser number')
      assert(p.pos >= 0 && p.pos < TRACK_LEN, `pos fora do range: ${p.pos}`)
      assert(!Number.isNaN(p.cash), 'cash não pode ser NaN')
    }

    // Golden snapshot (minimal)
    snapshots.push({
      actor: step.actor,
      steps: step.steps,
      P1pos: state.players[0].pos,
      P2pos: state.players[1].pos,
      events: events.map(e => e.type),
    })
  }

  console.groupCollapsed('[GoldenMaster] snapshots')
  console.table(snapshots)
  console.groupEnd()

  return { ok: true, snapshots }
}

