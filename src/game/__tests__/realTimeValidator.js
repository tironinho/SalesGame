// src/game/__tests__/realTimeValidator.js
/**
 * Validador em Tempo Real - Sales Game
 * 
 * Este arquivo monitora o jogo em tempo real e valida todas as ações
 * para garantir que as regras de negócio estão sendo seguidas corretamente.
 */

import { 
  computeFaturamentoFor, 
  computeDespesasFor, 
  capacityAndAttendance,
  countAlivePlayers,
  findNextAliveIdx,
  hasBlue,
  hasYellow,
  hasPurple
} from '../gameMath.js'

class RealTimeValidator {
  constructor() {
    this.errors = []
    this.warnings = []
    this.validationCount = 0
    this.isEnabled = false
  }

  // ====== VALIDAÇÕES BÁSICAS ======
  validatePlayerState(player, context = '') {
    const errors = []
    const warnings = []

    // Validação 1: Saldo não pode ser negativo
    if (player.cash < 0) {
      errors.push(`❌ Saldo negativo: ${player.cash} (${context})`)
    }

    // Validação 2: Recursos não podem ser negativos
    if (player.clients < 0) {
      errors.push(`❌ Clientes negativos: ${player.clients} (${context})`)
    }
    if (player.vendedoresComuns < 0) {
      errors.push(`❌ Vendedores comuns negativos: ${player.vendedoresComuns} (${context})`)
    }
    if (player.fieldSales < 0) {
      errors.push(`❌ Field sales negativos: ${player.fieldSales} (${context})`)
    }
    if (player.insideSales < 0) {
      errors.push(`❌ Inside sales negativos: ${player.insideSales} (${context})`)
    }

    // Validação 3: Níveis válidos
    const validErpLevels = ['A', 'B', 'C', 'D']
    if (!validErpLevels.includes(player.erpLevel)) {
      errors.push(`❌ Nível ERP inválido: ${player.erpLevel} (${context})`)
    }

    const validMixLevels = ['A', 'B', 'C', 'D']
    if (!validMixLevels.includes(player.mixProdutos)) {
      errors.push(`❌ Nível Mix inválido: ${player.mixProdutos} (${context})`)
    }

    // Validação 4: Posição válida
    if (player.pos < 0 || player.pos >= 55) {
      errors.push(`❌ Posição inválida: ${player.pos} (deve estar entre 0 e 54) (${context})`)
    }

    // Validação 5: Certificados não podem ser negativos
    if (player.az < 0 || player.am < 0 || player.rox < 0) {
      errors.push(`❌ Certificados negativos: az=${player.az}, am=${player.am}, rox=${player.rox} (${context})`)
    }

    // Validação 6: Capacidade vs Atendimento
    const { cap, inAtt } = capacityAndAttendance(player)
    if (inAtt > cap) {
      warnings.push(`⚠️ Atendimento (${inAtt}) maior que capacidade (${cap}) (${context})`)
    }

    // Validação 7: Cálculos de faturamento e despesas
    const faturamento = computeFaturamentoFor(player)
    const despesas = computeDespesasFor(player)
    
    if (faturamento < 0) {
      errors.push(`❌ Faturamento negativo: ${faturamento} (${context})`)
    }
    if (despesas < 0) {
      errors.push(`❌ Despesas negativas: ${despesas} (${context})`)
    }

    this.errors.push(...errors)
    this.warnings.push(...warnings)

    return { errors, warnings }
  }

  // ====== VALIDAÇÕES DE TURNO ======
  validateTurnState(players, turnIdx, context = '') {
    const errors = []
    const warnings = []

    // Validação 1: turnIdx válido
    if (turnIdx < 0 || turnIdx >= players.length) {
      errors.push(`❌ turnIdx inválido: ${turnIdx} (deve estar entre 0 e ${players.length - 1}) (${context})`)
    }

    // Validação 2: Jogador do turno deve existir
    const currentPlayer = players[turnIdx]
    if (!currentPlayer) {
      errors.push(`❌ Jogador do turno não existe: índice ${turnIdx} (${context})`)
    }

    // Validação 3: Jogador do turno não deve estar falido
    if (currentPlayer && currentPlayer.bankrupt) {
      errors.push(`❌ Jogador do turno está falido: ${currentPlayer.name} (${context})`)
    }

    // Validação 4: Deve haver pelo menos um jogador vivo
    const aliveCount = countAlivePlayers(players)
    if (aliveCount === 0) {
      errors.push(`❌ Nenhum jogador vivo restante (${context})`)
    }

    // Validação 5: Próximo jogador deve existir
    if (aliveCount > 1) {
      const nextPlayerIdx = findNextAliveIdx(players, turnIdx)
      const nextPlayer = players[nextPlayerIdx]
      if (!nextPlayer || nextPlayer.bankrupt) {
        errors.push(`❌ Próximo jogador inválido: índice ${nextPlayerIdx} (${context})`)
      }
    }

    this.errors.push(...errors)
    this.warnings.push(...warnings)

    return { errors, warnings }
  }

  // ====== VALIDAÇÕES DE AÇÃO ======
  validateAction(action, player, gameState, context = '') {
    const errors = []
    const warnings = []

    // Validação 1: Ação deve ser válida
    const validActions = ['ROLL_DICE', 'BUY', 'DONT_BUY', 'BANKRUPT', 'RECOVERY']
    if (!validActions.includes(action)) {
      errors.push(`❌ Ação inválida: ${action} (${context})`)
    }

    // Validação 2: Jogador deve estar vivo para ações normais
    if (action !== 'BANKRUPT' && player.bankrupt) {
      errors.push(`❌ Jogador falido não pode executar ação: ${action} (${context})`)
    }

    // Validação 3: Validação de compra
    if (action === 'BUY') {
      // Esta validação seria expandida com base no tipo de compra
      if (player.cash < 0) {
        errors.push(`❌ Jogador sem saldo não pode comprar (${context})`)
      }
    }

    this.errors.push(...errors)
    this.warnings.push(...warnings)

    return { errors, warnings }
  }

  // ====== VALIDAÇÕES DE SINCRONIZAÇÃO ======
  validateSynchronization(localState, remoteState, context = '') {
    const errors = []
    const warnings = []

    // Validação 1: turnIdx deve ser igual
    if (localState.turnIdx !== remoteState.turnIdx) {
      errors.push(`❌ turnIdx dessincronizado: local=${localState.turnIdx}, remote=${remoteState.turnIdx} (${context})`)
    }

    // Validação 2: round deve ser igual
    if (localState.round !== remoteState.round) {
      errors.push(`❌ round dessincronizado: local=${localState.round}, remote=${remoteState.round} (${context})`)
    }

    // Validação 3: gameOver deve ser igual
    if (localState.gameOver !== remoteState.gameOver) {
      errors.push(`❌ gameOver dessincronizado: local=${localState.gameOver}, remote=${remoteState.gameOver} (${context})`)
    }

    // Validação 4: winner deve ser igual
    if (localState.winner !== remoteState.winner) {
      errors.push(`❌ winner dessincronizado: local=${localState.winner}, remote=${remoteState.winner} (${context})`)
    }

    // Validação 5: Número de jogadores deve ser igual
    if (localState.players.length !== remoteState.players.length) {
      errors.push(`❌ Número de jogadores dessincronizado: local=${localState.players.length}, remote=${remoteState.players.length} (${context})`)
    }

    this.errors.push(...errors)
    this.warnings.push(...warnings)

    return { errors, warnings }
  }

  // ====== VALIDAÇÕES DE REGRAS DE NEGÓCIO ======
  validateBusinessRules(player, action, context = '') {
    const errors = []
    const warnings = []

    // Regra 1: Empréstimo só pode ser tomado uma vez
    if (action === 'TAKE_LOAN' && player.loanPending) {
      errors.push(`❌ Jogador já tem empréstimo pendente (${context})`)
    }

    // Regra 2: Nível D não pode ser comprado (já possui)
    if (action === 'BUY_ERP_LEVEL_D' || action === 'BUY_MIX_LEVEL_D') {
      errors.push(`❌ Nível D não pode ser comprado (já possui) (${context})`)
    }

    // Regra 3: Capacidade máxima de vendedores
    const totalSellers = player.vendedoresComuns + player.fieldSales + player.insideSales
    if (totalSellers > 20) {
      warnings.push(`⚠️ Muitos vendedores: ${totalSellers} (máximo recomendado: 20) (${context})`)
    }

    // Regra 4: Saldo mínimo para continuar
    if (player.cash < 0 && !player.bankrupt) {
      errors.push(`❌ Jogador com saldo negativo deve declarar falência (${context})`)
    }

    this.errors.push(...errors)
    this.warnings.push(...warnings)

    return { errors, warnings }
  }

  // ====== VALIDAÇÃO COMPLETA ======
  validateGameState(players, turnIdx, round, gameOver, winner, context = '') {
    this.validationCount++
    
    console.log(`🔍 [Validação ${this.validationCount}] ${context}`)
    
    // Validação de cada jogador
    players.forEach((player, index) => {
      this.validatePlayerState(player, `Jogador ${index + 1} (${player.name})`)
    })

    // Validação do estado do turno
    this.validateTurnState(players, turnIdx, `Turno ${turnIdx}`)

    // Validação do estado do jogo
    if (gameOver && !winner) {
      this.errors.push(`❌ Jogo terminado mas sem vencedor definido`)
    }

    if (winner && !gameOver) {
      this.warnings.push(`⚠️ Vencedor definido mas jogo não terminado`)
    }

    // Relatório de validação
    this.reportValidation(context)
  }

  // ====== RELATÓRIO DE VALIDAÇÃO ======
  reportValidation(context = '') {
    const totalErrors = this.errors.length
    const totalWarnings = this.warnings.length

    if (totalErrors > 0) {
      console.group(`❌ ERROS ENCONTRADOS (${totalErrors}) - ${context}`)
      this.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error}`)
      })
      console.groupEnd()
    }

    if (totalWarnings > 0) {
      console.group(`⚠️ AVISOS (${totalWarnings}) - ${context}`)
      this.warnings.forEach((warning, index) => {
        console.warn(`${index + 1}. ${warning}`)
      })
      console.groupEnd()
    }

    if (totalErrors === 0 && totalWarnings === 0) {
      console.log(`✅ Validação OK - ${context}`)
    }

    // Limpa erros e avisos para próxima validação
    this.errors = []
    this.warnings = []
  }

  // ====== CONTROLE ======
  enable() {
    this.isEnabled = true
    console.log('🔍 Validador em tempo real ATIVADO')
  }

  disable() {
    this.isEnabled = false
    console.log('🔍 Validador em tempo real DESATIVADO')
  }

  clear() {
    this.errors = []
    this.warnings = []
    this.validationCount = 0
    console.log('🧹 Validador limpo')
  }

  getStats() {
    return {
      validationCount: this.validationCount,
      isEnabled: this.isEnabled,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length
    }
  }
}

// ====== INSTÂNCIA GLOBAL ======
const realTimeValidator = new RealTimeValidator()

// ====== FUNÇÕES DE CONVENIÊNCIA ======
export const validateGameState = (players, turnIdx, round, gameOver, winner, context = '') => {
  if (realTimeValidator.isEnabled) {
    realTimeValidator.validateGameState(players, turnIdx, round, gameOver, winner, context)
  }
}

export const validatePlayerState = (player, context = '') => {
  if (realTimeValidator.isEnabled) {
    return realTimeValidator.validatePlayerState(player, context)
  }
  return { errors: [], warnings: [] }
}

export const validateAction = (action, player, gameState, context = '') => {
  if (realTimeValidator.isEnabled) {
    return realTimeValidator.validateAction(action, player, gameState, context)
  }
  return { errors: [], warnings: [] }
}

export const validateSynchronization = (localState, remoteState, context = '') => {
  if (realTimeValidator.isEnabled) {
    return realTimeValidator.validateSynchronization(localState, remoteState, context)
  }
  return { errors: [], warnings: [] }
}

export const validateBusinessRules = (player, action, context = '') => {
  if (realTimeValidator.isEnabled) {
    return realTimeValidator.validateBusinessRules(player, action, context)
  }
  return { errors: [], warnings: [] }
}

// ====== CONTROLES GLOBAIS ======
export const enableRealTimeValidation = () => realTimeValidator.enable()
export const disableRealTimeValidation = () => realTimeValidator.disable()
export const clearValidationLogs = () => realTimeValidator.clear()
export const getValidationStats = () => realTimeValidator.getStats()

// ====== AUTO-EXECUÇÃO ======
if (typeof window !== 'undefined') {
  // Disponibiliza globalmente para controle no console
  window.enableRealTimeValidation = enableRealTimeValidation
  window.disableRealTimeValidation = disableRealTimeValidation
  window.clearValidationLogs = clearValidationLogs
  window.getValidationStats = getValidationStats
  window.realTimeValidator = realTimeValidator
  
  console.log('🔍 Validador em tempo real carregado!')
  console.log('Execute "enableRealTimeValidation()" para ativar')
  console.log('Execute "getValidationStats()" para ver estatísticas')
}
