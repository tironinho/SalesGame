// src/debug/cashAudit.js
// Cash Audit Log (runtime only) — NÃO altera rooms.state.
//
// Ativação:
// - ENV:  import.meta.env.VITE_CASH_AUDIT === '1'
// - Query: ?cashAudit=1
// - Toggle via DebugPanel (opcional)

const GLOBAL_KEY = '__CASH_AUDIT__'

function getGlobal() {
  if (typeof window === 'undefined') return null
  if (!window[GLOBAL_KEY]) {
    window[GLOBAL_KEY] = {
      enabled: false,
      entries: [],
      maxEntries: 5000,
      currentMeta: null, // meta padrão (traceId/actionType/origin/reason/context)
    }
  }
  return window[GLOBAL_KEY]
}

export function initCashAudit(options = {}) {
  const g = getGlobal()
  if (!g) return { enabled: false }

  if (typeof options.enabled === 'boolean') g.enabled = options.enabled
  if (Number.isFinite(options.maxEntries) && options.maxEntries > 0) g.maxEntries = Math.floor(options.maxEntries)

  return { enabled: g.enabled, maxEntries: g.maxEntries, size: g.entries.length }
}

export function setCashAuditContext(meta) {
  const g = getGlobal()
  if (!g) return
  g.currentMeta = meta || null
}

export function getCashAuditContext() {
  const g = getGlobal()
  return g?.currentMeta || null
}

function computeSeverity(entry) {
  const before = Number(entry.beforeCash)
  const after = Number(entry.afterCash)
  const delta = Number(entry.delta)

  if (!Number.isFinite(after) || Number.isNaN(after) || !Number.isFinite(delta) || Number.isNaN(delta)) return 'ERROR'
  if (after < -1e9 || after > 1e9) return 'ERROR'

  const at = String(entry.actionType || '')
  const isPayish = /PAY|EXPENSE|OPS|DEBT/i.test(at)

  if (Math.abs(delta) >= 5000) return 'WARN'
  if (isPayish && delta > 0) return 'WARN'

  // inconsistência básica
  if (Number.isFinite(before) && Number.isFinite(after) && (after - before) !== delta) return 'WARN'

  return 'INFO'
}

export function recordCashChange(entry) {
  const g = getGlobal()
  if (!g || !g.enabled) return

  const e = { ...entry }
  e.traceId = e.traceId || 'unknown'
  e.ts = e.ts || new Date().toISOString()
  e.severity = e.severity || computeSeverity(e)

  // stack opcional: apenas em ERROR (extra pedido)
  if (e.severity === 'ERROR' && !e.stack) {
    try { e.stack = new Error('cashAudit').stack } catch {}
  }

  g.entries.push(e)
  if (g.entries.length > g.maxEntries) {
    g.entries.splice(0, g.entries.length - g.maxEntries)
  }

  const delta = Number(e.delta || 0)
  const afterCash = Number(e.afterCash || 0)
  const who = e.playerName || e.playerId
  const reason = e.reason || 'UNKNOWN_CASH_CHANGE'
  const sev = e.severity || 'INFO'

  console.groupCollapsed(`[CASH] ${sev} Δ${delta} -> ${afterCash} | ${who} | ${reason}`)
  console.log(e)
  console.groupEnd()
}

function toPlayers(stateOrPlayers) {
  if (Array.isArray(stateOrPlayers)) return stateOrPlayers
  if (stateOrPlayers && Array.isArray(stateOrPlayers.players)) return stateOrPlayers.players
  return null
}

export function captureCashDiff(prevState, nextState, meta = null) {
  const g = getGlobal()
  if (!g || !g.enabled) return

  const prevPlayers = toPlayers(prevState) || []
  const nextPlayers = toPlayers(nextState) || []

  const byIdPrev = new Map(prevPlayers.map(p => [String(p?.id), p || {}]))
  const byIdNext = new Map(nextPlayers.map(p => [String(p?.id), p || {}]))

  const allIds = new Set([...byIdPrev.keys(), ...byIdNext.keys()])

  const m = meta || g.currentMeta || {}
  const origin = m.origin || {}
  const context = m.context || {}

  for (const id of allIds) {
    const p0 = byIdPrev.get(id)
    const p1 = byIdNext.get(id)

    if (!p0 && p1) {
      recordCashChange({
        ts: new Date().toISOString(),
        traceId: m.traceId || 'unknown',
        actionType: m.actionType || 'PLAYER_ADDED',
        reason: m.reason || 'PLAYER_ADDED',
        severity: 'INFO',
        playerId: id,
        playerName: p1?.name,
        beforeCash: 0,
        afterCash: Number(p1?.cash || 0),
        delta: Number(p1?.cash || 0),
        origin,
        context,
      })
      continue
    }

    if (!p1 && p0) continue // removido: ignora

    const beforeCash = Number(p0?.cash || 0)
    const afterCash = Number(p1?.cash || 0)
    if (beforeCash === afterCash) continue

    const delta = afterCash - beforeCash
    const entry = {
      ts: new Date().toISOString(),
      traceId: m.traceId || 'unknown',
      actionType: m.actionType || 'UNKNOWN',
      reason: m.reason || 'UNKNOWN_CASH_CHANGE',
      playerId: id,
      playerName: p1?.name,
      beforeCash,
      afterCash,
      delta,
      origin: {
        ...origin,
        // fallback: se não vier origin, tenta inferir minimamente
        file: origin.file,
        fn: origin.fn,
        modal: origin.modal,
        component: origin.component,
      },
      context: {
        round: context.round,
        pos: Number.isFinite(Number(p1?.pos)) ? Number(p1.pos) : context.pos,
        tile: context.tile,
        debt: context.debt,
        loanPending: Number(p1?.loanPending?.amount || 0) || context.loanPending,
        opsExpense: context.opsExpense,
        revenue: context.revenue,
      },
    }

    entry.severity = computeSeverity(entry)
    recordCashChange(entry)
  }
}

export function exportCashAudit({ download = false, filename } = {}) {
  const g = getGlobal()
  const payload = {
    exportedAt: new Date().toISOString(),
    enabled: !!g?.enabled,
    size: g?.entries?.length || 0,
    entries: g?.entries || [],
  }
  const json = JSON.stringify(payload, null, 2)

  if (download && typeof window !== 'undefined') {
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `cash-audit-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.warn('[cashAudit] download failed', e)
    }
  }

  return json
}

export function clearCashAudit() {
  const g = getGlobal()
  if (!g) return
  g.entries = []
}

