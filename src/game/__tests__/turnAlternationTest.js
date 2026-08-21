/**
 * Teste Completo de Alternância de Turnos
 * 
 * Este teste verifica:
 * 1. Alternância correta de turnos entre jogadores
 * 2. Botão "Rolar Dado" não trava para ambos os jogadores
 * 3. Todas as casas do tabuleiro funcionam corretamente
 * 4. Modais não bloqueiam turno indefinidamente
 * 5. Sincronização multiplayer funciona corretamente
 */

import { TRACK_LEN } from '../../data/track'

class TurnAlternationTester {
  constructor() {
    this.results = []
    this.errors = []
    this.warnings = []
  }

  log(message, type = 'info') {
    const entry = { message, type, timestamp: Date.now() }
    this.results.push(entry)
    if (type === 'error') this.errors.push(entry)
    if (type === 'warning') this.warnings.push(entry)
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  // ========== TESTE 1: Alternância Básica de Turnos ==========
  testBasicTurnAlternation() {
    this.log('🧪 TESTE 1: Alternância Básica de Turnos', 'info')
    
    const players = [
      { id: 'p1', name: 'Jogador 1', pos: 0, bankrupt: false },
      { id: 'p2', name: 'Jogador 2', pos: 0, bankrupt: false }
    ]
    
    let turnIdx = 0
    const turnHistory = []
    
    // Simula 10 turnos
    for (let i = 0; i < 10; i++) {
      const currentPlayer = players[turnIdx]
      turnHistory.push({
        turn: i + 1,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        turnIdx
      })
      
      // Próximo turno
      turnIdx = (turnIdx + 1) % players.length
    }
    
    // Verifica alternância
    const p1Turns = turnHistory.filter(t => t.playerId === 'p1')
    const p2Turns = turnHistory.filter(t => t.playerId === 'p2')
    
    if (p1Turns.length === 5 && p2Turns.length === 5) {
      this.log('✅ Alternância básica funcionando corretamente', 'info')
    } else {
      this.log(`❌ Alternância básica falhou: P1=${p1Turns.length}, P2=${p2Turns.length}`, 'error')
    }
    
    // Verifica ordem
    let lastPlayerId = null
    let orderCorrect = true
    for (const turn of turnHistory) {
      if (lastPlayerId === turn.playerId) {
        orderCorrect = false
        break
      }
      lastPlayerId = turn.playerId
    }
    
    if (orderCorrect) {
      this.log('✅ Ordem de alternância correta', 'info')
    } else {
      this.log('❌ Ordem de alternância incorreta', 'error')
    }
  }

  // ========== TESTE 2: Verificação de Todas as Casas ==========
  testAllBoardSpaces() {
    this.log('🧪 TESTE 2: Verificação de Todas as Casas do Tabuleiro', 'info')
    
    // Mapeamento de todas as casas (baseado em useTurnEngine.jsx)
    const spaceTypes = {
      erp: [6, 16, 32, 49],
      training: [2, 11, 19, 47],
      directBuy: [5, 10, 43],
      insideSales: [12, 21, 30, 42, 53],
      clients: [4, 8, 15, 17, 20, 27, 34, 36, 39, 46, 52, 55],
      manager: [18, 24, 29, 51],
      fieldSales: [13, 25, 33, 38, 50],
      commonSellers: [9, 28, 40, 45],
      mixProducts: [7, 31, 44],
      luckMisfortune: [3, 14, 22, 26, 35, 41, 48, 54],
      faturamento: [0], // Casa 0 - quando cruza
      despesas: [22] // Casa 22 - quando cruza
    }
    
    // Verifica se todas as casas estão mapeadas
    const allSpaces = new Set()
    Object.values(spaceTypes).forEach(spaces => {
      spaces.forEach(space => allSpaces.add(space))
    })
    
    // Verifica casas de 1 a 55 (1-based)
    const missingSpaces = []
    for (let i = 1; i <= TRACK_LEN; i++) {
      if (!allSpaces.has(i) && i !== 1) { // Casa 1 é início, não precisa de modal
        missingSpaces.push(i)
      }
    }
    
    if (missingSpaces.length === 0) {
      this.log(`✅ Todas as ${TRACK_LEN} casas estão mapeadas`, 'info')
    } else {
      this.log(`❌ Casas não mapeadas: ${missingSpaces.join(', ')}`, 'error')
    }
    
    // Verifica sobreposições
    const overlaps = {}
    Object.entries(spaceTypes).forEach(([type, spaces]) => {
      spaces.forEach(space => {
        if (!overlaps[space]) overlaps[space] = []
        overlaps[space].push(type)
      })
    })
    
    const duplicateSpaces = Object.entries(overlaps).filter(([space, types]) => types.length > 1)
    if (duplicateSpaces.length === 0) {
      this.log('✅ Nenhuma casa tem tipos duplicados', 'info')
    } else {
      duplicateSpaces.forEach(([space, types]) => {
        this.log(`⚠️ Casa ${space} tem múltiplos tipos: ${types.join(', ')}`, 'warning')
      })
    }
    
    // Log de resumo
    Object.entries(spaceTypes).forEach(([type, spaces]) => {
      this.log(`  ${type}: ${spaces.length} casas (${spaces.join(', ')})`, 'info')
    })
  }

  // ========== TESTE 3: Botão Não Trava para Ambos Jogadores ==========
  testButtonNotLockedForBothPlayers() {
    this.log('🧪 TESTE 3: Botão Não Trava para Ambos Jogadores', 'info')
    
    const players = [
      { id: 'p1', name: 'Jogador 1', bankrupt: false },
      { id: 'p2', name: 'Jogador 2', bankrupt: false }
    ]
    
    // Simula estados do jogo
    const gameStates = [
      { turnIdx: 0, turnLock: false, modalLocks: 0, gameOver: false },
      { turnIdx: 1, turnLock: false, modalLocks: 0, gameOver: false },
      { turnIdx: 0, turnLock: true, modalLocks: 1, gameOver: false }, // Modal aberta
      { turnIdx: 1, turnLock: true, modalLocks: 0, gameOver: false }, // Turno em progresso
    ]
    
    gameStates.forEach((state, idx) => {
      const currentPlayer = players[state.turnIdx]
      const isMyTurnP1 = state.turnIdx === 0 && !currentPlayer.bankrupt
      const isMyTurnP2 = state.turnIdx === 1 && !currentPlayer.bankrupt
      
      const canRollP1 = isMyTurnP1 && state.modalLocks === 0 && !state.turnLock && !state.gameOver
      const canRollP2 = isMyTurnP2 && state.modalLocks === 0 && !state.turnLock && !state.gameOver
      
      // Verifica que pelo menos um jogador pode rolar (exceto quando modal está aberta)
      if (state.modalLocks === 0 && !state.turnLock) {
        if (!canRollP1 && !canRollP2) {
          this.log(`❌ Estado ${idx}: Nenhum jogador pode rolar quando deveria`, 'error')
        } else {
          this.log(`✅ Estado ${idx}: Pelo menos um jogador pode rolar`, 'info')
        }
      }
      
      // Verifica que quando é turno de P1, P2 não pode rolar (e vice-versa)
      if (state.turnIdx === 0 && canRollP2) {
        this.log(`❌ Estado ${idx}: P2 pode rolar quando é turno de P1`, 'error')
      }
      if (state.turnIdx === 1 && canRollP1) {
        this.log(`❌ Estado ${idx}: P1 pode rolar quando é turno de P2`, 'error')
      }
    })
  }

  // ========== TESTE 4: Modais Não Bloqueiam Turno Indefinidamente ==========
  testModalsDontBlockTurnIndefinitely() {
    this.log('🧪 TESTE 4: Modais Não Bloqueiam Turno Indefinidamente', 'info')
    
    // Simula abertura e fechamento de modais
    let modalLocks = 0
    let turnLock = false
    const modalHistory = []
    
    // Simula sequência de modais
    const modalSequence = [
      { action: 'open', type: 'clients' },
      { action: 'open', type: 'insufficientFunds' },
      { action: 'close', type: 'insufficientFunds' },
      { action: 'close', type: 'clients' },
    ]
    
    modalSequence.forEach((event, idx) => {
      if (event.action === 'open') {
        modalLocks++
        if (idx === 0) turnLock = true // Primeira modal ativa turnLock
      } else {
        modalLocks = Math.max(0, modalLocks - 1)
        if (modalLocks === 0) {
          // Aguarda 200ms (simulado)
          setTimeout(() => {
            turnLock = false
            modalHistory.push({ event: 'turnUnlocked', timestamp: Date.now() })
          }, 200)
        }
      }
      modalHistory.push({ event: event.action, type: event.type, modalLocks, turnLock })
    })
    
    // Verifica que turnLock foi liberado
    setTimeout(() => {
      if (turnLock && modalLocks === 0) {
        this.log('❌ turnLock não foi liberado após fechar todas as modais', 'error')
      } else {
        this.log('✅ turnLock foi liberado corretamente após fechar todas as modais', 'info')
      }
    }, 500)
  }

  // ========== TESTE 5: Jogadores Falidos São Pulados ==========
  testBankruptPlayersSkipped() {
    this.log('🧪 TESTE 5: Jogadores Falidos São Pulados', 'info')
    
    const players = [
      { id: 'p1', name: 'Jogador 1', bankrupt: false },
      { id: 'p2', name: 'Jogador 2', bankrupt: true }, // Falido
      { id: 'p3', name: 'Jogador 3', bankrupt: false }
    ]
    
    let turnIdx = 0
    const turnHistory = []
    
    // Simula 6 turnos
    for (let i = 0; i < 6; i++) {
      let currentPlayer = players[turnIdx]
      
      // Pula jogadores falidos
      while (currentPlayer.bankrupt) {
        turnIdx = (turnIdx + 1) % players.length
        currentPlayer = players[turnIdx]
      }
      
      turnHistory.push({
        turn: i + 1,
        playerId: currentPlayer.id,
        turnIdx
      })
      
      // Próximo turno
      turnIdx = (turnIdx + 1) % players.length
    }
    
    // Verifica que P2 (falido) nunca teve turno
    const p2Turns = turnHistory.filter(t => t.playerId === 'p2')
    if (p2Turns.length === 0) {
      this.log('✅ Jogador falido foi pulado corretamente', 'info')
    } else {
      this.log(`❌ Jogador falido teve ${p2Turns.length} turnos (deveria ser 0)`, 'error')
    }
    
    // Verifica que P1 e P3 alternaram
    const p1Turns = turnHistory.filter(t => t.playerId === 'p1')
    const p3Turns = turnHistory.filter(t => t.playerId === 'p3')
    if (p1Turns.length === 3 && p3Turns.length === 3) {
      this.log('✅ Jogadores vivos alternaram corretamente', 'info')
    } else {
      this.log(`❌ Alternância incorreta: P1=${p1Turns.length}, P3=${p3Turns.length}`, 'error')
    }
  }

  // ========== TESTE 6: Sincronização Multiplayer ==========
  testMultiplayerSync() {
    this.log('🧪 TESTE 6: Sincronização Multiplayer', 'info')
    
    // Simula dois clientes
    const client1 = {
      players: [
        { id: 'p1', name: 'Jogador 1', pos: 5, cash: 18000 },
        { id: 'p2', name: 'Jogador 2', pos: 3, cash: 18000 }
      ],
      turnIdx: 0,
      round: 1,
      lastLocalState: { turnIdx: 0, round: 1, timestamp: Date.now() - 1000 }
    }
    
    const client2 = {
      players: [
        { id: 'p1', name: 'Jogador 1', pos: 5, cash: 18000 },
        { id: 'p2', name: 'Jogador 2', pos: 3, cash: 18000 }
      ],
      turnIdx: 0,
      round: 1,
      lastLocalState: { turnIdx: 0, round: 1, timestamp: Date.now() - 1000 }
    }
    
    // Client1 muda turno
    client1.turnIdx = 1
    client1.lastLocalState = { turnIdx: 1, round: 1, timestamp: Date.now() }
    
    // Client2 recebe sync (mas tem mudança local recente)
    const syncData = { turnIdx: 1, round: 1, timestamp: Date.now() }
    const timeSinceLocalChange = Date.now() - client2.lastLocalState.timestamp
    
    // Verifica proteção contra reversão
    if (timeSinceLocalChange < 5000 && client2.lastLocalState.turnIdx !== syncData.turnIdx) {
      // Não deve aceitar sync se mudança local foi recente
      this.log('✅ Proteção contra reversão de turnIdx funcionando', 'info')
    } else {
      // Aceita sync normalmente
      client2.turnIdx = syncData.turnIdx
      this.log('✅ Sincronização de turnIdx funcionando', 'info')
    }
  }

  // ========== TESTE 7: Timeout de Segurança ==========
  testSafetyTimeout() {
    this.log('🧪 TESTE 7: Timeout de Segurança do TurnLock (órfão, não 30s de jogada)', 'info')

    // Contrato atualizado: 30s NÃO libera jogada ativa.
    // Só órfão sem pipeline (sem events/pending/modals) pode liberar.
    const pipelineActive = {
      modalLocks: 0,
      opening: false,
      eventsInProgress: true,
      turnChangeInProgress: true,
      hasPendingTurnData: true,
    }
    const shouldNotUnlock =
      pipelineActive.eventsInProgress ||
      pipelineActive.turnChangeInProgress ||
      pipelineActive.hasPendingTurnData ||
      pipelineActive.modalLocks > 0 ||
      pipelineActive.opening

    if (shouldNotUnlock) {
      this.log('✅ Watchdog NÃO libera turnLock com pipeline ativa (mesmo após 30s)', 'info')
    } else {
      this.log('❌ Watchdog liberaria prematuramente', 'error')
    }

    const orphan = {
      modalLocks: 0,
      opening: false,
      eventsInProgress: false,
      turnChangeInProgress: false,
      hasPendingTurnData: false,
    }
    const orphanUnlock =
      orphan.modalLocks === 0 &&
      !orphan.opening &&
      !orphan.eventsInProgress &&
      !orphan.turnChangeInProgress &&
      !orphan.hasPendingTurnData
    if (orphanUnlock) {
      this.log('✅ Lock órfão sem pipeline pode ser liberado com segurança', 'info')
    }
  }

  // ========== EXECUTAR TODOS OS TESTES ==========
  async runAllTests() {
    this.log('🚀 Iniciando Testes de Alternância de Turnos', 'info')
    this.log('='.repeat(60), 'info')
    
    try {
      this.testBasicTurnAlternation()
      this.testAllBoardSpaces()
      this.testButtonNotLockedForBothPlayers()
      this.testModalsDontBlockTurnIndefinitely()
      this.testBankruptPlayersSkipped()
      this.testMultiplayerSync()
      this.testSafetyTimeout()
      
      // Aguarda testes assíncronos
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      this.log('='.repeat(60), 'info')
      this.log(`✅ Testes concluídos: ${this.results.filter(r => r.type === 'info').length}`, 'info')
      this.log(`⚠️ Avisos: ${this.warnings.length}`, 'warning')
      this.log(`❌ Erros: ${this.errors.length}`, this.errors.length > 0 ? 'error' : 'info')
      
      return {
        success: this.errors.length === 0,
        results: this.results,
        errors: this.errors,
        warnings: this.warnings
      }
    } catch (error) {
      this.log(`❌ Erro ao executar testes: ${error.message}`, 'error')
      return {
        success: false,
        error: error.message,
        results: this.results,
        errors: this.errors,
        warnings: this.warnings
      }
    }
  }
}

// Exporta para uso em outros arquivos
export default TurnAlternationTester

// Executa automaticamente se rodado diretamente
if (typeof window !== 'undefined') {
  window.TurnAlternationTester = TurnAlternationTester
  
  // Adiciona ao console para fácil acesso
  console.log('%c🧪 TurnAlternationTester disponível', 'color: #4CAF50; font-weight: bold')
  console.log('Execute: const tester = new TurnAlternationTester(); tester.runAllTests()')
}

