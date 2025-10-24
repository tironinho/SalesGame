# Sistema de Testes Sales Game 🧪

Este diretório contém um sistema completo de testes automatizados para validar todas as funcionalidades do Sales Game.

## 📁 Estrutura dos Arquivos

- **`regressionTests.js`** - Testes regressivos que validam cálculos básicos e regras de negócio
- **`integrationTests.js`** - Testes de integração que simulam jogadas completas
- **`realTimeValidator.js`** - Validador em tempo real que monitora o jogo durante execução
- **`testControlPanel.js`** - Painel de controle unificado para executar todos os testes
- **`index.js`** - Arquivo de inicialização que carrega todos os testes

## 🚀 Como Usar

### 1. Execução Automática
O sistema é carregado automaticamente quando o jogo inicia. Abra o console do navegador e execute:

```javascript
runAllTests()
```

### 2. Validação em Tempo Real
Para ativar validação contínua durante o jogo:

```javascript
enableValidation()
```

### 3. Simulador Interativo
Para testar funcionalidades específicas:

```javascript
const sim = createSimulator(2)  // 2 jogadores
sim.roll('player-0')           // Jogador 1 rola dado
sim.buy('player-0', 'Item', 2000)  // Jogador 1 compra item
sim.next()                     // Passa turno
```

## 🧪 Tipos de Testes

### Testes Regressivos
- ✅ Cálculos básicos (faturamento, despesas, capacidade)
- ✅ Movimento e posição no tabuleiro
- ✅ Sistema de certificados
- ✅ Lógica de falência
- ✅ Aplicação de deltas (mudanças de recursos)
- ✅ Níveis ERP e Mix de Produtos
- ✅ Gerenciamento de turnos
- ✅ Regras de negócio

### Testes de Integração
- ✅ Fluxo completo do jogo
- ✅ Sistema de falência
- ✅ Gerenciamento de turnos
- ✅ Atualização de recursos
- ✅ Sincronização entre jogadores

### Validação em Tempo Real
- ✅ Estado dos jogadores
- ✅ Gerenciamento de turnos
- ✅ Validação de ações
- ✅ Sincronização
- ✅ Regras de negócio

## 📊 Comandos Disponíveis

### Painel Principal
```javascript
runAllTests()           // Executa todos os testes
enableValidation()      // Ativa validação em tempo real
disableValidation()     // Desativa validação em tempo real
getValidationStats()    // Mostra estatísticas de validação
clearLogs()            // Limpa logs de validação
generateReport()       // Gera relatório completo
getStatus()            // Mostra status atual
reset()                // Reseta painel de testes
```

### Testes Específicos
```javascript
testTurnPassing()      // Testa passagem de turnos
testBankruptcySystem() // Testa sistema de falência
testResourceUpdates()  // Testa atualização de recursos
testLevelRestrictions() // Testa restrições de nível
```

### Simulador Interativo
```javascript
const sim = createSimulator(2)  // Cria simulador
sim.roll(playerId)             // Rola dado
sim.buy(playerId, item, cost)  // Compra item
sim.card(playerId, card, deltas) // Aplica carta
sim.bankrupt(playerId)         // Declara falência
sim.next()                     // Próximo turno
sim.state()                    // Estado do jogo
sim.stats(playerId)           // Estatísticas do jogador
```

## 🔍 Validações Automáticas

O sistema valida automaticamente:

1. **Saldo não pode ser negativo**
2. **Recursos não podem ser negativos**
3. **Níveis válidos (A, B, C, D)**
4. **Posição válida no tabuleiro (0-54)**
5. **Certificados não podem ser negativos**
6. **Capacidade vs Atendimento**
7. **Cálculos de faturamento e despesas**
8. **Turno válido e jogador existente**
9. **Jogador do turno não deve estar falido**
10. **Deve haver pelo menos um jogador vivo**
11. **Sincronização entre estados**
12. **Regras de negócio específicas**

## 🐛 Problemas Reportados Validados

- ✅ Função declarar falência finaliza o jogo
- ✅ Sorte e revés calculam corretamente
- ✅ Despesas do mês validam saldo
- ✅ Peões são pessoinhas
- ✅ Turno aguarda finalizar jogada
- ✅ Sincronização de turnos funciona
- ✅ ERP e Mix desabilitam níveis já adquiridos
- ✅ Numeração das rodadas correta
- ✅ Jogador para na casa e passa a vez
- ✅ Falência remove jogador do jogo
- ✅ Certificados são exibidos
- ✅ Revés aplica deltas corretamente
- ✅ Lógica de vitória funciona
- ✅ Peão não volta casa

## 📈 Relatórios

O sistema gera relatórios detalhados incluindo:
- Tempo de execução de cada teste
- Número de testes passou/falhou
- Estatísticas de validação em tempo real
- Logs de erros e avisos
- Estado atual do sistema

## 🔧 Manutenção

Para adicionar novos testes:

1. Adicione o teste em `regressionTests.js` ou `integrationTests.js`
2. Exporte a função
3. Adicione ao `testControlPanel.js` se necessário
4. Documente no README

Para adicionar novas validações:

1. Adicione a validação em `realTimeValidator.js`
2. Integre no `App.jsx` se necessário
3. Teste com `enableValidation()`

## 🎯 Objetivo

Este sistema garante que todas as funcionalidades do Sales Game estejam funcionando corretamente e que mudanças futuras não quebrem funcionalidades existentes. É uma ferramenta essencial para desenvolvimento e manutenção do jogo.
