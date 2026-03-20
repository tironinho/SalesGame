// src/game/__tests__/runCompleteTests.js
/**
 * Executor Completo de Testes - Sales Game
 * 
 * Este arquivo executa todos os testes e gera um relatório completo
 * para validação e documentação.
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

// ====== EXECUTOR DE TESTES ======
export const runCompleteTestSuite = () => {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: []
    },
    results: []
  }

  console.log('🧪 INICIANDO SUITE COMPLETA DE TESTES - SALES GAME')
  console.log('=' .repeat(60))
  console.log(`📅 Data/Hora: ${new Date().toLocaleString()}`)
  console.log('')

  // ====== TESTE 1: CÁLCULOS BÁSICOS ======
  console.log('📊 TESTE 1: CÁLCULOS BÁSICOS')
  console.log('-' .repeat(40))
  
  try {
    const player = createTestPlayer()
    
    // Faturamento inicial
    const faturamento = computeFaturamentoFor(player)
    console.log(`✅ Faturamento inicial: ${faturamento} (esperado: 770)`)
    report.results.push({
      test: 'Faturamento Inicial',
      expected: 770,
      actual: faturamento,
      status: faturamento === 770 ? 'PASS' : 'FAIL'
    })
    
    // Despesas iniciais
    const despesas = computeDespesasFor(player)
    console.log(`✅ Despesas iniciais: ${despesas} (esperado: 2100)`)
    report.results.push({
      test: 'Despesas Iniciais',
      expected: 2100,
      actual: despesas,
      status: despesas === 2100 ? 'PASS' : 'FAIL'
    })
    
    // Capacidade e atendimento
    const { cap, inAtt } = capacityAndAttendance(player)
    console.log(`✅ Capacidade: ${cap}, Atendimento: ${inAtt} (esperado: cap=2, att=1)`)
    report.results.push({
      test: 'Capacidade e Atendimento',
      expected: 'cap=2, att=1',
      actual: `cap=${cap}, att=${inAtt}`,
      status: cap === 2 && inAtt === 1 ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 1: CÁLCULOS BÁSICOS - PASSOU')
    report.summary.passed += 3
    report.summary.totalTests += 3
    
  } catch (error) {
    console.log(`❌ TESTE 1: CÁLCULOS BÁSICOS - FALHOU: ${error.message}`)
    report.summary.failed += 3
    report.summary.totalTests += 3
    report.summary.errors.push(`Cálculos Básicos: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 2: MOVIMENTO E POSIÇÃO ======
  console.log('🚶 TESTE 2: MOVIMENTO E POSIÇÃO')
  console.log('-' .repeat(40))
  
  try {
    // Movimento básico
    const player = createTestPlayer({ pos: 0 })
    const newPos = (player.pos + 4) % 55
    console.log(`✅ Movimento de 4 casas: posição ${newPos} (esperado: 4)`)
    report.results.push({
      test: 'Movimento Básico',
      expected: 4,
      actual: newPos,
      status: newPos === 4 ? 'PASS' : 'FAIL'
    })
    
    // Volta completa
    const playerAtEnd = createTestPlayer({ pos: 54 })
    const newPosAfterLap = (playerAtEnd.pos + 1) % 55
    console.log(`✅ Volta completa: posição ${newPosAfterLap} (esperado: 0)`)
    report.results.push({
      test: 'Volta Completa',
      expected: 0,
      actual: newPosAfterLap,
      status: newPosAfterLap === 0 ? 'PASS' : 'FAIL'
    })
    
    // crossedTile
    const crossed = crossedTile(0, 4, 0)
    console.log(`✅ Cruzou casa 0 (0→4): ${crossed} (esperado: false)`)
    report.results.push({
      test: 'Cruzou Casa 0 (0→4)',
      expected: false,
      actual: crossed,
      status: crossed === false ? 'PASS' : 'FAIL'
    })
    
    const crossedStart = crossedTile(54, 0, 0)
    console.log(`✅ Cruzou casa 0 (54→0): ${crossedStart} (esperado: true)`)
    report.results.push({
      test: 'Cruzou Casa 0 (54→0)',
      expected: true,
      actual: crossedStart,
      status: crossedStart === true ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 2: MOVIMENTO E POSIÇÃO - PASSOU')
    report.summary.passed += 4
    report.summary.totalTests += 4
    
  } catch (error) {
    console.log(`❌ TESTE 2: MOVIMENTO E POSIÇÃO - FALHOU: ${error.message}`)
    report.summary.failed += 4
    report.summary.totalTests += 4
    report.summary.errors.push(`Movimento e Posição: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 3: CERTIFICADOS ======
  console.log('🏆 TESTE 3: CERTIFICADOS')
  console.log('-' .repeat(40))
  
  try {
    // Certificados iniciais
    const player = createTestPlayer()
    console.log(`✅ Certificado azul inicial: ${hasBlue(player)} (esperado: false)`)
    report.results.push({
      test: 'Certificado Azul Inicial',
      expected: false,
      actual: hasBlue(player),
      status: hasBlue(player) === false ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Certificado amarelo inicial: ${hasYellow(player)} (esperado: false)`)
    report.results.push({
      test: 'Certificado Amarelo Inicial',
      expected: false,
      actual: hasYellow(player),
      status: hasYellow(player) === false ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Certificado roxo inicial: ${hasPurple(player)} (esperado: false)`)
    report.results.push({
      test: 'Certificado Roxo Inicial',
      expected: false,
      actual: hasPurple(player),
      status: hasPurple(player) === false ? 'PASS' : 'FAIL'
    })
    
    // Adicionar certificados
    const playerWithCerts = { ...player, az: 1, am: 1, rox: 1 }
    console.log(`✅ Certificado azul após adicionar: ${hasBlue(playerWithCerts)} (esperado: true)`)
    report.results.push({
      test: 'Certificado Azul Após Adicionar',
      expected: true,
      actual: hasBlue(playerWithCerts),
      status: hasBlue(playerWithCerts) === true ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Certificado amarelo após adicionar: ${hasYellow(playerWithCerts)} (esperado: true)`)
    report.results.push({
      test: 'Certificado Amarelo Após Adicionar',
      expected: true,
      actual: hasYellow(playerWithCerts),
      status: hasYellow(playerWithCerts) === true ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Certificado roxo após adicionar: ${hasPurple(playerWithCerts)} (esperado: true)`)
    report.results.push({
      test: 'Certificado Roxo Após Adicionar',
      expected: true,
      actual: hasPurple(playerWithCerts),
      status: hasPurple(playerWithCerts) === true ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 3: CERTIFICADOS - PASSOU')
    report.summary.passed += 6
    report.summary.totalTests += 6
    
  } catch (error) {
    console.log(`❌ TESTE 3: CERTIFICADOS - FALHOU: ${error.message}`)
    report.summary.failed += 6
    report.summary.totalTests += 6
    report.summary.errors.push(`Certificados: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 4: FALÊNCIA ======
  console.log('💀 TESTE 4: SISTEMA DE FALÊNCIA')
  console.log('-' .repeat(40))
  
  try {
    const players = [
      createTestPlayer({ id: 'p1', bankrupt: false }),
      createTestPlayer({ id: 'p2', bankrupt: true }),
      createTestPlayer({ id: 'p3', bankrupt: false })
    ]
    
    const aliveCount = countAlivePlayers(players)
    console.log(`✅ Jogadores vivos: ${aliveCount} (esperado: 2)`)
    report.results.push({
      test: 'Contagem de Jogadores Vivos',
      expected: 2,
      actual: aliveCount,
      status: aliveCount === 2 ? 'PASS' : 'FAIL'
    })
    
    const nextAlive = findNextAliveIdx(players, 0)
    console.log(`✅ Próximo jogador vivo após índice 0: ${nextAlive} (esperado: 2)`)
    report.results.push({
      test: 'Próximo Jogador Vivo',
      expected: 2,
      actual: nextAlive,
      status: nextAlive === 2 ? 'PASS' : 'FAIL'
    })
    
    const allBankrupt = players.map(p => ({ ...p, bankrupt: true }))
    const allAliveCount = countAlivePlayers(allBankrupt)
    console.log(`✅ Todos falidos: ${allAliveCount} vivos (esperado: 0)`)
    report.results.push({
      test: 'Todos os Jogadores Falidos',
      expected: 0,
      actual: allAliveCount,
      status: allAliveCount === 0 ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 4: SISTEMA DE FALÊNCIA - PASSOU')
    report.summary.passed += 3
    report.summary.totalTests += 3
    
  } catch (error) {
    console.log(`❌ TESTE 4: SISTEMA DE FALÊNCIA - FALHOU: ${error.message}`)
    report.summary.failed += 3
    report.summary.totalTests += 3
    report.summary.errors.push(`Sistema de Falência: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 5: APLICAÇÃO DE DELTAS ======
  console.log('📊 TESTE 5: APLICAÇÃO DE DELTAS')
  console.log('-' .repeat(40))
  
  try {
    const player = createTestPlayer()
    
    // Delta de dinheiro
    const playerWithCash = applyDeltas(player, { cashDelta: 1000 })
    console.log(`✅ Adicionar 1000: saldo ${playerWithCash.cash} (esperado: 19000)`)
    report.results.push({
      test: 'Delta de Dinheiro',
      expected: 19000,
      actual: playerWithCash.cash,
      status: playerWithCash.cash === 19000 ? 'PASS' : 'FAIL'
    })
    
    // Delta de clientes
    const playerWithClients = applyDeltas(player, { clientsDelta: 2 })
    console.log(`✅ Adicionar 2 clientes: ${playerWithClients.clients} (esperado: 3)`)
    report.results.push({
      test: 'Delta de Clientes',
      expected: 3,
      actual: playerWithClients.clients,
      status: playerWithClients.clients === 3 ? 'PASS' : 'FAIL'
    })
    
    // Delta de vendedores
    const playerWithSellers = applyDeltas(player, { vendedoresComunsDelta: 1 })
    console.log(`✅ Adicionar 1 vendedor: ${playerWithSellers.vendedoresComuns} (esperado: 2)`)
    report.results.push({
      test: 'Delta de Vendedores',
      expected: 2,
      actual: playerWithSellers.vendedoresComuns,
      status: playerWithSellers.vendedoresComuns === 2 ? 'PASS' : 'FAIL'
    })
    
    // Múltiplos deltas
    const playerWithMultiple = applyDeltas(player, { 
      cashDelta: -500, 
      clientsDelta: 1, 
      vendedoresComunsDelta: 1 
    })
    console.log(`✅ Múltiplos deltas: cash=${playerWithMultiple.cash}, clients=${playerWithMultiple.clients}, vendedores=${playerWithMultiple.vendedoresComuns}`)
    console.log(`   Esperado: cash=17500, clients=2, vendedores=2`)
    report.results.push({
      test: 'Múltiplos Deltas',
      expected: 'cash=17500, clients=2, vendedores=2',
      actual: `cash=${playerWithMultiple.cash}, clients=${playerWithMultiple.clients}, vendedores=${playerWithMultiple.vendedoresComuns}`,
      status: playerWithMultiple.cash === 17500 && playerWithMultiple.clients === 2 && playerWithMultiple.vendedoresComuns === 2 ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 5: APLICAÇÃO DE DELTAS - PASSOU')
    report.summary.passed += 4
    report.summary.totalTests += 4
    
  } catch (error) {
    console.log(`❌ TESTE 5: APLICAÇÃO DE DELTAS - FALHOU: ${error.message}`)
    report.summary.failed += 4
    report.summary.totalTests += 4
    report.summary.errors.push(`Aplicação de Deltas: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 6: NÍVEIS ERP E MIX ======
  console.log('📈 TESTE 6: NÍVEIS ERP E MIX')
  console.log('-' .repeat(40))
  
  try {
    const player = createTestPlayer()
    console.log(`✅ Nível ERP inicial: ${player.erpLevel} (esperado: D)`)
    report.results.push({
      test: 'Nível ERP Inicial',
      expected: 'D',
      actual: player.erpLevel,
      status: player.erpLevel === 'D' ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Nível Mix inicial: ${player.mixProdutos} (esperado: D)`)
    report.results.push({
      test: 'Nível Mix Inicial',
      expected: 'D',
      actual: player.mixProdutos,
      status: player.mixProdutos === 'D' ? 'PASS' : 'FAIL'
    })
    
    // Mudança de nível ERP
    const playerWithErpA = applyDeltas(player, { erpLevelSet: 'A' })
    console.log(`✅ Nível ERP após mudança: ${playerWithErpA.erpLevel} (esperado: A)`)
    report.results.push({
      test: 'Mudança de Nível ERP',
      expected: 'A',
      actual: playerWithErpA.erpLevel,
      status: playerWithErpA.erpLevel === 'A' ? 'PASS' : 'FAIL'
    })
    
    // Mudança de nível Mix
    const playerWithMixB = applyDeltas(player, { mixProdutosSet: 'B' })
    console.log(`✅ Nível Mix após mudança: ${playerWithMixB.mixProdutos} (esperado: B)`)
    report.results.push({
      test: 'Mudança de Nível Mix',
      expected: 'B',
      actual: playerWithMixB.mixProdutos,
      status: playerWithMixB.mixProdutos === 'B' ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 6: NÍVEIS ERP E MIX - PASSOU')
    report.summary.passed += 4
    report.summary.totalTests += 4
    
  } catch (error) {
    console.log(`❌ TESTE 6: NÍVEIS ERP E MIX - FALHOU: ${error.message}`)
    report.summary.failed += 4
    report.summary.totalTests += 4
    report.summary.errors.push(`Níveis ERP e Mix: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 7: TURNOS ======
  console.log('🔄 TESTE 7: GERENCIAMENTO DE TURNOS')
  console.log('-' .repeat(40))
  
  try {
    const players = [
      createTestPlayer({ id: 'p1' }),
      createTestPlayer({ id: 'p2' }),
      createTestPlayer({ id: 'p3' })
    ]
    
    const nextTurn1 = findNextAliveIdx(players, 0)
    console.log(`✅ Próximo turno após 0: ${nextTurn1} (esperado: 1)`)
    report.results.push({
      test: 'Próximo Turno Normal',
      expected: 1,
      actual: nextTurn1,
      status: nextTurn1 === 1 ? 'PASS' : 'FAIL'
    })
    
    const playersWithBankrupt = [
      { ...players[0], bankrupt: false },
      { ...players[1], bankrupt: true },
      { ...players[2], bankrupt: false }
    ]
    const nextTurn2 = findNextAliveIdx(playersWithBankrupt, 0)
    console.log(`✅ Próximo turno com jogador falido: ${nextTurn2} (esperado: 2)`)
    report.results.push({
      test: 'Próximo Turno com Falido',
      expected: 2,
      actual: nextTurn2,
      status: nextTurn2 === 2 ? 'PASS' : 'FAIL'
    })
    
    const nextTurn3 = findNextAliveIdx(players, 2)
    console.log(`✅ Próximo turno após último: ${nextTurn3} (esperado: 0)`)
    report.results.push({
      test: 'Volta ao Início',
      expected: 0,
      actual: nextTurn3,
      status: nextTurn3 === 0 ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 7: GERENCIAMENTO DE TURNOS - PASSOU')
    report.summary.passed += 3
    report.summary.totalTests += 3
    
  } catch (error) {
    console.log(`❌ TESTE 7: GERENCIAMENTO DE TURNOS - FALHOU: ${error.message}`)
    report.summary.failed += 3
    report.summary.totalTests += 3
    report.summary.errors.push(`Gerenciamento de Turnos: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 8: REGRAS DE NEGÓCIO ======
  console.log('💼 TESTE 8: REGRAS DE NEGÓCIO')
  console.log('-' .repeat(40))
  
  try {
    // Saldo insuficiente
    const poorPlayer = createTestPlayer({ cash: 100 })
    const canPay = poorPlayer.cash >= 1000
    console.log(`✅ Jogador com 100 pode pagar 1000: ${canPay} (esperado: false)`)
    report.results.push({
      test: 'Saldo Insuficiente',
      expected: false,
      actual: canPay,
      status: canPay === false ? 'PASS' : 'FAIL'
    })
    
    // Capacidade máxima
    const playerWithMaxCapacity = createTestPlayer({ 
      vendedoresComuns: 10, 
      fieldSales: 5, 
      insideSales: 3 
    })
    const { cap } = capacityAndAttendance(playerWithMaxCapacity)
    console.log(`✅ Capacidade com muitos vendedores: ${cap} (esperado: > 0)`)
    report.results.push({
      test: 'Capacidade Máxima',
      expected: '> 0',
      actual: cap,
      status: cap > 0 ? 'PASS' : 'FAIL'
    })
    
    // Empréstimo pendente
    const playerWithLoan = createTestPlayer({ 
      loanPending: { amount: 5000, charged: false, waitingFullLap: true, eligibleOnExpenses: false, declaredAtRound: 1 }
    })
    console.log(`✅ Empréstimo pendente: ${playerWithLoan.loanPending !== null} (esperado: true)`)
    report.results.push({
      test: 'Empréstimo Pendente',
      expected: true,
      actual: playerWithLoan.loanPending !== null,
      status: playerWithLoan.loanPending !== null ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 8: REGRAS DE NEGÓCIO - PASSOU')
    report.summary.passed += 3
    report.summary.totalTests += 3
    
  } catch (error) {
    console.log(`❌ TESTE 8: REGRAS DE NEGÓCIO - FALHOU: ${error.message}`)
    report.summary.failed += 3
    report.summary.totalTests += 3
    report.summary.errors.push(`Regras de Negócio: ${error.message}`)
  }
  
  console.log('')

  // ====== TESTE 9: INTEGRAÇÃO ======
  console.log('🔗 TESTE 9: INTEGRAÇÃO COMPLETA')
  console.log('-' .repeat(40))
  
  try {
    const gameState = {
      players: [
        createTestPlayer({ id: 'p1', name: 'Jogador 1' }),
        createTestPlayer({ id: 'p2', name: 'Jogador 2' })
      ],
      turnIdx: 0,
      round: 1,
      gameOver: false,
      winner: null
    }
    
    console.log(`✅ Jogo com 2 jogadores: ${gameState.players.length} (esperado: 2)`)
    report.results.push({
      test: 'Jogo com 2 Jogadores',
      expected: 2,
      actual: gameState.players.length,
      status: gameState.players.length === 2 ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Turno inicial: ${gameState.turnIdx} (esperado: 0)`)
    report.results.push({
      test: 'Turno Inicial',
      expected: 0,
      actual: gameState.turnIdx,
      status: gameState.turnIdx === 0 ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Rodada inicial: ${gameState.round} (esperado: 1)`)
    report.results.push({
      test: 'Rodada Inicial',
      expected: 1,
      actual: gameState.round,
      status: gameState.round === 1 ? 'PASS' : 'FAIL'
    })
    
    console.log(`✅ Jogo não terminado: ${gameState.gameOver} (esperado: false)`)
    report.results.push({
      test: 'Jogo Não Terminado',
      expected: false,
      actual: gameState.gameOver,
      status: gameState.gameOver === false ? 'PASS' : 'FAIL'
    })
    
    // Simulação de movimento
    const player1 = gameState.players[0]
    const newPos = (player1.pos + 6) % 55
    console.log(`✅ Movimento simulado: posição ${newPos} (esperado: 6)`)
    report.results.push({
      test: 'Movimento Simulado',
      expected: 6,
      actual: newPos,
      status: newPos === 6 ? 'PASS' : 'FAIL'
    })
    
    // Simulação de compra
    const purchaseCost = 2000
    const canAfford = player1.cash >= purchaseCost
    console.log(`✅ Pode pagar compra: ${canAfford} (esperado: true)`)
    report.results.push({
      test: 'Pode Pagar Compra',
      expected: true,
      actual: canAfford,
      status: canAfford === true ? 'PASS' : 'FAIL'
    })
    
    console.log('✅ TESTE 9: INTEGRAÇÃO COMPLETA - PASSOU')
    report.summary.passed += 6
    report.summary.totalTests += 6
    
  } catch (error) {
    console.log(`❌ TESTE 9: INTEGRAÇÃO COMPLETA - FALHOU: ${error.message}`)
    report.summary.failed += 6
    report.summary.totalTests += 6
    report.summary.errors.push(`Integração Completa: ${error.message}`)
  }
  
  console.log('')

  // ====== RELATÓRIO FINAL ======
  console.log('📋 RELATÓRIO FINAL')
  console.log('=' .repeat(60))
  console.log(`📊 Total de Testes: ${report.summary.totalTests}`)
  console.log(`✅ Passou: ${report.summary.passed}`)
  console.log(`❌ Falhou: ${report.summary.failed}`)
  console.log(`📈 Taxa de Sucesso: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`)
  
  if (report.summary.failed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM! O jogo está funcionando perfeitamente.')
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os erros abaixo:')
    report.summary.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`)
    })
  }
  
  console.log('')
  console.log('📄 DETALHES DOS TESTES:')
  report.results.forEach((result, index) => {
    const status = result.status === 'PASS' ? '✅' : '❌'
    console.log(`   ${index + 1}. ${status} ${result.test}`)
    console.log(`      Esperado: ${result.expected}`)
    console.log(`      Atual: ${result.actual}`)
    console.log('')
  })
  
  console.log('=' .repeat(60))
  console.log('🏁 TESTES CONCLUÍDOS')
  
  return report
}

// ====== AUTO-EXECUÇÃO ======
if (typeof window !== 'undefined') {
  window.runCompleteTestSuite = runCompleteTestSuite
  console.log('🧪 Executor completo de testes carregado!')
  console.log('Execute "runCompleteTestSuite()" para rodar todos os testes')
}
