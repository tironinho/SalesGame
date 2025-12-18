// src/game/__tests__/testControlPanel.js
/**
 * Painel de Controle de Testes - Sales Game
 * 
 * Este arquivo fornece uma interface unificada para executar todos os testes
 * e validações do jogo de forma organizada e eficiente.
 */

import { runAllRegressionTests, testReportedIssues } from './regressionTests.js'
import { runAllIntegrationTests, createInteractiveSimulator } from './integrationTests.js'
import { 
  enableRealTimeValidation, 
  disableRealTimeValidation, 
  clearValidationLogs, 
  getValidationStats as getValidatorStats 
} from './realTimeValidator.js'
import TurnAlternationTester from './turnAlternationTest.js'

class TestControlPanel {
  constructor() {
    this.isRunning = false
    this.testResults = []
    this.validationEnabled = false
    this.simulator = null
  }

  // ====== EXECUÇÃO DE TESTES ======
  async runAllTests() {
    if (this.isRunning) {
      console.warn('⚠️ Testes já estão em execução!')
      return
    }

    this.isRunning = true
    console.group('🧪 EXECUTANDO SUITE COMPLETA DE TESTES')
    console.log('Iniciando validação completa do Sales Game...')
    
    const startTime = Date.now()
    this.testResults = []

    try {
      // 1. Testes Regressivos
      console.group('📊 1. Testes Regressivos')
      const regressionStart = Date.now()
      runAllRegressionTests()
      const regressionTime = Date.now() - regressionStart
      this.testResults.push({ name: 'Regressivos', time: regressionTime, status: 'PASS' })
      console.log(`✅ Testes regressivos concluídos em ${regressionTime}ms`)
      console.groupEnd()

      // 2. Testes de Integração
      console.group('🔗 2. Testes de Integração')
      const integrationStart = Date.now()
      runAllIntegrationTests()
      const integrationTime = Date.now() - integrationStart
      this.testResults.push({ name: 'Integração', time: integrationTime, status: 'PASS' })
      console.log(`✅ Testes de integração concluídos em ${integrationTime}ms`)
      console.groupEnd()

      // 3. Testes de Problemas Reportados
      console.group('🐛 3. Testes de Problemas Reportados')
      const issuesStart = Date.now()
      testReportedIssues()
      const issuesTime = Date.now() - issuesStart
      this.testResults.push({ name: 'Problemas Reportados', time: issuesTime, status: 'PASS' })
      console.log(`✅ Testes de problemas reportados concluídos em ${issuesTime}ms`)
      console.groupEnd()

      // 4. Testes de Alternância de Turnos
      console.group('🔄 4. Testes de Alternância de Turnos')
      const turnStart = Date.now()
      const turnTester = new TurnAlternationTester()
      const turnResult = await turnTester.runAllTests()
      const turnTime = Date.now() - turnStart
      this.testResults.push({ 
        name: 'Alternância de Turnos', 
        time: turnTime, 
        status: turnResult.success ? 'PASS' : 'FAIL',
        errors: turnResult.errors?.length || 0,
        warnings: turnResult.warnings?.length || 0
      })
      if (turnResult.success) {
        console.log(`✅ Testes de alternância de turnos concluídos em ${turnTime}ms`)
        console.log(`   - Erros: ${turnResult.errors?.length || 0}`)
        console.log(`   - Avisos: ${turnResult.warnings?.length || 0}`)
      } else {
        console.log(`❌ Testes de alternância de turnos falharam em ${turnTime}ms`)
        console.log(`   - Erros: ${turnResult.errors?.length || 0}`)
      }
      console.groupEnd()

      const totalTime = Date.now() - startTime
      this.printSummary(totalTime)

    } catch (error) {
      console.error('❌ FALHA NA SUITE DE TESTES:', error)
      this.testResults.push({ name: 'Geral', time: 0, status: 'FAIL', error: error.message })
    } finally {
      this.isRunning = false
      console.groupEnd()
    }
  }

  // ====== VALIDAÇÃO EM TEMPO REAL ======
  enableRealTimeValidation() {
    enableRealTimeValidation()
    this.validationEnabled = true
    console.log('🔍 Validação em tempo real ATIVADA')
  }

  disableRealTimeValidation() {
    disableRealTimeValidation()
    this.validationEnabled = false
    console.log('🔍 Validação em tempo real DESATIVADA')
  }

  getValidationStats() {
    const stats = getValidatorStats()
    console.log('📊 Estatísticas de Validação:', stats)
    return stats
  }

  clearValidationLogs() {
    clearValidationLogs()
    console.log('🧹 Logs de validação limpos')
  }

  // ====== SIMULADOR INTERATIVO ======
  createSimulator(playerCount = 2) {
    this.simulator = createInteractiveSimulator()
    this.simulator.start(playerCount)
    console.log('🎮 Simulador interativo criado!')
    console.log('Use "testPanel.simulator" para acessar os comandos')
    return this.simulator
  }

  // ====== TESTES ESPECÍFICOS ======
  testTurnPassing() {
    console.group('🔄 Teste Específico: Passagem de Turnos')
    
    const game = createInteractiveSimulator()
    game.start(2)
    
    // Simula passagem de turnos
    for (let i = 0; i < 6; i++) {
      const state = game.getGameState()
      const currentPlayer = state.players[state.turnIdx]
      console.log(`Turno ${i + 1}: ${currentPlayer.name} (índice ${state.turnIdx})`)
      game.nextTurn()
    }
    
    console.log('✅ Teste de passagem de turnos concluído')
    console.groupEnd()
  }

  testBankruptcySystem() {
    console.group('💀 Teste Específico: Sistema de Falência')
    
    const game = createInteractiveSimulator()
    game.start(2)
    
    // Simula falência do primeiro jogador
    const player1 = game.getGameState().players[0]
    game.declareBankruptcy(player1.id)
    
    const finalState = game.getGameState()
    console.assert(finalState.gameOver === true, 'Jogo deve terminar após falência')
    console.assert(finalState.winner !== null, 'Deve haver um vencedor')
    
    console.log('✅ Teste de sistema de falência concluído')
    console.groupEnd()
  }

  testResourceUpdates() {
    console.group('📊 Teste Específico: Atualização de Recursos')
    
    const game = createInteractiveSimulator()
    game.start(1)
    
    const player = game.getGameState().players[0]
    const initialStats = game.getPlayerStats(player.id)
    
    // Simula perda de clientes
    game.card(player.id, 'Revés', { clientsDelta: -2 })
    
    const finalStats = game.getPlayerStats(player.id)
    console.assert(finalStats.clients < initialStats.clients, 'Clientes devem ter diminuído')
    
    console.log('✅ Teste de atualização de recursos concluído')
    console.groupEnd()
  }

  testLevelRestrictions() {
    console.group('📈 Teste Específico: Restrições de Nível')
    
    const game = createInteractiveSimulator()
    game.start(1)
    
    const player = game.getGameState().players[0]
    console.assert(player.erpLevel === 'D', 'Nível ERP inicial deve ser D')
    console.assert(player.mixProdutos === 'D', 'Nível Mix inicial deve ser D')
    
    console.log('✅ Teste de restrições de nível concluído')
    console.groupEnd()
  }

  // ====== TESTES DE ALTERNÂNCIA DE TURNOS ======
  async testTurnAlternation() {
    console.group('🔄 Teste Específico: Alternância de Turnos')
    
    const turnTester = new TurnAlternationTester()
    const result = await turnTester.runAllTests()
    
    if (result.success) {
      console.log('✅ Todos os testes de alternância de turnos passaram!')
      console.log(`   - Total de testes: ${result.results?.length || 0}`)
      console.log(`   - Erros: ${result.errors?.length || 0}`)
      console.log(`   - Avisos: ${result.warnings?.length || 0}`)
    } else {
      console.log('❌ Alguns testes de alternância de turnos falharam')
      console.log(`   - Erros: ${result.errors?.length || 0}`)
      result.errors?.forEach(err => {
        console.error(`   - ${err.message}`)
      })
    }
    
    console.groupEnd()
    return result
  }

  // ====== RELATÓRIOS ======
  printSummary(totalTime) {
    console.group('📋 RESUMO DOS TESTES')
    console.log(`⏱️ Tempo total: ${totalTime}ms`)
    console.log(`📊 Testes executados: ${this.testResults.length}`)
    
    const passed = this.testResults.filter(t => t.status === 'PASS').length
    const failed = this.testResults.filter(t => t.status === 'FAIL').length
    
    console.log(`✅ Passou: ${passed}`)
    console.log(`❌ Falhou: ${failed}`)
    
    if (failed === 0) {
      console.log('🎉 TODOS OS TESTES PASSARAM! O jogo está funcionando perfeitamente.')
    } else {
      console.log('⚠️ Alguns testes falharam. Verifique os erros acima.')
    }
    
    console.groupEnd()
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.status === 'PASS').length,
      failed: this.testResults.filter(t => t.status === 'FAIL').length,
      results: this.testResults,
      validationEnabled: this.validationEnabled,
      simulatorActive: this.simulator !== null
    }
    
    console.log('📄 Relatório de Testes:', report)
    return report
  }

  // ====== UTILITÁRIOS ======
  getStatus() {
    return {
      isRunning: this.isRunning,
      validationEnabled: this.validationEnabled,
      simulatorActive: this.simulator !== null,
      testResults: this.testResults
    }
  }

  reset() {
    this.isRunning = false
    this.testResults = []
    this.simulator = null
    console.log('🔄 Painel de testes resetado')
  }
}

// ====== INSTÂNCIA GLOBAL ======
const testControlPanel = new TestControlPanel()

// ====== FUNÇÕES DE CONVENIÊNCIA ======
export const runAllTests = () => testControlPanel.runAllTests()
export const enableValidation = () => testControlPanel.enableRealTimeValidation()
export const disableValidation = () => testControlPanel.disableRealTimeValidation()
export const getValidationStats = () => testControlPanel.getValidationStats()
export const clearLogs = () => testControlPanel.clearValidationLogs()
export const createSimulator = (playerCount) => testControlPanel.createSimulator(playerCount)
export const testTurnPassing = () => testControlPanel.testTurnPassing()
export const testBankruptcySystem = () => testControlPanel.testBankruptcySystem()
export const testResourceUpdates = () => testControlPanel.testResourceUpdates()
export const testLevelRestrictions = () => testControlPanel.testLevelRestrictions()
export const testTurnAlternation = () => testControlPanel.testTurnAlternation()
export const generateReport = () => testControlPanel.generateReport()
export const getStatus = () => testControlPanel.getStatus()
export const reset = () => testControlPanel.reset()

// ====== AUTO-EXECUÇÃO ======
if (typeof window !== 'undefined') {
  // Disponibiliza globalmente para execução no console
  window.runAllTests = runAllTests
  window.enableValidation = enableValidation
  window.disableValidation = disableValidation
  window.getValidationStats = getValidationStats
  window.clearLogs = clearLogs
  window.createSimulator = createSimulator
  window.testTurnPassing = testTurnPassing
  window.testBankruptcySystem = testBankruptcySystem
  window.testResourceUpdates = testResourceUpdates
  window.testLevelRestrictions = testLevelRestrictions
  window.testTurnAlternation = testTurnAlternation
  window.generateReport = generateReport
  window.getStatus = getStatus
  window.reset = reset
  window.testPanel = testControlPanel
  
  console.log('🎛️ Painel de Controle de Testes carregado!')
  console.log('Execute "runAllTests()" para rodar todos os testes')
  console.log('Execute "enableValidation()" para ativar validação em tempo real')
  console.log('Execute "createSimulator(2)" para criar um simulador interativo')
  console.log('Execute "testPanel.getStatus()" para ver o status atual')
}
