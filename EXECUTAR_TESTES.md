# 🧪 Guia de Execução dos Testes de Alternância de Turnos

## 📋 Pré-requisitos

1. Servidor de desenvolvimento rodando (`npm run dev`)
2. Navegador aberto na aplicação
3. Console do navegador aberto (F12)

## 🚀 Execução Rápida

### Opção 1: Executar Todos os Testes (Recomendado)

No console do navegador, execute:

```javascript
runAllTests()
```

Isso executará:
- ✅ Testes Regressivos
- ✅ Testes de Integração
- ✅ Testes de Problemas Reportados
- ✅ **Testes de Alternância de Turnos** (NOVO!)

### Opção 2: Executar Apenas Testes de Alternância de Turnos

```javascript
testTurnAlternation()
```

Ou diretamente:

```javascript
const turnTester = new TurnAlternationTester()
turnTester.runAllTests().then(result => {
  console.log('✅ Sucesso:', result.success)
  console.log('❌ Erros:', result.errors.length)
  console.log('⚠️ Avisos:', result.warnings.length)
  console.log('📊 Resultados:', result.results)
})
```

### Opção 3: Executar Testes Individuais

```javascript
const turnTester = new TurnAlternationTester()

// Teste 1: Alternância básica
turnTester.testBasicTurnAlternation()

// Teste 2: Verificação de todas as casas
turnTester.testAllBoardSpaces()

// Teste 3: Botão não trava para ambos
turnTester.testButtonNotLockedForBothPlayers()

// Teste 4: Modais não bloqueiam indefinidamente
turnTester.testModalsDontBlockTurnIndefinitely()

// Teste 5: Jogadores falidos são pulados
turnTester.testBankruptPlayersSkipped()

// Teste 6: Sincronização multiplayer
turnTester.testMultiplayerSync()

// Teste 7: Timeout de segurança
turnTester.testSafetyTimeout()
```

## 📊 Verificar Resultados

### Ver Todos os Resultados

```javascript
const turnTester = new TurnAlternationTester()
await turnTester.runAllTests()

// Ver todos os resultados
console.table(turnTester.results)

// Ver apenas erros
console.table(turnTester.errors)

// Ver apenas avisos
console.table(turnTester.warnings)
```

### Gerar Relatório Completo

```javascript
generateReport()
```

## 🔍 Testes Específicos Disponíveis

### 1. Teste de Alternância Básica
Verifica se os turnos alternam corretamente entre jogadores.

```javascript
testTurnPassing()
```

### 2. Teste de Alternância de Turnos (Completo)
Executa todos os 7 testes de alternância de turnos.

```javascript
testTurnAlternation()
```

### 3. Outros Testes Específicos

```javascript
testBankruptcySystem()    // Sistema de falência
testResourceUpdates()     // Atualização de recursos
testLevelRestrictions()   // Restrições de nível
```

## 🎮 Simulador Interativo

Para testar manualmente:

```javascript
// Criar simulador com 2 jogadores
const sim = createSimulator(2)

// Ver estado atual
sim.state()

// Rolar dado para jogador 1
sim.roll('player-0')

// Comprar item
sim.buy('player-0', 'Item', 2000)

// Próximo turno
sim.next()

// Ver estatísticas
sim.stats('player-0')
```

## 📝 Validação em Tempo Real

Para monitorar o jogo durante execução:

```javascript
// Ativar validação
enableValidation()

// Ver estatísticas
getValidationStats()

// Desativar validação
disableValidation()

// Limpar logs
clearLogs()
```

## 🐛 Debugging

### Ver Status do Sistema de Testes

```javascript
getStatus()
```

### Ver Logs Detalhados

Os testes geram logs detalhados no console. Procure por:
- `[INFO]` - Informações gerais
- `[WARNING]` - Avisos
- `[ERROR]` - Erros

### Resetar Painel de Testes

```javascript
reset()
```

## 📈 Interpretação dos Resultados

### ✅ Teste Passou
- `success: true`
- `errors.length === 0`
- Todos os testes individuais retornaram sucesso

### ⚠️ Teste com Avisos
- `success: true`
- `warnings.length > 0`
- Funciona, mas há pontos de atenção

### ❌ Teste Falhou
- `success: false`
- `errors.length > 0`
- Um ou mais testes falharam

## 🔧 Solução de Problemas

### Testes não executam
1. Verifique se o servidor está rodando: `npm run dev`
2. Recarregue a página (F5)
3. Verifique o console para erros de importação

### Erros de importação
1. Verifique se todos os arquivos estão salvos
2. Verifique se não há erros de sintaxe
3. Limpe o cache do navegador (Ctrl+Shift+R)

### Testes falham
1. Verifique os logs detalhados no console
2. Execute testes individuais para identificar o problema
3. Verifique se o estado do jogo está correto

## 📚 Documentação Adicional

- `ANALISE_ALTERNANCIA_TURNOS.md` - Análise detalhada completa
- `RESUMO_ANALISE_TURNOS.md` - Resumo executivo
- `src/game/__tests__/README.md` - Documentação do sistema de testes

## 🎯 Próximos Passos Após Executar Testes

1. ✅ Verificar se todos os testes passaram
2. ✅ Analisar avisos (se houver)
3. ✅ Corrigir erros (se houver)
4. ✅ Testar em ambiente multiplayer real
5. ✅ Monitorar logs em produção

