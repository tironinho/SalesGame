// src/game/gameValidator.js
import { computeFaturamentoFor, computeDespesasFor, capacityAndAttendance, countAlivePlayers } from './gameMath.js'

/**
 * Validador de regras de negócio do jogo
 * Verifica se o estado do jogo está consistente e se as regras estão sendo aplicadas corretamente
 */

export class GameValidator {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  /**
   * Valida o estado completo do jogo
   */
  validateGameState(players, turnIdx, round, gameOver, winner) {
    this.errors = []
    this.warnings = []

    this.validatePlayers(players)
    this.validateTurnState(players, turnIdx)
    this.validateGameOverState(players, gameOver, winner)
    this.validateRoundState(players, round)

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    }
  }

  /**
   * Valida estado dos jogadores
   */
  validatePlayers(players) {
    if (!Array.isArray(players) || players.length === 0) {
      this.addError('Jogadores inválidos: deve ser um array não vazio')
      return
    }

    players.forEach((player, index) => {
      this.validatePlayer(player, index)
    })

    // Validações globais
    this.validatePlayerUniqueness(players)
    this.validateAlivePlayers(players)
  }

  /**
   * Valida um jogador individual
   */
  validatePlayer(player, index) {
    const prefix = `Jogador ${index + 1} (${player.name || 'Sem nome'})`

    // Validações básicas
    if (!player.id) {
      this.addError(`${prefix}: ID é obrigatório`)
    }

    if (typeof player.cash !== 'number' || player.cash < 0) {
      this.addError(`${prefix}: Cash deve ser um número não negativo (atual: ${player.cash})`)
    }

    if (typeof player.clients !== 'number' || player.clients < 0) {
      this.addError(`${prefix}: Clientes deve ser um número não negativo (atual: ${player.clients})`)
    }

    // Validações de recursos
    this.validateResourceCounts(player, prefix)
    
    // Validações de cálculos
    this.validateCalculations(player, prefix)
  }

  /**
   * Valida contagens de recursos
   */
  validateResourceCounts(player, prefix) {
    const resources = [
      'vendedoresComuns', 'fieldSales', 'insideSales', 'gestores', 'gestoresComerciais', 'managers'
    ]

    resources.forEach(resource => {
      const value = player[resource]
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        this.addError(`${prefix}: ${resource} deve ser um número não negativo (atual: ${value})`)
      }
    })

    // Validações de certificados
    const certs = ['az', 'am', 'rox']
    certs.forEach(cert => {
      const value = player[cert]
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        this.addError(`${prefix}: Certificado ${cert} deve ser um número não negativo (atual: ${value})`)
      }
    })
  }

  /**
   * Valida cálculos de faturamento e manutenção
   */
  validateCalculations(player, prefix) {
    try {
      const faturamento = computeFaturamentoFor(player)
      const manutencao = computeDespesasFor(player)
      const { cap, inAtt } = capacityAndAttendance(player)

      // Valida faturamento
      if (typeof faturamento !== 'number' || faturamento < 0) {
        this.addError(`${prefix}: Faturamento calculado inválido: ${faturamento}`)
      }

      // Valida manutenção
      if (typeof manutencao !== 'number' || manutencao < 0) {
        this.addError(`${prefix}: Manutenção calculada inválida: ${manutencao}`)
      }

      // Valida capacidade
      if (typeof cap !== 'number' || cap < 0) {
        this.addError(`${prefix}: Capacidade calculada inválida: ${cap}`)
      }

      if (typeof inAtt !== 'number' || inAtt < 0 || inAtt > cap) {
        this.addError(`${prefix}: Clientes em atendimento inválido: ${inAtt} (capacidade: ${cap})`)
      }

      // Validação específica: manutenção inicial deve ser 1150
      if (this.isInitialState(player) && manutencao !== 1150) {
        this.addError(`${prefix}: Manutenção inicial deve ser 1150, mas é ${manutencao}`)
      }

    } catch (error) {
      this.addError(`${prefix}: Erro ao calcular faturamento/manutenção: ${error.message}`)
    }
  }

  /**
   * Verifica se é o estado inicial do jogo
   */
  isInitialState(player) {
    return (
      player.vendedoresComuns === 1 &&
      player.clients === 1 &&
      player.fieldSales === 0 &&
      player.insideSales === 0 &&
      player.gestores === 0 &&
      player.mixProdutos === 'D' &&
      player.erpLevel === 'D' &&
      (player.az || 0) === 0 &&
      (player.am || 0) === 0 &&
      (player.rox || 0) === 0
    )
  }

  /**
   * Valida unicidade dos jogadores
   */
  validatePlayerUniqueness(players) {
    const ids = players.map(p => p.id).filter(Boolean)
    const uniqueIds = new Set(ids)
    
    if (ids.length !== uniqueIds.size) {
      this.addError('IDs de jogadores devem ser únicos')
    }
  }

  /**
   * Valida jogadores vivos
   */
  validateAlivePlayers(players) {
    const aliveCount = countAlivePlayers(players)
    
    if (aliveCount === 0) {
      this.addError('Não pode haver zero jogadores vivos')
    }

    if (aliveCount === 1) {
      this.addWarning('Apenas 1 jogador vivo - jogo deve terminar')
    }
  }

  /**
   * Valida estado do turno
   */
  validateTurnState(players, turnIdx) {
    if (typeof turnIdx !== 'number' || turnIdx < 0 || turnIdx >= players.length) {
      this.addError(`TurnIdx inválido: ${turnIdx} (deve estar entre 0 e ${players.length - 1})`)
      return
    }

    const currentPlayer = players[turnIdx]
    if (!currentPlayer) {
      this.addError(`Jogador do turno não encontrado no índice ${turnIdx}`)
      return
    }

    if (currentPlayer.bankrupt) {
      this.addError(`Jogador do turno (${currentPlayer.name}) está falido`)
    }
  }

  /**
   * Valida estado de fim de jogo
   */
  validateGameOverState(players, gameOver, winner) {
    const aliveCount = countAlivePlayers(players)
    
    if (gameOver && aliveCount > 1) {
      this.addError('Jogo marcado como terminado mas há mais de 1 jogador vivo')
    }

    if (gameOver && !winner) {
      this.addError('Jogo terminado mas não há vencedor definido')
    }

    if (winner && !gameOver) {
      this.addError('Há vencedor definido mas jogo não terminou')
    }

    if (winner && winner.bankrupt) {
      this.addError('Vencedor não pode estar falido')
    }
  }

  /**
   * Valida estado da rodada
   */
  validateRoundState(players, round) {
    if (typeof round !== 'number' || round < 1) {
      this.addError(`Rodada inválida: ${round} (deve ser >= 1)`)
    }

    if (round > 10) {
      this.addWarning(`Rodada muito alta: ${round} (jogo pode estar travado)`)
    }
  }

  /**
   * Valida uma ação específica
   */
  validateAction(action, player, gameState) {
    this.errors = []
    this.warnings = []

    switch (action.type) {
      case 'MOVE':
        this.validateMoveAction(action, player)
        break
      case 'BUY':
        this.validateBuyAction(action, player)
        break
      case 'HIRE':
        this.validateHireAction(action, player)
        break
      case 'BANKRUPT':
        this.validateBankruptAction(action, player)
        break
      default:
        this.addWarning(`Tipo de ação não reconhecido: ${action.type}`)
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    }
  }

  validateMoveAction(action, player) {
    if (typeof action.steps !== 'number' || action.steps < 1 || action.steps > 6) {
      this.addError(`Passos inválidos: ${action.steps} (deve estar entre 1 e 6)`)
    }
  }

  validateBuyAction(action, player) {
    const cost = action.cost || action.price || 0
    if (cost > player.cash) {
      this.addError(`Saldo insuficiente: precisa de ${cost}, tem ${player.cash}`)
    }
  }

  validateHireAction(action, player) {
    const cost = action.cost || 0
    if (cost > player.cash) {
      this.addError(`Saldo insuficiente para contratação: precisa de ${cost}, tem ${player.cash}`)
    }
  }

  validateBankruptAction(action, player) {
    if (!player.bankrupt) {
      this.addWarning('Jogador declarando falência mas não está marcado como falido')
    }
  }

  addError(message) {
    this.errors.push(message)
  }

  addWarning(message) {
    this.warnings.push(message)
  }
}

/**
 * Função de conveniência para validação rápida
 */
export function validateGame(players, turnIdx, round, gameOver, winner) {
  const validator = new GameValidator()
  return validator.validateGameState(players, turnIdx, round, gameOver, winner)
}

/**
 * Função para validação de ação
 */
export function validateAction(action, player, gameState) {
  const validator = new GameValidator()
  return validator.validateAction(action, player, gameState)
}
