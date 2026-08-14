/**
 * Dicas progressivas (1× por tipo de casa por sessão de aba).
 * Não altera regras nem sync — só UX local.
 */

import { getTileContext, getTileHint } from '../modals/tileContext.js'

export const TIP_SESSION_PREFIX = 'salesgame_tip_seen_v1:'

const TIP_KINDS = Object.freeze([
  'CLIENTS',
  'COMMON',
  'FIELD',
  'INSIDE',
  'MANAGER',
  'ERP',
  'MIX',
  'TRAINING',
  'DIRECT_BUY',
  'LUCK',
  'REVENUE',
  'EXPENSES',
])

function tipKey(kind) {
  return `${TIP_SESSION_PREFIX}${String(kind || '').toUpperCase()}`
}

export function hasSeenTileTip(kind) {
  const k = String(kind || '').toUpperCase()
  if (!TIP_KINDS.includes(k)) return true
  try {
    return sessionStorage.getItem(tipKey(k)) === '1'
  } catch {
    return false
  }
}

export function markTileTipSeen(kind) {
  const k = String(kind || '').toUpperCase()
  if (!TIP_KINDS.includes(k)) return
  try {
    sessionStorage.setItem(tipKey(k), '1')
  } catch {
    // ignore
  }
}

/**
 * Se ainda não viu a dica desta casa, retorna o texto e marca como vista.
 * @returns {{ kind: string, text: string } | null}
 */
export function consumeTileTip(kind) {
  const k = String(kind || '').toUpperCase()
  if (!TIP_KINDS.includes(k)) return null
  if (hasSeenTileTip(k)) return null
  const text = getTileHint(k) || getTileContext(k)
  if (!text) return null
  markTileTipSeen(k)
  return { kind: k, text }
}

export function listTipKinds() {
  return [...TIP_KINDS]
}
