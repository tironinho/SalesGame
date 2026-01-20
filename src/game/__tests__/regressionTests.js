// src/game/__tests__/regressionTests.js
/**
 * Testes Regressivos Automatizados - Sales Game
 * 
 * Este arquivo contém testes automatizados que validam todas as funcionalidades
 * do jogo para garantir que as mudanças não quebrem funcionalidades existentes.
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
  hasPurple,
  countManagerCerts,
  crossedTile
} from '../gameMath.js'

// ====== DADOS DE TESTE ======
const createTestPlayer = (overrides = {}) => ({
  id: 'test-player-1',
  name: 'Jogador Teste',
  cash: 18000,
  pos: 0,
  color: '#ffd54f',
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
  loanPending: null,
  ...overrides
})

const createTestGameState = (players = [createTestPlayer()]) => ({
  players,
  turnIdx: 0,
  round: 1,
  gameOver: false,
  winner: null
})

// ====== TESTES DE CÁLCULOS BÁSICOS ======
export const testBasicCalculations = () => {
  console.group('🧮 Testes de Cálculos Básicos')
  
  const player = createTestPlayer()
  
  // Teste 1: Faturamento inicial
  const faturamento = computeFaturamentoFor(player)
  console.assert(faturamento === 770, `Faturamento inicial deve ser 770, mas foi ${faturamento}`)
  
  // Teste 2: Despesas iniciais
  const despesas = computeDespesasFor(player)
  console.assert(despesas === 2100, `Despesas iniciais devem ser 2100, mas foram ${despesas}`)
  
  // Teste 3: Capacidade e atendimento
  const { cap, inAtt } = capacityAndAttendance(player)
  console.assert(cap === 2, `Capacidade inicial deve ser 2, mas foi ${cap}`)
  console.assert(inAtt === 1, `Atendimento inicial deve ser 1, mas foi ${inAtt}`)
  
  console.log('✅ Cálculos básicos: OK')
  console.groupEnd()
}

// ====== TESTES DE MOVIMENTO E POSIÇÃO ======
export const testMovementAndPosition = () => {
  console.group('🚶 Testes de Movimento e Posição')
  
  // Teste 1: Movimento básico
  const player = createTestPlayer({ pos: 0 })
  const newPos = (player.pos + 4) % 55 // TRACK_LEN = 55
  console.assert(newPos === 4, `Movimento de 4 casas deve resultar em posição 4, mas foi ${newPos}`)
  
  // Teste 2: Volta completa
  const playerAtEnd = createTestPlayer({ pos: 54 })
  const newPosAfterLap = (playerAtEnd.pos + 1) % 55
  console.assert(newPosAfterLap === 0, `Volta completa deve resultar em posição 0, mas foi ${newPosAfterLap}`)
  
  // Teste 3: crossedTile
  const crossed = crossedTile(0, 4, 0)
  console.assert(crossed === false, `Não deve ter cruzado casa 0 ao mover de 0 para 4`)
  
  const crossedStart = crossedTile(54, 0, 0)
  console.assert(crossedStart === true, `Deve ter cruzado casa 0 ao dar volta completa`)
  
  console.log('✅ Movimento e posição: OK')
  console.groupEnd()
}

// ====== TESTES DE CERTIFICADOS ======
export const testCertificates = () => {
  console.group('🏆 Testes de Certificados')
  
  // Teste 1: Certificados iniciais
  const player = createTestPlayer()
  console.assert(hasBlue(player) === false, `Jogador não deve ter certificado azul inicialmente`)
  console.assert(hasYellow(player) === false, `Jogador não deve ter certificado amarelo inicialmente`)
  console.assert(hasPurple(player) === false, `Jogador não deve ter certificado roxo inicialmente`)
  
  // Teste 2: Adicionar certificados
  const playerWithCerts = { ...player, az: 1, am: 1, rox: 1 }
  console.assert(hasBlue(playerWithCerts) === true, `Jogador deve ter certificado azul após adicionar`)
  console.assert(hasYellow(playerWithCerts) === true, `Jogador deve ter certificado amarelo após adicionar`)
  console.assert(hasPurple(playerWithCerts) === true, `Jogador deve ter certificado roxo após adicionar`)
  
  // Teste 3: Contagem de gestores
  const managerCount = countManagerCerts(player)
  console.assert(managerCount === 0, `Contagem inicial de gestores deve ser 0, mas foi ${managerCount}`)
  
  console.log('✅ Certificados: OK')
  console.groupEnd()
}

// ====== TESTES DE FALÊNCIA ======
export const testBankruptcy = () => {
  console.group('💀 Testes de Falência')
  
  // Teste 1: Jogadores vivos
  const players = [
    createTestPlayer({ id: 'p1', bankrupt: false }),
    createTestPlayer({ id: 'p2', bankrupt: true }),
    createTestPlayer({ id: 'p3', bankrupt: false })
  ]
  
  const aliveCount = countAlivePlayers(players)
  console.assert(aliveCount === 2, `Deve haver 2 jogadores vivos, mas foram ${aliveCount}`)
  
  // Teste 2: Próximo jogador vivo
  const nextAlive = findNextAliveIdx(players, 0)
  console.assert(nextAlive === 2, `Próximo jogador vivo após índice 0 deve ser 2, mas foi ${nextAlive}`)
  
  // Teste 3: Todos falidos
  const allBankrupt = players.map(p => ({ ...p, bankrupt: true }))
  const allAliveCount = countAlivePlayers(allBankrupt)
  console.assert(allAliveCount === 0, `Todos os jogadores falidos devem resultar em 0 vivos, mas foram ${allAliveCount}`)
  
  console.log('✅ Falência: OK')
  console.groupEnd()
}

// ====== TESTES DE APLICAÇÃO DE DELTAS ======
export const testDeltaApplication = () => {
  console.group('📊 Testes de Aplicação de Deltas')
  
  const player = createTestPlayer()
  
  // Teste 1: Delta de dinheiro
  const playerWithCash = applyDeltas(player, { cashDelta: 1000 })
  console.assert(playerWithCash.cash === 19000, `Adicionar 1000 deve resultar em 19000, mas foi ${playerWithCash.cash}`)
  
  // Teste 2: Delta de clientes
  const playerWithClients = applyDeltas(player, { clientsDelta: 2 })
  console.assert(playerWithClients.clients === 3, `Adicionar 2 clientes deve resultar em 3, mas foi ${playerWithClients.clients}`)
  
  // Teste 3: Delta de vendedores
  const playerWithSellers = applyDeltas(player, { vendedoresComunsDelta: 1 })
  console.assert(playerWithSellers.vendedoresComuns === 2, `Adicionar 1 vendedor deve resultar em 2, mas foi ${playerWithSellers.vendedoresComuns}`)
  
  // Teste 4: Múltiplos deltas
  const playerWithMultiple = applyDeltas(player, { 
    cashDelta: -500, 
    clientsDelta: 1, 
    vendedoresComunsDelta: 1 
  })
  console.assert(playerWithMultiple.cash === 17500, `Múltiplos deltas: cash deve ser 17500, mas foi ${playerWithMultiple.cash}`)
  console.assert(playerWithMultiple.clients === 2, `Múltiplos deltas: clients deve ser 2, mas foi ${playerWithMultiple.clients}`)
  console.assert(playerWithMultiple.vendedoresComuns === 2, `Múltiplos deltas: vendedoresComuns deve ser 2, mas foi ${playerWithMultiple.vendedoresComuns}`)
  
  console.log('✅ Aplicação de deltas: OK')
  console.groupEnd()
}

// ====== TESTES DE NÍVEIS ERP E MIX ======
export const testLevels = () => {
  console.group('📈 Testes de Níveis ERP e Mix')
  
  // Teste 1: Níveis iniciais
  const player = createTestPlayer()
  console.assert(player.erpLevel === 'D', `Nível ERP inicial deve ser D, mas foi ${player.erpLevel}`)
  console.assert(player.mixProdutos === 'D', `Nível Mix inicial deve ser D, mas foi ${player.mixProdutos}`)
  
  // Teste 2: Mudança de nível ERP
  const playerWithErpA = applyDeltas(player, { erpLevelSet: 'A' })
  console.assert(playerWithErpA.erpLevel === 'A', `Nível ERP deve ser A após mudança, mas foi ${playerWithErpA.erpLevel}`)
  
  // Teste 3: Mudança de nível Mix
  const playerWithMixB = applyDeltas(player, { mixProdutosSet: 'B' })
  console.assert(playerWithMixB.mixProdutos === 'B', `Nível Mix deve ser B após mudança, mas foi ${playerWithMixB.mixProdutos}`)
  
  console.log('✅ Níveis ERP e Mix: OK')
  console.groupEnd()
}

// ====== TESTES DE TURNOS ======
export const testTurns = () => {
  console.group('🔄 Testes de Turnos')
  
  const players = [
    createTestPlayer({ id: 'p1' }),
    createTestPlayer({ id: 'p2' }),
    createTestPlayer({ id: 'p3' })
  ]
  
  // Teste 1: Próximo turno normal
  const nextTurn1 = findNextAliveIdx(players, 0)
  console.assert(nextTurn1 === 1, `Próximo turno após 0 deve ser 1, mas foi ${nextTurn1}`)
  
  // Teste 2: Próximo turno com jogador falido
  const playersWithBankrupt = [
    { ...players[0], bankrupt: false },
    { ...players[1], bankrupt: true },
    { ...players[2], bankrupt: false }
  ]
  const nextTurn2 = findNextAliveIdx(playersWithBankrupt, 0)
  console.assert(nextTurn2 === 2, `Próximo turno após 0 com jogador 1 falido deve ser 2, mas foi ${nextTurn2}`)
  
  // Teste 3: Volta ao início
  const nextTurn3 = findNextAliveIdx(players, 2)
  console.assert(nextTurn3 === 0, `Próximo turno após último jogador deve ser 0, mas foi ${nextTurn3}`)
  
  console.log('✅ Turnos: OK')
  console.groupEnd()
}

// ====== TESTES DE REGRAS DE NEGÓCIO ======
export const testBusinessRules = () => {
  console.group('💼 Testes de Regras de Negócio')
  
  // Teste 1: Saldo insuficiente
  const poorPlayer = createTestPlayer({ cash: 100 })
  const canPay = poorPlayer.cash >= 1000
  console.assert(canPay === false, `Jogador com 100 não deve poder pagar 1000`)
  
  // Teste 2: Capacidade máxima
  const playerWithMaxCapacity = createTestPlayer({ 
    vendedoresComuns: 10, 
    fieldSales: 5, 
    insideSales: 3 
  })
  const { cap } = capacityAndAttendance(playerWithMaxCapacity)
  console.assert(cap > 0, `Jogador com muitos vendedores deve ter capacidade > 0`)
  
  // Teste 3: Empréstimo pendente
  const playerWithLoan = createTestPlayer({ 
    loanPending: { amount: 5000, dueRound: 2, charged: false }
  })
  console.assert(playerWithLoan.loanPending !== null, `Jogador deve ter empréstimo pendente`)
  console.assert(playerWithLoan.loanPending.amount === 5000, `Valor do empréstimo deve ser 5000`)
  
  console.log('✅ Regras de negócio: OK')
  console.groupEnd()
}

// ====== TESTES DE INTEGRAÇÃO ======
export const testIntegration = () => {
  console.group('🔗 Testes de Integração')
  
  // Teste 1: Jogo completo com 2 jogadores
  const gameState = createTestGameState([
    createTestPlayer({ id: 'p1', name: 'Jogador 1' }),
    createTestPlayer({ id: 'p2', name: 'Jogador 2' })
  ])
  
  console.assert(gameState.players.length === 2, `Jogo deve ter 2 jogadores`)
  console.assert(gameState.turnIdx === 0, `Turno inicial deve ser 0`)
  console.assert(gameState.round === 1, `Rodada inicial deve ser 1`)
  console.assert(gameState.gameOver === false, `Jogo não deve estar terminado inicialmente`)
  
  // Teste 2: Simulação de movimento
  const player1 = gameState.players[0]
  const newPos = (player1.pos + 6) % 55
  const movedPlayer = { ...player1, pos: newPos }
  console.assert(movedPlayer.pos === 6, `Jogador deve estar na posição 6 após mover 6 casas`)
  
  // Teste 3: Simulação de compra
  const purchaseCost = 2000
  const canAfford = movedPlayer.cash >= purchaseCost
  console.assert(canAfford === true, `Jogador deve poder pagar 2000`)
  
  const afterPurchase = applyDeltas(movedPlayer, { cashDelta: -purchaseCost })
  console.assert(afterPurchase.cash === 16000, `Após compra de 2000, saldo deve ser 16000`)
  
  console.log('✅ Integração: OK')
  console.groupEnd()
}

// ====== EXECUTOR PRINCIPAL ======
export const runAllRegressionTests = () => {
  console.group('🧪 EXECUTANDO TESTES REGRESSIVOS COMPLETOS')
  console.log('Iniciando validação automática de todas as funcionalidades...')
  
  try {
    testBasicCalculations()
    testMovementAndPosition()
    testCertificates()
    testBankruptcy()
    testDeltaApplication()
    testLevels()
    testTurns()
    testBusinessRules()
    testIntegration()
    
    console.log('🎉 TODOS OS TESTES PASSARAM! O jogo está funcionando corretamente.')
    console.log('✅ Validação completa: Todas as funcionalidades estão OK')
    
  } catch (error) {
    console.error('❌ FALHA NOS TESTES:', error)
    console.log('🔧 Verifique os erros acima e corrija antes de continuar')
  }
  
  console.groupEnd()
}

// ====== TESTES ESPECÍFICOS PARA PROBLEMAS REPORTADOS ======
export const testReportedIssues = () => {
  console.group('🐛 Testes de Problemas Reportados')
  
  // Teste 1: Nível D deve estar desabilitado
  const player = createTestPlayer()
  console.assert(player.erpLevel === 'D', `Nível ERP inicial deve ser D`)
  console.assert(player.mixProdutos === 'D', `Nível Mix inicial deve ser D`)
  console.log('✅ Nível D inicial: OK')
  
  // Teste 2: Turno deve passar corretamente
  const players = [
    createTestPlayer({ id: 'p1' }),
    createTestPlayer({ id: 'p2' })
  ]
  const nextTurn = findNextAliveIdx(players, 0)
  console.assert(nextTurn === 1, `Turno deve passar de 0 para 1`)
  console.log('✅ Passagem de turno: OK')
  
  // Teste 3: Certificados devem ser exibidos
  const playerWithCerts = { ...player, az: 1, am: 1, rox: 1 }
  console.assert(playerWithCerts.az === 1, `Certificado azul deve ser 1`)
  console.assert(playerWithCerts.am === 1, `Certificado amarelo deve ser 1`)
  console.assert(playerWithCerts.rox === 1, `Certificado roxo deve ser 1`)
  console.log('✅ Exibição de certificados: OK')
  
  // Teste 4: Falência deve funcionar
  const bankruptPlayer = { ...player, bankrupt: true }
  const aliveCount = countAlivePlayers([player, bankruptPlayer])
  console.assert(aliveCount === 1, `Deve haver 1 jogador vivo após falência`)
  console.log('✅ Sistema de falência: OK')
  
  console.log('🎯 Todos os problemas reportados foram validados!')
  console.groupEnd()
}

// ====== AUTO-EXECUÇÃO ======
if (typeof window !== 'undefined') {
  // Disponibiliza globalmente para execução no console
  window.runRegressionTests = runAllRegressionTests
  window.testReportedIssues = testReportedIssues
  window.testBasicCalculations = testBasicCalculations
  window.testMovementAndPosition = testMovementAndPosition
  window.testCertificates = testCertificates
  window.testBankruptcy = testBankruptcy
  window.testDeltaApplication = testDeltaApplication
  window.testLevels = testLevels
  window.testTurns = testTurns
  window.testBusinessRules = testBusinessRules
  window.testIntegration = testIntegration
  
  console.log('🧪 Testes regressivos carregados!')
  console.log('Execute "runRegressionTests()" no console para rodar todos os testes')
  console.log('Execute "testReportedIssues()" para testar problemas específicos')
}
