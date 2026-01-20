// src/game/__tests__/runValidationTests.js
/**
 * Script para executar testes de validação das regras de negócio
 * Execute no console do navegador: runValidationTests()
 */

import { validateGame } from '../gameValidator.js'
import { debugMode } from '../debugMode.js'

// Função global para executar testes
window.runValidationTests = function() {
  console.log('🧪 Iniciando testes de validação das regras de negócio...')
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  }

  // Teste 1: Estado inicial válido
  function testInitialState() {
    const players = [{
      id: 'p1',
      name: 'Jogador 1',
      cash: 18000,
      pos: 0,
      clients: 1,
      vendedoresComuns: 1,
      fieldSales: 0,
      insideSales: 0,
      gestores: 0,
      mixProdutos: 'D',
      erpLevel: 'D',
      az: 0,
      am: 0,
      rox: 0,
      bankrupt: false
    }]

    const result = validateGame(players, 0, 1, false, null)
    
    if (result.isValid) {
      console.log('✅ Teste 1: Estado inicial válido')
      results.passed++
    } else {
      console.error('❌ Teste 1: Estado inicial inválido', result.errors)
      results.failed++
    }
    
    results.tests.push({
      name: 'Estado inicial válido',
      passed: result.isValid,
      errors: result.errors
    })
  }

  // Teste 2: Jogador falido
  function testBankruptPlayer() {
    const players = [
      {
        id: 'p1',
        name: 'Jogador 1',
        cash: 0,
        pos: 0,
        clients: 1,
        vendedoresComuns: 1,
        fieldSales: 0,
        insideSales: 0,
        gestores: 0,
        mixProdutos: 'D',
        erpLevel: 'D',
        az: 0,
        am: 0,
        rox: 0,
        bankrupt: true
      },
      {
        id: 'p2',
        name: 'Jogador 2',
        cash: 18000,
        pos: 0,
        clients: 1,
        vendedoresComuns: 1,
        fieldSales: 0,
        insideSales: 0,
        gestores: 0,
        mixProdutos: 'D',
        erpLevel: 'D',
        az: 0,
        am: 0,
        rox: 0,
        bankrupt: false
      }
    ]

    const result = validateGame(players, 1, 1, false, null)
    
    if (result.isValid) {
      console.log('✅ Teste 2: Jogador falido válido')
      results.passed++
    } else {
      console.error('❌ Teste 2: Jogador falido inválido', result.errors)
      results.failed++
    }
    
    results.tests.push({
      name: 'Jogador falido válido',
      passed: result.isValid,
      errors: result.errors
    })
  }

  // Teste 3: Fim de jogo com vencedor
  function testGameOverWithWinner() {
    const players = [
      {
        id: 'p1',
        name: 'Jogador 1',
        cash: 50000,
        pos: 0,
        clients: 10,
        vendedoresComuns: 5,
        fieldSales: 2,
        insideSales: 1,
        gestores: 1,
        mixProdutos: 'A',
        erpLevel: 'A',
        az: 2,
        am: 1,
        rox: 1,
        bankrupt: false
      },
      {
        id: 'p2',
        name: 'Jogador 2',
        cash: 30000,
        pos: 0,
        clients: 5,
        vendedoresComuns: 3,
        fieldSales: 1,
        insideSales: 0,
        gestores: 0,
        mixProdutos: 'B',
        erpLevel: 'B',
        az: 1,
        am: 0,
        rox: 0,
        bankrupt: false
      }
    ]

    const winner = players[0]
    const result = validateGame(players, 0, 5, true, winner)
    
    if (result.isValid) {
      console.log('✅ Teste 3: Fim de jogo com vencedor válido')
      results.passed++
    } else {
      console.error('❌ Teste 3: Fim de jogo com vencedor inválido', result.errors)
      results.failed++
    }
    
    results.tests.push({
      name: 'Fim de jogo com vencedor válido',
      passed: result.isValid,
      errors: result.errors
    })
  }

  // Teste 4: Estado inválido (jogador com cash negativo)
  function testInvalidState() {
    const players = [{
      id: 'p1',
      name: 'Jogador 1',
      cash: -1000, // Inválido!
      pos: 0,
      clients: 1,
      vendedoresComuns: 1,
      fieldSales: 0,
      insideSales: 0,
      gestores: 0,
      mixProdutos: 'D',
      erpLevel: 'D',
      az: 0,
      am: 0,
      rox: 0,
      bankrupt: false
    }]

    const result = validateGame(players, 0, 1, false, null)
    
    if (!result.isValid && result.errors.some(e => e.includes('Cash deve ser um número não negativo'))) {
      console.log('✅ Teste 4: Estado inválido detectado corretamente')
      results.passed++
    } else {
      console.error('❌ Teste 4: Estado inválido não detectado', result.errors)
      results.failed++
    }
    
    results.tests.push({
      name: 'Estado inválido detectado corretamente',
      passed: !result.isValid,
      errors: result.errors
    })
  }

  // Teste 5: TurnIdx inválido
  function testInvalidTurnIdx() {
    const players = [{
      id: 'p1',
      name: 'Jogador 1',
      cash: 18000,
      pos: 0,
      clients: 1,
      vendedoresComuns: 1,
      fieldSales: 0,
      insideSales: 0,
      gestores: 0,
      mixProdutos: 'D',
      erpLevel: 'D',
      az: 0,
      am: 0,
      rox: 0,
      bankrupt: false
    }]

    const result = validateGame(players, 5, 1, false, null) // turnIdx inválido
    
    if (!result.isValid && result.errors.some(e => e.includes('TurnIdx inválido'))) {
      console.log('✅ Teste 5: TurnIdx inválido detectado corretamente')
      results.passed++
    } else {
      console.error('❌ Teste 5: TurnIdx inválido não detectado', result.errors)
      results.failed++
    }
    
    results.tests.push({
      name: 'TurnIdx inválido detectado corretamente',
      passed: !result.isValid,
      errors: result.errors
    })
  }

  // Executar todos os testes
  testInitialState()
  testBankruptPlayer()
  testGameOverWithWinner()
  testInvalidState()
  testInvalidTurnIdx()

  // Relatório final
  console.log('\n📊 Relatório de Testes:')
  console.log(`✅ Passou: ${results.passed}`)
  console.log(`❌ Falhou: ${results.failed}`)
  console.log(`📈 Taxa de sucesso: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`)
  
  console.log('\n📋 Detalhes dos Testes:')
  results.tests.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}: ${test.passed ? '✅' : '❌'}`)
    if (!test.passed && test.errors.length > 0) {
      console.log(`   Erros: ${test.errors.join(', ')}`)
    }
  })

  return results
}

// Função para testar regras específicas
window.testSpecificRules = function() {
  console.log('🔍 Testando regras específicas...')
  
  // Teste de manutenção inicial
  const { computeDespesasFor } = require('../gameMath.js')
  const initialPlayer = {
    vendedoresComuns: 1,
    clients: 1,
    fieldSales: 0,
    insideSales: 0,
    gestores: 0,
    mixProdutos: 'D',
    erpLevel: 'D',
    az: 0,
    am: 0,
    rox: 0
  }
  
  const manutencao = computeDespesasFor(initialPlayer)
  console.log(`Manutenção inicial: ${manutencao} (esperado: 2100)`)
  
  if (manutencao === 2100) {
    console.log('✅ Regra de manutenção inicial correta')
  } else {
    console.log('❌ Regra de manutenção inicial incorreta')
  }
  
  // Teste de faturamento inicial
  const { computeFaturamentoFor } = require('../gameMath.js')
  const faturamento = computeFaturamentoFor(initialPlayer)
  console.log(`Faturamento inicial: ${faturamento} (esperado: 770)`)
  
  if (faturamento === 770) {
    console.log('✅ Regra de faturamento inicial correta')
  } else {
    console.log('❌ Regra de faturamento inicial incorreta')
  }
}

// Função para ativar modo debug
window.enableDebugMode = function() {
  debugMode.toggle()
  console.log('🐛 Modo debug ativado! Verifique o painel de debug no jogo.')
}

console.log('🧪 Testes de validação carregados!')
console.log('Execute: runValidationTests() - para rodar todos os testes')
console.log('Execute: testSpecificRules() - para testar regras específicas')
console.log('Execute: enableDebugMode() - para ativar modo debug')
