// src/game/engine/gameEffects.js
// ETAPA 3 — EFFECTS (impuro)
//
// runEvents(events, deps) processa eventos sequencialmente.
// Nesta etapa inicial, os handlers são "no-op" seguros para permitir wiring incremental.

export async function runEvents(events, deps) {
  const evs = Array.isArray(events) ? events : []
  const logger = deps?.logger || console

  for (const ev of evs) {
    if (!ev || !ev.type) continue

    if (ev.type === 'LOG') {
      logger.log(ev.msg)
      continue
    }

    if (ev.type === 'OPEN_MODAL') {
      // Placeholder seguro (sem UI): em wiring real, isso vai abrir modal via ModalContext
      logger.log('[effects] OPEN_MODAL (noop)', ev.modal, ev.payload || {})
      continue
    }

    if (ev.type === 'REVENUE' || ev.type === 'EXPENSES' || ev.type === 'LUCK') {
      // Placeholder: wiring real usará computeFaturamentoFor/computeDespesasFor e modais específicos.
      logger.log(`[effects] ${ev.type} (noop)`, ev)
      continue
    }

    if (ev.type === 'COMMIT') {
      // deps.commitState?: async () => void
      await deps?.commitState?.()
      continue
    }

    if (ev.type === 'BROADCAST') {
      // deps.broadcastState?: () => void
      deps?.broadcastState?.(ev.payload)
      continue
    }

    logger.warn('[effects] unknown event', ev)
  }
}

