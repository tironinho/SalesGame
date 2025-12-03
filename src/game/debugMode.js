// src/game/debugMode.js
import { validateGame, validateAction } from './gameValidator.js'
import { computeFaturamentoFor, computeDespesasFor, capacityAndAttendance } from './gameMath.js'
import { logCapture } from './logCapture.js'

/**
 * Modo debug para validação em tempo real das regras de negócio
 */

class DebugMode {
  constructor() {
    this.enabled = false
    this.validationHistory = []
    this.maxHistorySize = 100
  }

  /**
   * Ativa/desativa o modo debug
   */
  toggle() {
    this.enabled = !this.enabled
    
    // Ativa/desativa captura de logs junto com o debug
    if (this.enabled) {
      logCapture.enable()
    } else {
      // Não desativa logCapture automaticamente - pode ser usado independentemente
    }
    
    console.log(`[DEBUG MODE] ${this.enabled ? 'ATIVADO' : 'DESATIVADO'}`)
    return this.enabled
  }

  /**
   * Valida estado do jogo e registra resultado
   */
  validateGameState(players, turnIdx, round, gameOver, winner, context = '') {
    if (!this.enabled) return

    const result = validateGame(players, turnIdx, round, gameOver, winner)
    
    this.addToHistory({
      type: 'GAME_STATE',
      context,
      timestamp: Date.now(),
      result
    })

    if (!result.isValid) {
      console.error('[DEBUG MODE] ❌ Estado do jogo inválido:', result.errors)
    }

    if (result.warnings.length > 0) {
      console.warn('[DEBUG MODE] ⚠️ Avisos:', result.warnings)
    }

    return result
  }

  /**
   * Valida uma ação antes de executá-la
   */
  validateAction(action, player, gameState, context = '') {
    if (!this.enabled) return

    const result = validateAction(action, player, gameState)
    
    this.addToHistory({
      type: 'ACTION',
      context,
      timestamp: Date.now(),
      action: action.type,
      player: player.name,
      result
    })

    if (!result.isValid) {
      console.error(`[DEBUG MODE] ❌ Ação inválida (${action.type}):`, result.errors)
    }

    return result
  }

  /**
   * Valida mudanças de recursos (clientes, funcionários, etc.)
   */
  validateResourceChange(player, oldState, newState, changeType) {
    if (!this.enabled) return

    const errors = []
    const warnings = []

    // Valida mudanças de clientes
    if (oldState.clients !== newState.clients) {
      const delta = newState.clients - oldState.clients
      if (newState.clients < 0) {
        errors.push(`Clientes não pode ser negativo: ${newState.clients}`)
      }
      if (Math.abs(delta) > 10) {
        warnings.push(`Mudança grande de clientes: ${delta}`)
      }
    }

    // Valida mudanças de cash
    if (oldState.cash !== newState.cash) {
      const delta = newState.cash - oldState.cash
      if (newState.cash < 0) {
        errors.push(`Cash não pode ser negativo: ${newState.cash}`)
      }
      if (Math.abs(delta) > 50000) {
        warnings.push(`Mudança grande de cash: ${delta}`)
      }
    }

    // Valida mudanças de funcionários
    const employeeTypes = ['vendedoresComuns', 'fieldSales', 'insideSales', 'gestores']
    employeeTypes.forEach(type => {
      if (oldState[type] !== newState[type]) {
        const delta = newState[type] - oldState[type]
        if (newState[type] < 0) {
          errors.push(`${type} não pode ser negativo: ${newState[type]}`)
        }
        if (Math.abs(delta) > 5) {
          warnings.push(`Mudança grande de ${type}: ${delta}`)
        }
      }
    })

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings
    }

    this.addToHistory({
      type: 'RESOURCE_CHANGE',
      context: changeType,
      timestamp: Date.now(),
      player: player.name,
      oldState,
      newState,
      result
    })

    if (!result.isValid) {
      console.error(`[DEBUG MODE] ❌ Mudança de recurso inválida:`, result.errors)
    }

    return result
  }

  /**
   * Valida cálculos de faturamento e manutenção
   */
  validateCalculations(player, context = '') {
    if (!this.enabled) return

    try {
      const faturamento = computeFaturamentoFor(player)
      const manutencao = computeDespesasFor(player)
      const { cap, inAtt } = capacityAndAttendance(player)

      const errors = []
      const warnings = []

      // Validações básicas
      if (typeof faturamento !== 'number' || faturamento < 0) {
        errors.push(`Faturamento inválido: ${faturamento}`)
      }

      if (typeof manutencao !== 'number' || manutencao < 0) {
        errors.push(`Manutenção inválida: ${manutencao}`)
      }

      if (typeof cap !== 'number' || cap < 0) {
        errors.push(`Capacidade inválida: ${cap}`)
      }

      if (typeof inAtt !== 'number' || inAtt < 0 || inAtt > cap) {
        errors.push(`Clientes em atendimento inválido: ${inAtt} (capacidade: ${cap})`)
      }

      // Validação específica: manutenção inicial
      if (this.isInitialState(player) && manutencao !== 1150) {
        errors.push(`Manutenção inicial deve ser 1150, mas é ${manutencao}`)
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
        calculations: { faturamento, manutencao, cap, inAtt }
      }

      this.addToHistory({
        type: 'CALCULATIONS',
        context,
        timestamp: Date.now(),
        player: player.name,
        result
      })

      if (!result.isValid) {
        console.error(`[DEBUG MODE] ❌ Cálculos inválidos:`, result.errors)
      }

      return result

    } catch (error) {
      console.error('[DEBUG MODE] ❌ Erro ao validar cálculos:', error)
      return { isValid: false, errors: [error.message], warnings: [] }
    }
  }

  /**
   * Verifica se é estado inicial
   */
  isInitialState(player) {
    return (
      player.vendedoresComuns === 1 &&
      player.clients === 1 &&
      player.fieldSales === 0 &&
      player.insideSales === 0 &&
      player.gestores === 0 &&
      player.mixProdutos === 'D' &&
      player.erpLevel === 'D'
    )
  }

  /**
   * Adiciona entrada ao histórico
   */
  addToHistory(entry) {
    this.validationHistory.unshift(entry)
    if (this.validationHistory.length > this.maxHistorySize) {
      this.validationHistory = this.validationHistory.slice(0, this.maxHistorySize)
    }
  }

  /**
   * Obtém histórico de validações
   */
  getHistory() {
    return this.validationHistory
  }

  /**
   * Limpa histórico
   */
  clearHistory() {
    this.validationHistory = []
  }

  /**
   * Obtém estatísticas de validação
   */
  getStats() {
    const total = this.validationHistory.length
    const errors = this.validationHistory.filter(h => !h.result.isValid).length
    const warnings = this.validationHistory.filter(h => h.result.warnings.length > 0).length

    return {
      total,
      errors,
      warnings,
      errorRate: total > 0 ? (errors / total) * 100 : 0,
      warningRate: total > 0 ? (warnings / total) * 100 : 0
    }
  }

  /**
   * Exporta relatório de validação
   */
  exportReport() {
    const stats = this.getStats()
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      history: this.validationHistory
    }

    console.log('[DEBUG MODE] 📊 Relatório de validação:', report)
    return report
  }

  /**
   * Exporta relatório completo (validação + logs)
   */
  exportFullReport() {
    const validationReport = this.exportReport()
    const logReport = logCapture.exportFull()
    
    return {
      timestamp: new Date().toISOString(),
      validation: validationReport,
      logs: logReport,
      // Versão texto completa para compartilhar
      text: this.exportFullReportAsText(validationReport, logReport)
    }
  }

  /**
   * Exporta relatório completo em formato texto
   */
  exportFullReportAsText(validationReport, logReport) {
    const lines = [
      '='.repeat(80),
      'RELATÓRIO COMPLETO DE DEBUG - Sales Game',
      '='.repeat(80),
      `Data/Hora: ${new Date().toISOString()}`,
      '',
      '--- VALIDAÇÕES ---',
      `Total de validações: ${validationReport.stats.total}`,
      `Erros: ${validationReport.stats.errors}`,
      `Avisos: ${validationReport.stats.warnings}`,
      `Taxa de erro: ${validationReport.stats.errorRate.toFixed(2)}%`,
      '',
      '--- LOGS CAPTURADOS ---',
      `Total de logs: ${logReport.stats.total}`,
      `Logs por nível: ${JSON.stringify(logReport.stats.byLevel, null, 2)}`,
      '',
      '--- HISTÓRICO DE VALIDAÇÕES ---',
      ...validationReport.history.map(h => {
        return `[${new Date(h.timestamp).toISOString()}] ${h.type} - ${h.context || ''} - ${JSON.stringify(h.result, null, 2)}`
      }),
      '',
      '--- LOGS DETALHADOS ---',
      logReport.text,
      '='.repeat(80)
    ]
    
    return lines.join('\n')
  }
}

// Instância global do modo debug
export const debugMode = new DebugMode()

// Funções de conveniência
export const toggleDebugMode = () => debugMode.toggle()
export const validateGameState = (players, turnIdx, round, gameOver, winner, context) => 
  debugMode.validateGameState(players, turnIdx, round, gameOver, winner, context)
export const validateGameAction = (action, player, gameState, context) => 
  debugMode.validateAction(action, player, gameState, context)
export const validateResourceChange = (player, oldState, newState, changeType) => 
  debugMode.validateResourceChange(player, oldState, newState, changeType)
export const validateCalculations = (player, context) => 
  debugMode.validateCalculations(player, context)
export const getDebugStats = () => debugMode.getStats()
export const exportDebugReport = () => debugMode.exportReport()
export const exportFullDebugReport = () => debugMode.exportFullReport()

// Re-exporta funções de logCapture para conveniência
export { 
  logCapture,
  enableLogCapture,
  disableLogCapture,
  clearLogs,
  getLogs,
  getLogStats,
  exportLogsAsText,
  exportLogsAsJSON,
  exportLogsFull
} from './logCapture.js'
