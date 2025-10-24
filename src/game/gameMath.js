// src/game/gameMath.js

// ======= Tabelas / Constantes =======
export const VENDOR_CONF = {
  comum:  { cap: 2, baseFat:  600, incFat: 100, baseDesp: 100, incDesp: 100 },
  inside: { cap: 5, baseFat: 1500, incFat: 500, baseDesp: 2000, incDesp: 100 },
  field:  { cap: 5, baseFat: 1500, incFat: 500, baseDesp: 2000, incDesp: 100 },
};

export const GESTOR = { baseDesp: 3000, incDesp: 500, boostByCert: [0.20, 0.30, 0.40, 0.60] };

export const MIX = { A:{ fat:1200, desp:700 }, B:{ fat:600, desp:400 }, C:{ fat:300, desp:200 }, D:{ fat:100, desp:50 } };
export const ERP = { A:{ fat:1000, desp:400 }, B:{ fat:500, desp:200 }, C:{ fat:200, desp:100 }, D:{ fat:70, desp:50 } };

export const num = (v) => Number(v || 0);

// ======= Certificados / Checks =======
export const certCount = (player = {}, type) => new Set(player?.trainingsByVendor?.[type] || []).size;

export const hasBlue   = (p) => Number(p?.az  || 0) > 0; // certificado azul
export const hasYellow = (p) => Number(p?.am  || 0) > 0; // certificado amarelo
export const hasPurple = (p) => Number(p?.rox || 0) > 0; // certificado roxo
export const countManagerCerts = (p) => certCount(p, 'gestor');

// ======= Cálculos principais =======
export function capacityAndAttendance(player = {}) {
  const qComum  = num(player.vendedoresComuns);
  const qInside = num(player.insideSales);
  const qField  = num(player.fieldSales);
  const cap = qComum*VENDOR_CONF.comum.cap + qInside*VENDOR_CONF.inside.cap + qField*VENDOR_CONF.field.cap;
  const clients = num(player.clients);
  return { cap, inAtt: Math.min(clients, cap) };
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
  const fatComum  = qComum  * (VENDOR_CONF.comum.baseFat  + VENDOR_CONF.comum.incFat  * cComum );
  const fatInside = qInside * (VENDOR_CONF.inside.baseFat + VENDOR_CONF.inside.incFat * cInside);
  const fatField  = qField  * (VENDOR_CONF.field.baseFat  + VENDOR_CONF.field.incFat  * cField );

  let vendorRevenue = fatComum + fatInside + fatField;

  // bônus gestor
  const colaboradores = qComum + qInside + qField;
  const cobertura = colaboradores > 0 ? Math.min(1, (qGestor * 7) / colaboradores) : 0;
  const boost = GESTOR.boostByCert[Math.min(3, Math.max(0, cGestor))] || 0;
  vendorRevenue = vendorRevenue * (1 + cobertura * boost);

  const mixLvl = String(player.mixProdutos || 'D').toUpperCase();
  const mixFat = (MIX[mixLvl]?.fat || 0) * num(player.clients);

  const erpLvl = String(player.erpLevel || 'D').toUpperCase();
  const staff = colaboradores + qGestor; // por colaborador (inclui gestores)
  const erpFat = (ERP[erpLvl]?.fat || 0) * staff;

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

  const dComum  = qComum  * (VENDOR_CONF.comum.baseDesp  + VENDOR_CONF.comum.incDesp  * cComum );
  const dInside = qInside * (VENDOR_CONF.inside.baseDesp + VENDOR_CONF.inside.incDesp * cInside);
  const dField  = qField  * (VENDOR_CONF.field.baseDesp  + VENDOR_CONF.field.incDesp  * cField );
  const dGestor = qGestor * (GESTOR.baseDesp + GESTOR.incDesp * cGestor);

  const mixLvl = String(player.mixProdutos || 'D').toUpperCase();
  const mixDesp = (MIX[mixLvl]?.desp || 0) * num(player.clients);

  const erpLvl = String(player.erpLevel || 'D').toUpperCase();
  const colaboradores = qComum + qInside + qField + qGestor;
  const erpDesp = (ERP[erpLvl]?.desp || 0) * colaboradores;

  const extras = 0;

  const total = Math.max(0, Math.floor(dComum + dInside + dField + dGestor + mixDesp + erpDesp + extras));
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

  if (typeof deltas.mixProdutosSet !== 'undefined') next.mixProdutos = deltas.mixProdutosSet
  if (deltas.mixBaseSet) next.mixBase = { ...(next.mixBase || {}), ...deltas.mixBaseSet }
  if (typeof deltas.erpLevelSet !== 'undefined') next.erpLevel = deltas.erpLevelSet

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
export function countAlivePlayers(players) {
  return players.reduce((acc, p) => acc + (p?.bankrupt ? 0 : 1), 0)
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
