// src/game/__tests__/index.js
/**
 * Índice de Testes - Sales Game
 * 
 * Este arquivo carrega todos os testes e validações do jogo
 * e os disponibiliza globalmente para execução no console.
 */

// ====== IMPORTAÇÕES ======
import './regressionTests.js'
import './integrationTests.js'
import './realTimeValidator.js'
import './testControlPanel.js'
import TurnAlternationTester from './turnAlternationTest.js'

// ====== INICIALIZAÇÃO ======
if (typeof window !== 'undefined') {
  // Disponibiliza TurnAlternationTester globalmente
  window.TurnAlternationTester = TurnAlternationTester
  
  console.log('🧪 Sistema de Testes Sales Game carregado!')
  console.log('')
  console.log('📋 COMANDOS DISPONÍVEIS:')
  console.log('')
  console.log('🎛️ PAINEL PRINCIPAL:')
  console.log('  runAllTests()           - Executa todos os testes')
  console.log('  enableValidation()      - Ativa validação em tempo real')
  console.log('  disableValidation()     - Desativa validação em tempo real')
  console.log('  getValidationStats()    - Mostra estatísticas de validação')
  console.log('  clearLogs()            - Limpa logs de validação')
  console.log('  generateReport()       - Gera relatório completo')
  console.log('  getStatus()            - Mostra status atual')
  console.log('  reset()                - Reseta painel de testes')
  console.log('')
  console.log('🔄 TESTES DE ALTERNÂNCIA DE TURNOS:')
  console.log('  const turnTester = new TurnAlternationTester()')
  console.log('  turnTester.runAllTests() - Executa todos os testes de turnos')
  console.log('  turnTester.testBasicTurnAlternation() - Testa alternância básica')
  console.log('  turnTester.testAllBoardSpaces() - Verifica todas as casas')
  console.log('  turnTester.testButtonNotLockedForBothPlayers() - Testa botão')
  console.log('')
  console.log('🎮 SIMULADOR INTERATIVO:')
  console.log('  createSimulator(2)     - Cria simulador com 2 jogadores')
  console.log('  testPanel.simulator    - Acessa comandos do simulador')
  console.log('')
  console.log('🧪 TESTES ESPECÍFICOS:')
  console.log('  testTurnPassing()      - Testa passagem de turnos')
  console.log('  testBankruptcySystem() - Testa sistema de falência')
  console.log('  testResourceUpdates()  - Testa atualização de recursos')
  console.log('  testLevelRestrictions() - Testa restrições de nível')
  console.log('')
  console.log('📊 TESTES INDIVIDUAIS:')
  console.log('  runRegressionTests()   - Testes regressivos')
  console.log('  runIntegrationTests()  - Testes de integração')
  console.log('  testReportedIssues()   - Testa problemas reportados')
  console.log('')
  console.log('🚀 EXECUTE "runAllTests()" PARA COMEÇAR!')
  console.log('')
}
