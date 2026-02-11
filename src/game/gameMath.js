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

  const dynamicRevenue = Math.max(0, num(player.revenue));

  const { cap, inAtt } = capacityAndAttendance(player);

  // Regras 1, 2 e 4: sem atendimento efetivo, não há faturamento de vendas
  if (cap <= 0 || inAtt <= 0) return dynamicRevenue;

  // Receita por cliente atendido
  const rateComum  = VENDOR_RULES.comum.baseFat + VENDOR_RULES.comum.incFat * cComum;
  const rateInside = VENDOR_RULES.inside.baseFat + VENDOR_RULES.inside.incFat * cInside;
  const rateField  = VENDOR_RULES.field.baseFat + VENDOR_RULES.field.incFat * cField;

  // Capacidade por tipo
  const capComum  = qComum * VENDOR_RULES.comum.cap;
  const capInside = qInside * VENDOR_RULES.inside.cap;
  const capField  = qField * VENDOR_RULES.field.cap;

  const capTotal = capComum + capInside + capField;
  const safeCap = capTotal > 0 ? capTotal : cap;

  // Potencial total se tudo estivesse atendendo (capacidade cheia)
  const potentialSales =
    capComum * rateComum +
    capInside * rateInside +
    capField * rateField;

  // Utilização real
  const util = Math.min(1, inAtt / safeCap);
  let vendorsFat = Math.floor(potentialSales * util);

  // Gestor boost permanece como estava
  const boostPct = MANAGER_BOOST_BY_CERT[Math.min(3, cGestor)] || 0;
  if (qGestor > 0 && boostPct > 0) {
    vendorsFat = Math.floor(vendorsFat * (1 + boostPct));
  }

  // Mix de produtos só fatura clientes atendidos
  const mixLevel = String(player.mixProdutos || 'D').toUpperCase();
  const mixFatPerClient = MIX_RULES[mixLevel]?.fatPerClient || 0;
  const mixFat = mixFatPerClient * inAtt;

  // ERP por colaborador
  const erpLevel = String(player.erpLevel || player.erpSistemas || 'D').toUpperCase();
  const erpFatPerStaff = ERP_RULES[erpLevel]?.fatPerStaff ?? ERP_RULES[erpLevel]?.fat ?? 0;

  const qColabs = qComum + qInside + qField + qGestor;
  const erpFat = erpFatPerStaff * qColabs;

  return Math.max(0, Math.floor(vendorsFat + mixFat + erpFat + dynamicRevenue));
}

export function computeDespesasFor(player = {}) {
  const qComum  = num(player.vendedoresComuns);
  const qInside = num(player.insideSales);
  const qField  = num(player.fieldSales);
  const qGestor = num(player.gestores ?? player.gestoresComerciais ?? player.managers);
  const qClientes = num(player.clients);
  const qColabs = qComum + qInside + qField + qGestor;

  const cComum  = certCount(player, 'comum');
  const cInside = certCount(player, 'inside');
  const cField  = certCount(player, 'field');
  const cGestor = certCount(player, 'gestor');

  const mixLevel = String(player.mixProdutos || 'D').toUpperCase();
  const erpLevel = String(player.erpLevel || player.erpSistemas || 'D').toUpperCase();

  const dComum =
    (VENDOR_RULES.comum.baseDesp * qComum) +
    (VENDOR_RULES.comum.incDesp * cComum * qComum);

  const dInside =
    (VENDOR_RULES.inside.baseDesp * qInside) +
    (VENDOR_RULES.inside.incDesp * cInside * qInside);
  const dField =
    (VENDOR_RULES.field.baseDesp * qField) +
    (VENDOR_RULES.field.incDesp * cField * qField);

  const dGestor =
    (VENDOR_RULES.gestor.baseDesp * qGestor) +
    (VENDOR_RULES.gestor.incDesp * cGestor * qGestor);

  const dMix = (MIX_RULES[mixLevel]?.despPerClient || 0) * qClientes;
  const dErp = (ERP_RULES[erpLevel]?.desp || 0) * qColabs;

  const dCarteiraClientes = 50 * qClientes;

  const total = Math.max(0, Math.floor(dComum + dInside + dField + dGestor + dMix + dErp + dCarteiraClientes));
  return total;
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
