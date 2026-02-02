// src/game/gameMath.js

// ======= Tabelas / Constantes (single source of truth) =======
import {
  VENDOR_RULES,
  ERP_RULES,
  MIX_RULES,
  MANAGER_BOOST_BY_CERT,
  MANAGER_MANAGES_UP_TO,
} from './gameRules'

// Back-compat: alguns testes/dev-tools podem importar estas constantes do gameMath.
// Mantemos os exports, mas a fonte real está em `gameRules.js`.
export const VENDOR_CONF = {
  comum:  { cap: VENDOR_RULES.comum.cap,  baseFat: VENDOR_RULES.comum.baseFat,  incFat: VENDOR_RULES.comum.incFat,  baseDesp: VENDOR_RULES.comum.baseDesp,  incDesp: VENDOR_RULES.comum.incDesp },
  inside: { cap: VENDOR_RULES.inside.cap, baseFat: VENDOR_RULES.inside.baseFat, incFat: VENDOR_RULES.inside.incFat, baseDesp: VENDOR_RULES.inside.baseDesp, incDesp: VENDOR_RULES.inside.incDesp },
  field:  { cap: VENDOR_RULES.field.cap,  baseFat: VENDOR_RULES.field.baseFat,  incFat: VENDOR_RULES.field.incFat,  baseDesp: VENDOR_RULES.field.baseDesp,  incDesp: VENDOR_RULES.field.incDesp },
}

export const GESTOR = {
  baseDesp: VENDOR_RULES.gestor.baseDesp,
  incDesp: VENDOR_RULES.gestor.incDesp,
  boostByCert: MANAGER_BOOST_BY_CERT,
  managesUpTo: MANAGER_MANAGES_UP_TO,
}

export const MIX = {
  A: { fat: MIX_RULES.A.fatPerClient, desp: MIX_RULES.A.despPerClient },
  B: { fat: MIX_RULES.B.fatPerClient, desp: MIX_RULES.B.despPerClient },
  C: { fat: MIX_RULES.C.fatPerClient, desp: MIX_RULES.C.despPerClient },
  D: { fat: MIX_RULES.D.fatPerClient, desp: MIX_RULES.D.despPerClient },
}

export const ERP = {
  A: { fat: ERP_RULES.A.fat, desp: ERP_RULES.A.desp },
  B: { fat: ERP_RULES.B.fat, desp: ERP_RULES.B.desp },
  C: { fat: ERP_RULES.C.fat, desp: ERP_RULES.C.desp },
  D: { fat: ERP_RULES.D.fat, desp: ERP_RULES.D.desp },
}

export const num = (v) => Number(v || 0);

const DEBUG_MATH =
  (typeof window !== 'undefined') &&
  (import.meta.env.DEV) &&
  (window.__SG_DEBUG_MATH__ || window.localStorage?.getItem?.('SG_DEBUG_MATH') === '1')

// ======= Certificados / Checks =======
export const certCount = (player = {}, type) => new Set(player?.trainingsByVendor?.[type] || []).size;

export const hasBlue   = (p) => Number(p?.az  || 0) > 0; // certificado azul
export const hasYellow = (p) => Number(p?.am  || 0) > 0; // certificado amarelo
export const hasPurple = (p) => Number(p?.rox || 0) > 0; // certificado roxo
export const countManagerCerts = (p) => certCount(p, 'gestor');

// ======= Cálculos principais =======
export function capacityAndAttendance(player = {}) {
  // ✅ CORREÇÃO: Garante que valores negativos não afetem o cálculo
  const qComum  = Math.max(0, num(player.vendedoresComuns));
  const qInside = Math.max(0, num(player.insideSales));
  const qField  = Math.max(0, num(player.fieldSales));
  
  // ✅ CORREÇÃO: Cálculo detalhado da capacidade
  const capComum = qComum * VENDOR_RULES.comum.cap
  const capInside = qInside * VENDOR_RULES.inside.cap
  const capField = qField * VENDOR_RULES.field.cap
  const cap = capComum + capInside + capField;
  
  const clients = Math.max(0, num(player.clients));
  const inAtt = Math.min(clients, cap);
  
  // ✅ DEBUG: Log protegido (hot-path)
  if (DEBUG_MATH) {
    console.log('[capacityAndAttendance]', {
      player: player.name || 'Unknown',
      vendedoresComuns: qComum,
      insideSales: qInside,
      fieldSales: qField,
      capComum,
      capInside,
      capField,
      totalCap: cap,
      clients,
      inAtt
    });
  }
  
  return { cap, inAtt };
}

export function computeFaturamentoFor(player = {}) {
  const qComum  = num(player.vendedoresComuns);
  const qInside = num(player.insideSales);
  const qField  = num(player.fieldSales);
  const qGestor = num(player.gestores ?? player.gestoresComerciais ?? player.managers);

  const cComum  = certCount(player, 'comum');
  const cInside = certCount(player, 'inside');
  const cField  = certCount(player, 'field');
  const cGestor = certCount(player, 'gestor');

  // faturamento não usa utilização
  const fatComum  = qComum  * (VENDOR_RULES.comum.baseFat  + VENDOR_RULES.comum.incFat  * cComum )
  const fatInside = qInside * (VENDOR_RULES.inside.baseFat + VENDOR_RULES.inside.incFat * cInside)
  const fatField  = qField  * (VENDOR_RULES.field.baseFat  + VENDOR_RULES.field.incFat  * cField )

  let vendorRevenue = fatComum + fatInside + fatField;

  // bônus gestor
  const colaboradores = qComum + qInside + qField;
  const cobertura = colaboradores > 0 ? Math.min(1, (qGestor * MANAGER_MANAGES_UP_TO) / colaboradores) : 0
  // CORREÇÃO B: 0 certificados => 0% boost (array começa com 0 no índice 0).
  const c = Math.max(0, cGestor)
  const boost = MANAGER_BOOST_BY_CERT[Math.min(c, MANAGER_BOOST_BY_CERT.length - 1)] || 0
  vendorRevenue = vendorRevenue * (1 + cobertura * boost)

  const mixLvl = String(player.mixProdutos || 'D').toUpperCase();
  const mixFat = (MIX_RULES[mixLvl]?.fatPerClient || 0) * num(player.clients)

  const erpLvl = String(player.erpLevel || 'D').toUpperCase();
  const staff = colaboradores + qGestor; // por colaborador (inclui gestores)
  const erpFat = (ERP_RULES[erpLvl]?.fat || 0) * staff

  const dynamicRevenue = num(player.revenue);

  const total = Math.max(0, Math.floor(vendorRevenue + mixFat + erpFat + dynamicRevenue));
  return total
}

export function computeDespesasFor(player = {}) {
  const qComum  = num(player.vendedoresComuns);
  const qInside = num(player.insideSales);
  const qField  = num(player.fieldSales);
  const qGestor = num(player.gestores ?? player.gestoresComerciais ?? player.managers);

  const cComum  = certCount(player, 'comum');
  const cInside = certCount(player, 'inside');
  const cField  = certCount(player, 'field');
  const cGestor = certCount(player, 'gestor');

  // CORREÇÃO A: VENDEDOR COMUM baseDesp = 1000 (vem de VENDOR_RULES.comum.baseDesp).
  const dComum  = qComum  * (VENDOR_RULES.comum.baseDesp  + VENDOR_RULES.comum.incDesp  * cComum )
  const dInside = qInside * (VENDOR_RULES.inside.baseDesp + VENDOR_RULES.inside.incDesp * cInside)
  const dField  = qField  * (VENDOR_RULES.field.baseDesp  + VENDOR_RULES.field.incDesp  * cField )
  const dGestor = qGestor * (VENDOR_RULES.gestor.baseDesp + VENDOR_RULES.gestor.incDesp * cGestor)

  const mixLvl = String(player.mixProdutos || 'D').toUpperCase();
  const mixDesp = (MIX_RULES[mixLvl]?.despPerClient || 0) * num(player.clients)

  const erpLvl = String(player.erpLevel || 'D').toUpperCase();
  const colaboradores = qComum + qInside + qField + qGestor;
  const erpDesp = (ERP_RULES[erpLvl]?.desp || 0) * colaboradores

  const extras = 0;
  const baseMaintenance = 1000; // Valor base de manutenção inicial

  const total = Math.max(0, Math.floor(dComum + dInside + dField + dGestor + mixDesp + erpDesp + extras + baseMaintenance));
  return total
}

// ======= Mutações simples =======
export function applyDeltas(player, deltas = {}) {
  const next = { ...player }
  const add = (k, v) => { next[k] = (next[k] ?? 0) + v }

  if (Number.isFinite(deltas.cashDelta)) add('cash', Number(deltas.cashDelta))
  if (Number.isFinite(deltas.clientsDelta)) add('clients', Number(deltas.clientsDelta))
  if (Number.isFinite(deltas.manutencaoDelta)) add('manutencao', Number(deltas.manutencaoDelta))
  if (Number.isFinite(deltas.bensDelta)) add('bens', Number(deltas.bensDelta))
  if (Number.isFinite(deltas.vendedoresComunsDelta)) add('vendedoresComuns', Number(deltas.vendedoresComunsDelta))
  if (Number.isFinite(deltas.fieldSalesDelta)) add('fieldSales', Number(deltas.fieldSalesDelta))
  if (Number.isFinite(deltas.insideSalesDelta)) add('insideSales', Number(deltas.insideSalesDelta))

  // aliases de gestores
  if (Number.isFinite(deltas.gestoresDelta)) {
    const g = Number(deltas.gestoresDelta)
    next.gestores = (next.gestores ?? 0) + g
    next.gestoresComerciais = (next.gestoresComerciais ?? 0) + g
    next.managers = (next.managers ?? 0) + g
  }

  if (Number.isFinite(deltas.revenueDelta)) add('revenue', Number(deltas.revenueDelta))

  if (typeof deltas.mixProdutosSet !== 'undefined') {
    next.mixProdutos = deltas.mixProdutosSet
    // ✅ CORREÇÃO: Quando compra um nível, adiciona ao mixOwned e remove da lista de reduzidos
    const level = String(deltas.mixProdutosSet).toUpperCase()
    if (['A','B','C','D'].includes(level)) {
      next.mixOwned = { ...(next.mixOwned || {}), [level]: true }
      // Remove da lista de reduzidos se estava lá
      if (next.reducedLevels?.MIX) {
        next.reducedLevels = {
          ...next.reducedLevels,
          MIX: next.reducedLevels.MIX.filter(l => l !== level)
        }
      }
    }
  }
  if (deltas.mixBaseSet) next.mixBase = { ...(next.mixBase || {}), ...deltas.mixBaseSet }
  if (typeof deltas.erpLevelSet !== 'undefined') {
    next.erpLevel = deltas.erpLevelSet
    // ✅ CORREÇÃO: Quando compra um nível, adiciona ao erpOwned e remove da lista de reduzidos
    const level = String(deltas.erpLevelSet).toUpperCase()
    if (['A','B','C','D'].includes(level)) {
      next.erpOwned = { ...(next.erpOwned || {}), [level]: true }
      // Remove da lista de reduzidos se estava lá
      if (next.reducedLevels?.ERP) {
        next.reducedLevels = {
          ...next.reducedLevels,
          ERP: next.reducedLevels.ERP.filter(l => l !== level)
        }
      }
    }
  }

  if (Array.isArray(deltas.trainingsPush) && deltas.trainingsPush.length) {
    next.trainings = [ ...(next.trainings || []), ...deltas.trainingsPush ]
  }
  if (Array.isArray(deltas.directBuysPush) && deltas.directBuysPush.length) {
    next.directBuys = [ ...(next.directBuys || []), ...deltas.directBuysPush ]
  }
  return next
}

export function applyTrainingPurchase(player, payload) {
  const { purchases = [], grandTotal = 0 } = payload || {}
  const certMap = { personalizado: 'az', fieldsales: 'am', imersaomultiplier: 'rox' }

  const next = { ...player }
  next.cash = (next.cash ?? 0) - Number(grandTotal || 0)
  next.bens = (next.bens ?? 0) + Number(grandTotal || 0)
  next.onboarding = true

  // Processa cada compra (cada tipo de vendedor)
  purchases.forEach(purchase => {
    const { vendorType, items = [] } = purchase || {}
    
    // Adiciona certificados globais
    items.forEach(it => {
      const key = certMap[it?.id]
      if (key) next[key] = (next[key] ?? 0) + 1
    })

    // Adiciona treinamentos específicos por tipo de vendedor
    const tv = String(vendorType || 'comum')
    const current = new Set( (next.trainingsByVendor?.[tv] || []) )
    items.forEach(it => { if (it?.id) current.add(it.id) })

    next.trainingsByVendor = {
      ...(next.trainingsByVendor || {}),
      [tv]: Array.from(current)
    }
  })

  return next
}

// ======= Regras de movimento =======
export function crossedTile(oldPos, newPos, tileIndex /* zero-based */) {
  if (oldPos === newPos) return false
  if (oldPos < newPos) return tileIndex > oldPos && tileIndex <= newPos
  return tileIndex > oldPos || tileIndex <= newPos // deu a volta
}

// ======= Auxiliares de turnos =======
export function countAlivePlayers(players = []) {
  const list = Array.isArray(players) ? players : []

  // Se não houver ids, mantém o comportamento antigo (por índice)
  let hasAnyId = false
  const byId = new Map()

  for (const p of list) {
    const idRaw = p?.id
    const id = idRaw === undefined || idRaw === null ? '' : String(idRaw)
    if (!id) continue
    hasAnyId = true

    const prev = byId.get(id) || { bankrupt: false }
    // bankrupt é sticky: se qualquer snapshot marcar bankrupt=true, considera falido
    if (p?.bankrupt) prev.bankrupt = true
    byId.set(id, prev)
  }

  if (!hasAnyId) {
    return list.reduce((acc, p) => acc + (p?.bankrupt ? 0 : 1), 0)
  }

  let alive = 0
  for (const v of byId.values()) {
    if (!v.bankrupt) alive += 1
  }
  return alive
}

export function findNextAliveIdx(players, fromIdx) {
  const n = players.length
  if (n === 0) return 0
  let i = (fromIdx + 1) % n
  let guard = 0
  while (guard < n) {
    if (!players[i]?.bankrupt) return i
    i = (i + 1) % n
    guard++
  }
  return fromIdx
}
