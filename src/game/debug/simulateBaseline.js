// src/game/debug/simulateBaseline.js
// ETAPA 0 — BASELINE
//
// Objetivo: capturar um baseline determinístico (antes/depois do refactor) sem mexer em regras.
// Este arquivo é propositalmente auto-contido (evita depender dos novos módulos),
// para servir como "snapshot" estável.
//
// Como rodar (DEV):
//   import('./game/debug/simulateBaseline.js').then(m => m.runBaselineSimulation())

const TRACK_LEN_DEFAULT = 55

// ====== Mapeamento de casas (IDÊNTICO ao useTurnEngine.jsx) ======
const TILES = {
  ERP: new Set([6, 16, 32, 49]),
  TRAINING: new Set([2, 11, 19, 47]),
  DIRECT_BUY: new Set([5, 10, 43]),
  INSIDE: new Set([12, 21, 30, 42, 53]),
  CLIENTS: new Set([4, 8, 15, 17, 20, 27, 34, 36, 39, 46, 52, 55]),
  MANAGER: new Set([18, 24, 29, 51]),
  FIELD: new Set([13, 25, 33, 38, 50]),
  COMMON: new Set([9, 28, 40, 45]),
  MIX: new Set([7, 31, 44]),
  LUCK: new Set([3, 14, 22, 26, 35, 41, 48, 54]),
}

export function getTileTypeBaseline(pos1Based) {
  const p = Number(pos1Based)
  if (!Number.isFinite(p) || p < 1) return 'UNKNOWN'
  if (TILES.ERP.has(p)) return 'ERP'
  if (TILES.TRAINING.has(p)) return 'TRAINING'
  if (TILES.DIRECT_BUY.has(p)) return 'DIRECT_BUY'
  if (TILES.INSIDE.has(p)) return 'INSIDE'
  if (TILES.CLIENTS.has(p)) return 'CLIENTS'
  if (TILES.MANAGER.has(p)) return 'MANAGER'
  if (TILES.FIELD.has(p)) return 'FIELD'
  if (TILES.COMMON.has(p)) return 'COMMON'
  if (TILES.MIX.has(p)) return 'MIX'
  if (TILES.LUCK.has(p)) return 'LUCK'
  return 'NONE'
}

export function tileNeedsModalBaseline(tileType) {
  // No uso atual: todas as casas especiais acima podem abrir algum modal.
  return tileType !== 'NONE' && tileType !== 'UNKNOWN'
}

// ====== Movimento (matemática pura) ======
export function computeMoveBaseline({ pos, steps, trackLen }) {
  const len = Number(trackLen) || TRACK_LEN_DEFAULT
  const p = Number(pos) || 0
  const s = Number(steps) || 0
  const raw = p + s
  const lapCount = raw >= 0 ? Math.floor(raw / len) : 0
  const newPos = ((raw % len) + len) % len
  const crossedStart = lapCount > 0
  return { newPos, crossedStart, lapCount }
}

// Mesma semântica do crossedTile do gameMath (tileIndex é zero-based)
export function crossedTileBaseline(oldPos, newPos, tileIndex) {
  if (oldPos === newPos) return false
  if (oldPos < newPos) return tileIndex > oldPos && tileIndex <= newPos
  return tileIndex > oldPos || tileIndex <= newPos // deu a volta
}

const forwardDist = (from, to, len) => {
  const d = (to - from + len) % len
  return d === 0 ? len : d
}

// ====== Simulação ======
export function runBaselineSimulation(opts = {}) {
  const trackLen = Number(opts.trackLen || TRACK_LEN_DEFAULT)
  const stepsSeq = Array.isArray(opts.stepsSeq) ? opts.stepsSeq : [3, 2, 4, 1]

  const state = {
    players: [
      { id: 'P1', name: 'P1', pos: 0, cash: 18000 },
      { id: 'P2', name: 'P2', pos: 0, cash: 18000 },
    ],
    turnIdx: 0,
    turnPlayerId: 'P1',
    modalLocks: 0,
    round: 1,
  }

  const lines = []
  const snap = (label) => {
    const p1 = state.players[0]
    const p2 = state.players[1]
    lines.push({
      label,
      round: state.round,
      turnIdx: state.turnIdx,
      turnPlayerId: state.turnPlayerId,
      modalLocks: state.modalLocks,
      P1: { pos: p1.pos, cash: p1.cash },
      P2: { pos: p2.pos, cash: p2.cash },
    })
  }

  snap('INIT')

  for (let i = 0; i < stepsSeq.length; i++) {
    const steps = Number(stepsSeq[i] || 0)
    const curIdx = state.turnIdx
    const cur = state.players[curIdx]
    const oldPos = cur.pos

    const { newPos, crossedStart } = computeMoveBaseline({ pos: oldPos, steps, trackLen })
    cur.pos = newPos

    const landedOneBased = newPos + 1
    const tileType = getTileTypeBaseline(landedOneBased)

    const crossedRevenue = crossedTileBaseline(oldPos, newPos, 0) || crossedStart
    const crossedExpenses = crossedTileBaseline(oldPos, newPos, 22)

    // Simula “abrir modal” e fechar imediatamente (baseline só para medir sequência/estado)
    const shouldOpenModal = tileNeedsModalBaseline(tileType)
    if (shouldOpenModal) {
      state.modalLocks++
      state.modalLocks--
    }

    // Eventos sequenciais (apenas log no baseline)
    const events = []
    if (crossedRevenue) events.push({ type: 'REVENUE', at: forwardDist(oldPos, 0, trackLen) })
    if (crossedExpenses) events.push({ type: 'EXPENSES', at: forwardDist(oldPos, 22, trackLen) })
    if (tileType === 'LUCK') events.push({ type: 'LUCK', at: steps })
    events.sort((a, b) => a.at - b.at)

    snap(`ROLL ${steps} -> pos=${newPos} (tile=${tileType}) events=${events.map(e => e.type).join(',') || 'NONE'}`)

    // Próximo turno (baseline simplificado)
    state.turnIdx = (state.turnIdx + 1) % state.players.length
    state.turnPlayerId = state.players[state.turnIdx].id
    snap('TURN_CHANGE')
  }

  console.groupCollapsed('[Baseline] simulateBaseline result')
  console.table(lines.map(l => ({
    label: l.label,
    round: l.round,
    turnPlayerId: l.turnPlayerId,
    modalLocks: l.modalLocks,
    P1pos: l.P1.pos,
    P1cash: l.P1.cash,
    P2pos: l.P2.pos,
    P2cash: l.P2.cash,
  })))
  console.groupEnd()

  return { state, lines }
}

