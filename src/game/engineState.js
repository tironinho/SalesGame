// src/game/engineState.js
// ✅ CORREÇÃO 2: Refs compartilhadas entre App.jsx e useTurnEngine.jsx
// Módulo neutro que quebra ciclo de importações

export const engineState = {
  roomRef: { current: null },
  playersRef: { current: [] },
  roundRef: { current: 1 },
  turnIdxRef: { current: 0 },
  pendingTurnDataRef: { current: null },
  lockOwnerRef: { current: null },
}

