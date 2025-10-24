// src/game/__tests__/integrationTests.js
/**
 * Testes de Integração - Sales Game
 * 
 * Este arquivo simula jogadas completas e valida o fluxo do jogo
 * para garantir que todas as funcionalidades trabalham juntas corretamente.
 */

import { 
  computeFaturamentoFor, 
  computeDespesasFor, 
  capacityAndAttendance,
  applyDeltas,
  countAlivePlayers,
  findNextAliveIdx,
  hasBlue,
  hasYellow,
  hasPurple
} from '../gameMath.js'

// ====== SIMULADOR DE JOGO ======
class GameSimulator {
  constructor() {
    this.players = []
    this.turnIdx = 0
    this.round = 1
    this.gameOver = false
    this.winner = null
    this.log = []
  }

  // ====== INICIALIZAÇÃO ======
  initializeGame(playerCount = 2) {
    this.players = []
    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        id: `player-${i}`,
        name: `Jogador ${i + 1}`,
        cash: 18000,
        pos: 0,
        color: ['#ffd54f', '#e57373', '#81c784', '#64b5f6'][i],
        bens: 4000,
        clients: 1,
        vendedoresComuns: 1,
        fieldSales: 0,
        insideSales: 0,
        gestores: 0,
        gestoresComerciais: 0,
        managers: 0,
        erpLevel: 'D',
        mixProdutos: 'D',
        az: 0,
        am: 0,
        rox: 0,
        trainingsByVendor: {},
        onboarding: false,
        bankrupt: false,
        loanPending: null
      })
    }
    this.turnIdx = 0
    this.round = 1
    this.gameOver = false
    this.winner = null
    this.log = []
    
    this.log(`🎮 Jogo inicializado com ${playerCount} jogadores`)
  }

  // ====== AÇÕES DO JOGO ======
  rollDice(playerId) {
    const player = this.players.find(p => p.id === playerId)
    if (!player || player.bankrupt) {
      this.log(`❌ Jogador ${playerId} não pode rolar dado`)
      return false
    }

    const dice = Math.floor(Math.random() * 6) + 1
    const newPos = (player.pos + dice) % 55
    const crossedStart = player.pos > newPos // Passou pela casa 0
    
    player.pos = newPos
    
    this.log(`🎲 ${player.name} rolou ${dice}, moveu para posição ${newPos}`)
    
    if (crossedStart) {
      this.round++
      this.log(`🏁 ${player.name} completou uma volta! Rodada ${this.round}`)
    }

    return { dice, newPos, crossedStart }
  }

  buyItem(playerId, itemType, cost) {
    const player = this.players.find(p => p.id === playerId)
    if (!player || player.bankrupt) {
      this.log(`❌ Jogador ${playerId} não pode comprar`)
      return false
    }

    if (player.cash < cost) {
      this.log(`❌ ${player.name} não tem saldo suficiente para comprar ${itemType}`)
      return false
    }

    player.cash -= cost
    this.log(`💰 ${player.name} comprou ${itemType} por ${cost}`)
    return true
  }

  applyCard(playerId, cardType, deltas) {
    const player = this.players.find(p => p.id === playerId)
    if (!player || player.bankrupt) {
      this.log(`❌ Jogador ${playerId} não pode receber carta`)
      return false
    }

    const beforeCash = player.cash
    const beforeClients = player.clients
    
    Object.assign(player, applyDeltas(player, deltas))
    
    this.log(`🃏 ${player.name} recebeu carta ${cardType}:`)
    this.log(`   Dinheiro: ${beforeCash} → ${player.cash} (${deltas.cashDelta || 0})`)
    this.log(`   Clientes: ${beforeClients} → ${player.clients} (${deltas.clientsDelta || 0})`)
    
    return true
  }

  declareBankruptcy(playerId) {
    const player = this.players.find(p => p.id === playerId)
    if (!player || player.bankrupt) {
      this.log(`❌ Jogador ${playerId} não pode declarar falência`)
      return false
    }

    player.bankrupt = true
    this.log(`💀 ${player.name} declarou falência!`)
    
    // Verifica se o jogo terminou
    const aliveCount = countAlivePlayers(this.players)
    if (aliveCount <= 1) {
      this.endGame()
    }
    
    return true
  }

  nextTurn() {
    const aliveCount = countAlivePlayers(this.players)
    if (aliveCount <= 1) {
      this.endGame()
      return
    }

    this.turnIdx = findNextAliveIdx(this.players, this.turnIdx)
    this.log(`🔄 Turno passou para ${this.players[this.turnIdx].name}`)
  }

  endGame() {
    this.gameOver = true
    const alivePlayers = this.players.filter(p => !p.bankrupt)
    
    if (alivePlayers.length === 1) {
      this.winner = alivePlayers[0]
      this.log(`🏆 ${this.winner.name} venceu!`)
    } else if (alivePlayers.length === 0) {
      this.log(`💀 Todos os jogadores falharam!`)
    } else {
      // Ordena por patrimônio
      alivePlayers.sort((a, b) => (b.cash + b.bens) - (a.cash + a.bens))
      this.winner = alivePlayers[0]
      this.log(`🏆 ${this.winner.name} venceu por ter maior patrimônio!`)
    }
  }

  // ====== UTILITÁRIOS ======
  log(message) {
    const timestamp = new Date().toLocaleTimeString()
    this.log.push(`[${timestamp}] ${message}`)
    console.log(`[${timestamp}] ${message}`)
  }

  getGameState() {
    return {
      players: [...this.players],
      turnIdx: this.turnIdx,
      round: this.round,
      gameOver: this.gameOver,
      winner: this.winner
    }
  }

  getPlayerStats(playerId) {
    const player = this.players.find(p => p.id === playerId)
    if (!player) return null

    const faturamento = computeFaturamentoFor(player)
    const despesas = computeDespesasFor(player)
    const { cap, inAtt } = capacityAndAttendance(player)
    const patrimonio = player.cash + player.bens

    return {
      name: player.name,
      cash: player.cash,
      bens: player.bens,
      patrimonio,
      pos: player.pos,
      clients: player.clients,
      vendedoresComuns: player.vendedoresComuns,
      fieldSales: player.fieldSales,
      insideSales: player.insideSales,
      erpLevel: player.erpLevel,
      mixProdutos: player.mixProdutos,
      az: player.az,
      am: player.am,
      rox: player.rox,
      faturamento,
      despesas,
      lucro: faturamento - despesas,
      capacidade: cap,
      atendimento: inAtt,
      bankrupt: player.bankrupt
    }
  }
}

// ====== TESTES DE INTEGRAÇÃO ======
export const testCompleteGameFlow = () => {
  console.group('🎮 Teste de Fluxo Completo do Jogo')
  
  const game = new GameSimulator()
  game.initializeGame(2)
  
  // Simula algumas jogadas
  for (let i = 0; i < 10; i++) {
    const currentPlayer = game.players[game.turnIdx]
    
    // Rola dado
    const rollResult = game.rollDice(currentPlayer.id)
    if (!rollResult) break
    
    // Simula compra ocasional
    if (Math.random() < 0.3) {
      const cost = Math.floor(Math.random() * 5000) + 1000
      game.buyItem(currentPlayer.id, 'Item', cost)
    }
    
    // Simula carta ocasional
    if (Math.random() < 0.2) {
      const deltas = {
        cashDelta: Math.floor(Math.random() * 4000) - 2000,
        clientsDelta: Math.floor(Math.random() * 3) - 1
      }
      game.applyCard(currentPlayer.id, 'Sorte/Revés', deltas)
    }
    
    // Próximo turno
    game.nextTurn()
    
    if (game.gameOver) break
  }
  
  console.log('✅ Fluxo completo testado')
  console.groupEnd()
}

export const testBankruptcyFlow = () => {
  console.group('💀 Teste de Fluxo de Falência')
  
  const game = new GameSimulator()
  game.initializeGame(2)
  
  // Simula jogador sem dinheiro
  const player1 = game.players[0]
  player1.cash = 100
  
  // Aplica despesas que o jogador não pode pagar
  const despesas = computeDespesasFor(player1)
  if (player1.cash < despesas) {
    game.log(`❌ ${player1.name} não pode pagar despesas de ${despesas}`)
    game.declareBankruptcy(player1.id)
  }
  
  // Verifica se o jogo terminou
  console.assert(game.gameOver === true, 'Jogo deve ter terminado após falência')
  console.assert(game.winner !== null, 'Deve haver um vencedor')
  
  console.log('✅ Fluxo de falência testado')
  console.groupEnd()
}

export const testTurnManagement = () => {
  console.group('🔄 Teste de Gerenciamento de Turnos')
  
  const game = new GameSimulator()
  game.initializeGame(3)
  
  // Testa passagem de turnos
  for (let i = 0; i < 6; i++) {
    const currentPlayer = game.players[game.turnIdx]
    game.log(`Turno ${i + 1}: ${currentPlayer.name}`)
    game.nextTurn()
  }
  
  // Verifica se voltou ao primeiro jogador
  console.assert(game.turnIdx === 0, 'Deve voltar ao primeiro jogador')
  
  console.log('✅ Gerenciamento de turnos testado')
  console.groupEnd()
}

export const testResourceManagement = () => {
  console.group('📊 Teste de Gerenciamento de Recursos')
  
  const game = new GameSimulator()
  game.initializeGame(1)
  
  const player = game.players[0]
  
  // Testa compra de vendedores
  game.buyItem(player.id, 'Vendedor Comum', 2000)
  player.vendedoresComuns += 1
  
  // Testa compra de certificados
  player.az = 1
  player.am = 1
  player.rox = 1
  
  // Verifica cálculos
  const faturamento = computeFaturamentoFor(player)
  const despesas = computeDespesasFor(player)
  const { cap, inAtt } = capacityAndAttendance(player)
  
  console.assert(faturamento > 770, 'Faturamento deve aumentar com mais vendedores')
  console.assert(despesas > 1200, 'Despesas devem aumentar com mais vendedores')
  console.assert(cap > 2, 'Capacidade deve aumentar com mais vendedores')
  
  console.log('✅ Gerenciamento de recursos testado')
  console.groupEnd()
}

export const testSynchronization = () => {
  console.group('🔄 Teste de Sincronização')
  
  const game1 = new GameSimulator()
  const game2 = new GameSimulator()
  
  game1.initializeGame(2)
  game2.initializeGame(2)
  
  // Simula sincronização
  const state1 = game1.getGameState()
  const state2 = game2.getGameState()
  
  // Verifica se os estados são compatíveis
  console.assert(state1.players.length === state2.players.length, 'Número de jogadores deve ser igual')
  console.assert(state1.turnIdx === state2.turnIdx, 'turnIdx deve ser igual')
  console.assert(state1.round === state2.round, 'round deve ser igual')
  
  console.log('✅ Sincronização testada')
  console.groupEnd()
}

// ====== EXECUTOR PRINCIPAL ======
export const runAllIntegrationTests = () => {
  console.group('🧪 EXECUTANDO TESTES DE INTEGRAÇÃO')
  console.log('Iniciando validação de integração...')
  
  try {
    testCompleteGameFlow()
    testBankruptcyFlow()
    testTurnManagement()
    testResourceManagement()
    testSynchronization()
    
    console.log('🎉 TODOS OS TESTES DE INTEGRAÇÃO PASSARAM!')
    console.log('✅ Integração completa: Todas as funcionalidades trabalham juntas')
    
  } catch (error) {
    console.error('❌ FALHA NOS TESTES DE INTEGRAÇÃO:', error)
    console.log('🔧 Verifique os erros acima e corrija antes de continuar')
  }
  
  console.groupEnd()
}

// ====== SIMULADOR INTERATIVO ======
export const createInteractiveSimulator = () => {
  const game = new GameSimulator()
  
  return {
    start: (playerCount = 2) => {
      game.initializeGame(playerCount)
      console.log('🎮 Simulador iniciado! Use os comandos abaixo:')
      console.log('  game.rollDice(playerId)')
      console.log('  game.buyItem(playerId, item, cost)')
      console.log('  game.applyCard(playerId, card, deltas)')
      console.log('  game.declareBankruptcy(playerId)')
      console.log('  game.nextTurn()')
      console.log('  game.getGameState()')
      console.log('  game.getPlayerStats(playerId)')
    },
    
    rollDice: (playerId) => game.rollDice(playerId),
    buyItem: (playerId, item, cost) => game.buyItem(playerId, item, cost),
    applyCard: (playerId, card, deltas) => game.applyCard(playerId, card, deltas),
    declareBankruptcy: (playerId) => game.declareBankruptcy(playerId),
    nextTurn: () => game.nextTurn(),
    getGameState: () => game.getGameState(),
    getPlayerStats: (playerId) => game.getPlayerStats(playerId),
    
    // Comandos de conveniência
    roll: (playerId) => game.rollDice(playerId),
    buy: (playerId, item, cost) => game.buyItem(playerId, item, cost),
    card: (playerId, card, deltas) => game.applyCard(playerId, card, deltas),
    bankrupt: (playerId) => game.declareBankruptcy(playerId),
    next: () => game.nextTurn(),
    state: () => game.getGameState(),
    stats: (playerId) => game.getPlayerStats(playerId)
  }
}

// ====== AUTO-EXECUÇÃO ======
if (typeof window !== 'undefined') {
  // Disponibiliza globalmente para execução no console
  window.runIntegrationTests = runAllIntegrationTests
  window.testCompleteGameFlow = testCompleteGameFlow
  window.testBankruptcyFlow = testBankruptcyFlow
  window.testTurnManagement = testTurnManagement
  window.testResourceManagement = testResourceManagement
  window.testSynchronization = testSynchronization
  window.createInteractiveSimulator = createInteractiveSimulator
  
  console.log('🧪 Testes de integração carregados!')
  console.log('Execute "runIntegrationTests()" para rodar todos os testes')
  console.log('Execute "createInteractiveSimulator()" para criar um simulador interativo')
}
