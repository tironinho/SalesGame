// src/engine/GameEngine.js
/**
 * GameEngine
 *  - Mantém estado imutável da partida (players, turno, rodadas, etc.)
 *  - Centraliza REGRAS DE NEGÓCIO (compras/contratações/treinamentos/cartas, etc.)
 *  - Fornece helpers para App.jsx disparar ações a partir das modais
 *
 * Conceitos:
 *  - "roundCount[p.id]" = nº de jogadas que o jogador já fez (1 jogada = 1 vez que ele rola o dado).
 *  - A partida termina quando TODOS tiverem >= maxRounds (ex.: 5).
 *  - Score final: cash + bens (você pode ajustar a fórmula aqui).
 *
 * Este arquivo não sabe nada de React nem de modais. Apenas recebe eventos.
 */

export default class GameEngine {
  constructor({
    players = [],           // [{id, name, color?}]
    startCash = 18_000,
    bensInicial = 4_000,
    maxRounds = 5,
  } = {}) {
    this.maxRounds = maxRounds;

    // estado base por jogador
    this.state = {
      turnIdx: 0,
      round: 1, // round “visual” (opcional)
      gameOver: false,
      winnerIds: [],
      players: players.map((p, i) => this._mkPlayer(p, startCash, bensInicial, i)),
      roundCount: Object.fromEntries(players.map(p => [p.id, 0])), // quantas vezes cada um já jogou
      log: [],
    };
  }

  // ======= Helpers de estado =======
  _mkPlayer(p, startCash, bens, i) {
    return {
      id: p.id,
      name: p.name ?? `Jogador ${i + 1}`,
      color: p.color ?? ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4],
      cash: Number.isFinite(p.cash) ? p.cash : startCash,
      bens: Number.isFinite(p.bens) ? p.bens : bens,
      pos: Number.isFinite(p.pos) ? p.pos : 0,

      // "ativos" e contadores
      clients: 0,
      vendedoresComuns: 0,
      vendedoresComunsDespesa: 0,   // mensal agregado (informativo)
      fieldSales: 0,
      insideSales: 0,
      gestores: 0,

      trainings: [],                // [{id,label,price}]
      loans: [],                    // [{amount}]
      erpLevel: 'D',                // ERP/Sistemas
      erpBase: { despesa: 50, faturamento: 70 }, // valores D
      mixProdutos: 'D',             // Mix Produtos
      mixBase:  { despesaPorCliente: 50, faturamentoPorCliente: 100 }, // valores D

      // efeitos especiais
      habeasCorpus: 0,              // cartas “habeas corpus” guardadas
    };
  }

  _clone() { return JSON.parse(JSON.stringify(this.state)); }

  getState() { return this._clone(); }

  // log auxiliar
  _pushLog(msg) {
    const s = this.state;
    s.log = [msg, ...s.log].slice(0, 50);
  }

  // ======= Controle de turno/rodada =======
  /** Chame isto quando o jogador terminar sua jogada (após resolver a casa/modal). */
  endTurn() {
    if (this.state.gameOver) return this.getState();

    const s = this.state;
    const cur = s.players[s.turnIdx];
    if (cur) {
      s.roundCount[cur.id] = (s.roundCount[cur.id] || 0) + 1;
    }

    // próximo jogador
    s.turnIdx = (s.turnIdx + 1) % s.players.length;

    // se voltamos para o 0, consideramos “virou” a rodada visual
    if (s.turnIdx === 0) s.round += 1;

    // checa fim de jogo
    this._maybeFinish();

    return this.getState();
  }

  _maybeFinish() {
    const s = this.state;
    const allDone = s.players.every(p => (s.roundCount[p.id] || 0) >= this.maxRounds);
    if (!allDone) return;

    // placar: cash + bens
    let best = -Infinity;
    let winners = [];
    for (const p of s.players) {
      const score = this.computeScore(p);
      if (score > best) { best = score; winners = [p.id]; }
      else if (score === best) { winners.push(p.id); }
    }
    s.gameOver = true;
    s.winnerIds = winners;
  }

  computeScore(player) {
    return Number(player.cash || 0) + Number(player.bens || 0);
  }

  // ======= Movimentação (opcional) =======
  setPosition(playerId, newPos) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p) return this.getState();
    p.pos = newPos;
    return this.getState();
  }

  // ======= Regras de negócios (disparadas pelas modais) =======

  // ---- Carteira de clientes (BuyClientsModal) ----
  buyClients(playerId, { qty, unitAcquisition = 1000, totalCost }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !qty) return this.getState();

    const cost = Number.isFinite(totalCost)
      ? totalCost
      : Number(qty) * Number(unitAcquisition || 0);

    p.cash -= cost;
    p.clients = (p.clients || 0) + Number(qty);

    this._pushLog(`${p.name} comprou ${qty} cliente(s) por $${cost.toLocaleString()}.`);
    return this.getState();
  }

  // ---- Vendedores Comuns ----
  hireCommonSellers(playerId, { qty, totalHire = 0, totalExpense = 0 }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !qty) return this.getState();

    p.cash -= Number(totalHire || 0);
    p.vendedoresComuns = (p.vendedoresComuns || 0) + Number(qty);
    p.vendedoresComunsDespesa = (p.vendedoresComunsDespesa || 0) + Number(totalExpense || 0);

    this._pushLog(`${p.name} contratou ${qty} Vendedor(es) Comum(ns): -$${Number(totalHire||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- Field Sales ----
  hireFieldSales(playerId, { qty, totalHire = 0, totalExpense = 0 }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !qty) return this.getState();

    p.cash -= Number(totalHire || 0);
    p.fieldSales = (p.fieldSales || 0) + Number(qty);

    // (se quiser agregar despesa mensal por tipo, acrescente aqui)
    this._pushLog(`${p.name} contratou ${qty} Field Sales: -$${Number(totalHire||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- Inside Sales ----
  hireInsideSales(playerId, { qty, totalCost = 0 }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !qty) return this.getState();

    p.cash -= Number(totalCost || 0);
    p.insideSales = (p.insideSales || 0) + Number(qty);

    this._pushLog(`${p.name} contratou ${qty} Inside Sales: -$${Number(totalCost||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- Gestor Comercial ----
  hireManager(playerId, { qty, totalHire = 0, totalExpense = 0 }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !qty) return this.getState();

    p.cash -= Number(totalHire || 0);
    p.gestores = (p.gestores || 0) + Number(qty);

    this._pushLog(`${p.name} contratou ${qty} Gestor(es): -$${Number(totalHire||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- ERP / Sistemas ----
  setERP(playerId, { level, values }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p) return this.getState();

    const price = Number(values?.compra || 0);
    p.cash -= price;
    p.erpLevel = level;
    p.erpBase = {
      despesa: Number(values?.despesa || 0),
      faturamento: Number(values?.faturamento || 0),
    };

    this._pushLog(`${p.name} adquiriu ERP nível ${level}: -$${price.toLocaleString()}.`);
    return this.getState();
  }

  // ---- Mix de Produtos ----
  setMix(playerId, { level, compra, despesa, faturamento }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p) return this.getState();

    const price = Number(compra || 0);
    p.cash -= price;
    p.mixProdutos = level;
    p.mixBase = {
      despesaPorCliente: Number(despesa || 0),
      faturamentoPorCliente: Number(faturamento || 0),
    };

    this._pushLog(`${p.name} adquiriu Mix nível ${level}: -$${price.toLocaleString()}.`);
    return this.getState();
  }

  // ---- Treinamentos ----
  buyTraining(playerId, { vendorType, items = [], total = 0 }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !items.length) return this.getState();

    p.cash -= Number(total || 0);
    p.trainings = [...(p.trainings || []), ...items.map(it => ({ ...it, vendorType }))];

    this._pushLog(`${p.name} comprou treinamento(s) (${vendorType}): -$${Number(total||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- Direto de compra (atalho genérico) ----
  directBuy(playerId, { item, cost = 0 }) {
    // Você pode ramificar por "item" e delegar para métodos específicos.
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p) return this.getState();

    p.cash -= Number(cost || 0);
    this._pushLog(`${p.name} realizou compra direta (${item}): -$${Number(cost||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- Recuperação Financeira (exemplos) ----
  takeLoan(playerId, { amount }) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !amount) return this.getState();

    p.cash += Number(amount || 0);
    p.loans = [...(p.loans || []), { amount: Number(amount) }];

    this._pushLog(`${p.name} pegou empréstimo: +$${Number(amount||0).toLocaleString()}.`);
    return this.getState();
  }

  reduceAssetForCash(playerId, { kind, amount }) {
    // Ex.: reduzir nível Mix/ERP e creditar parte do valor pago
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !amount) return this.getState();

    p.cash += Number(amount || 0);
    this._pushLog(`${p.name} reduziu ${kind}: +$${Number(amount||0).toLocaleString()}.`);
    return this.getState();
  }

  // ---- Sorte & Revés ----
  /**
   * Recebe o payload estruturado da carta (SorteRevesModal).
   * A engine aplica o efeito principal padronizado (cash/clients) e
   * retorna o estado novo. Efeitos especiais ficam a critério do jogo.
   */
  applySorteReves(playerId, card) {
    const s = this.state;
    const p = s.players.find(x => x.id === playerId);
    if (!p || !card) return this.getState();

    if (Number.isFinite(card.cashDelta)) {
      p.cash += Number(card.cashDelta);
    }
    if (Number.isFinite(card.clientsDelta)) {
      p.clients = Math.max(0, (p.clients || 0) + Number(card.clientsDelta));
    }
    if (card.skipPassTurnRemover) {
      p.habeasCorpus = (p.habeasCorpus || 0) + 1;
    }
    if (card.infraLevelUp) {
      // regra simplificada: subir ERP OU Mix (ajuste conforme seu jogo)
      // aqui, como “infra”, subimos ERP 1 nível (D->C->B->A) sem custo
      p.erpLevel = this._stepLevelUp(p.erpLevel);
      // Obs.: se quiser atualizar p.erpBase conforme a nova tabela, faça-o aqui.
    }
    if (card.freeBuyNow) {
      // sinalize para a UI permitir uma compra grátis agora
      // (regra específica deve ser tratada no App, aqui só anotamos)
      p._freeBuyFlag = true;
    }

    this._pushLog(`${p.name} tirou ${card.kind}: ${card.title || ''}`.trim());
    return this.getState();
  }

  _stepLevelUp(level) {
    const order = ['D','C','B','A'];
    const idx = order.indexOf(level);
    return order[Math.min(order.length - 1, Math.max(0, idx + 1))] || 'D';
  }
}
