# 🚀 Instruções para Executar os Testes

## ✅ Verificação do Ambiente

Execute o comando abaixo para verificar se tudo está configurado:

```bash
npm run test:check
```

Se todos os arquivos estiverem presentes, você verá:
```
✅ Todos os arquivos de teste estão presentes!
```

## 🎯 Execução dos Testes

### Método 1: Via Console do Navegador (Recomendado)

1. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

2. **Aguarde a mensagem:**
   ```
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:5173/
   ```

3. **Abra o navegador em:** `http://localhost:5173`

4. **Abra o Console do Navegador:**
   - Pressione `F12` ou
   - Clique com botão direito → "Inspecionar" → Aba "Console"

5. **Execute os testes:**

   **Opção A: Todos os testes (incluindo alternância de turnos)**
   ```javascript
   runAllTests()
   ```

   **Opção B: Apenas testes de alternância de turnos**
   ```javascript
   testTurnAlternation()
   ```

   **Opção C: Testes individuais**
   ```javascript
   const turnTester = new TurnAlternationTester()
   
   // Executar todos
   turnTester.runAllTests().then(result => {
     console.log('✅ Sucesso:', result.success)
     console.log('❌ Erros:', result.errors.length)
     console.log('⚠️ Avisos:', result.warnings.length)
   })
   
   // Ou testes individuais
   turnTester.testBasicTurnAlternation()
   turnTester.testAllBoardSpaces()
   turnTester.testButtonNotLockedForBothPlayers()
   turnTester.testModalsDontBlockTurnIndefinitely()
   turnTester.testBankruptPlayersSkipped()
   turnTester.testMultiplayerSync()
   turnTester.testSafetyTimeout()
   ```

### Método 2: Via Interface HTML

1. **Inicie o servidor:**
   ```bash
   npm run dev
   ```

2. **Abra o jogo em uma aba do navegador**

3. **Abra `test-runner.html` em outra aba:**
   - Clique duas vezes no arquivo `test-runner.html`
   - Ou arraste o arquivo para o navegador

4. **Clique nos botões para executar os testes**

## 📊 Interpretando os Resultados

### ✅ Teste Passou
```
✅ Testes concluídos com sucesso!
   - Total de testes: 7
   - Erros: 0
   - Avisos: 0
```

### ⚠️ Teste com Avisos
```
✅ Testes concluídos com sucesso!
   - Total de testes: 7
   - Erros: 0
   - Avisos: 2
```
**Ação:** Verifique os avisos no console, mas o sistema está funcionando.

### ❌ Teste Falhou
```
❌ Testes falharam!
   - Erros: 2
```
**Ação:** Verifique os erros detalhados no console e corrija os problemas.

## 🔍 Verificação de Status

Para verificar se o sistema de testes está carregado:

```javascript
// Verificar se funções estão disponíveis
typeof runAllTests          // deve retornar "function"
typeof testTurnAlternation  // deve retornar "function"
typeof TurnAlternationTester // deve retornar "function"

// Ver status do painel de testes
getStatus()

// Ver estatísticas de validação
getValidationStats()
```

## 🐛 Solução de Problemas

### Problema: "runAllTests is not defined"

**Solução:**
1. Recarregue a página (F5)
2. Verifique se não há erros no console
3. Verifique se `src/game/__tests__/index.js` está sendo carregado

### Problema: "TurnAlternationTester is not defined"

**Solução:**
1. Verifique se o arquivo `src/game/__tests__/turnAlternationTest.js` existe
2. Recarregue a página (Ctrl+Shift+R para limpar cache)
3. Verifique o console para erros de importação

### Problema: Servidor não inicia

**Solução:**
```bash
# Verificar se a porta está em uso
netstat -ano | findstr :5173

# Se estiver, mate o processo ou use outra porta
# Edite vite.config.js para mudar a porta
```

### Problema: Testes não executam

**Solução:**
1. Verifique se o servidor está rodando
2. Verifique se o jogo carregou completamente
3. Aguarde alguns segundos após carregar a página
4. Verifique o console para erros

## 📝 Comandos Úteis Adicionais

```javascript
// Ativar validação em tempo real
enableValidation()

// Ver estatísticas
getValidationStats()

// Limpar logs
clearLogs()

// Gerar relatório
generateReport()

// Criar simulador interativo
const sim = createSimulator(2)
sim.state()
sim.roll('player-0')
sim.next()
```

## ✅ Checklist de Execução

- [ ] Servidor rodando (`npm run dev`)
- [ ] Jogo carregado no navegador
- [ ] Console aberto (F12)
- [ ] Sistema de testes carregado (ver mensagem no console)
- [ ] `TurnAlternationTester` disponível
- [ ] Testes executados com sucesso
- [ ] Resultados analisados
- [ ] Problemas corrigidos (se houver)

## 🎉 Próximos Passos Após Executar Testes

1. ✅ Verificar se todos os testes passaram
2. ✅ Analisar avisos (se houver)
3. ✅ Corrigir erros (se houver)
4. ✅ Testar em ambiente multiplayer real (múltiplas abas)
5. ✅ Monitorar logs em produção usando `enableValidation()`

## 📚 Documentação Adicional

- `ANALISE_ALTERNANCIA_TURNOS.md` - Análise completa
- `RESUMO_ANALISE_TURNOS.md` - Resumo executivo
- `EXECUTAR_TESTES.md` - Guia detalhado
- `PROXIMOS_PASSOS_EXECUTADOS.md` - Status dos próximos passos


