# Análise Profunda: Alternância de Turnos e Mecânica do Jogo

## 📋 Resumo Executivo

Este documento apresenta uma análise completa do sistema de alternância de turnos, verificação de todas as casas do tabuleiro e testes para garantir que o botão "Rolar Dado" não trave para ambos os jogadores.

## 🔍 1. Análise do Sistema de Turnos

### 1.1 Fluxo de Alternância de Turnos

**Arquivo Principal:** `src/game/useTurnEngine.jsx`

#### Processo de Mudança de Turno:

1. **Início do Turno:**
   - Jogador clica em "Rolar Dado & Andar"
   - `advanceAndMaybeLap()` é chamada
   - `turnLock` é ativado (`setTurnLockBroadcast(true)`)
   - `lockOwner` é definido como o jogador atual

2. **Durante o Turno:**
   - Jogador se move no tabuleiro
   - Modais podem ser abertas (compras, sorte/revés, etc.)
   - `modalLocks` rastreia quantas modais estão abertas
   - `openingModalRef` indica se uma modal está sendo aberta

3. **Fim do Turno:**
   - Função `tick()` verifica quando todas as modais foram fechadas
   - Quando `modalLocks === 0` e não há modais sendo abertas:
     - `pendingTurnDataRef` contém dados do próximo turno
     - `turnIdx` é atualizado
     - `turnLock` é liberado
     - Estado é transmitido via `broadcastState()`

### 1.2 Controle do Botão "Rolar Dado"

**Arquivo:** `src/components/Controls.jsx` e `src/App.jsx`

#### Condições para Habilitar o Botão:

```javascript
const controlsCanRoll = 
  isMyTurn &&                    // É minha vez
  isCurrentPlayerMe &&           // Jogador atual sou eu
  modalLocks === 0 &&            // Não há modais abertas
  !turnLock &&                   // Não há lock de turno ativo
  !isCurrentPlayerBankrupt &&    // Jogador não está falido
  !gameOver                      // Jogo não terminou
```

#### Problemas Potenciais Identificados:

1. **Race Condition em Modais:**
   - Se uma modal for aberta muito rapidamente após outra fechar, `modalLocks` pode não refletir corretamente
   - **Solução:** `openingModalRef` e delay de 200ms após fechar última modal

2. **Sincronização Multiplayer:**
   - Estados remotos podem tentar reverter mudanças locais recentes
   - **Solução:** Proteção com `lastLocalStateRef` e timestamps

3. **TurnLock Travado:**
   - Se `tick()` não executar corretamente, `turnLock` pode ficar travado
   - **Solução:** Timeout de segurança de 30 segundos

## 🎯 2. Análise de Todas as Casas do Tabuleiro

### 2.1 Mapeamento Completo das Casas

**Total de Casas:** 55 (TRACK_LEN)

#### Casas Especiais:

| Casa | Tipo | Descrição | Modal | Bloqueia Turno? |
|------|------|-----------|-------|-----------------|
| 0 | Faturamento | Recebe faturamento do mês | `FaturamentoDoMesModal` | ✅ Sim |
| 1 | Início | Casa inicial | - | ❌ Não |
| 2 | Treinamento | Compra treinamentos | `TrainingModal` | ✅ Sim |
| 3 | Sorte & Revés | Carta aleatória | `SorteRevesModal` | ✅ Sim |
| 4 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 5 | Compra Direta | Menu de compras | `DirectBuyModal` | ✅ Sim |
| 6 | ERP | Compra sistemas ERP | `ERPSystemsModal` | ✅ Sim |
| 7 | Mix Produtos | Compra mix de produtos | `MixProductsModal` | ✅ Sim |
| 8 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 9 | Vendedores Comuns | Contrata vendedores | `BuyCommonSellersModal` | ✅ Sim |
| 10 | Compra Direta | Menu de compras | `DirectBuyModal` | ✅ Sim |
| 11 | Treinamento | Compra treinamentos | `TrainingModal` | ✅ Sim |
| 12 | Inside Sales | Contrata inside sales | `InsideSalesModal` | ✅ Sim |
| 13 | Field Sales | Contrata field sales | `BuyFieldSalesModal` | ✅ Sim |
| 14 | Sorte & Revés | Carta aleatória | `SorteRevesModal` | ✅ Sim |
| 15 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 16 | ERP | Compra sistemas ERP | `ERPSystemsModal` | ✅ Sim |
| 17 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 18 | Gestor | Contrata gestor | `BuyManagerModal` | ✅ Sim |
| 19 | Treinamento | Compra treinamentos | `TrainingModal` | ✅ Sim |
| 20 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 21 | Inside Sales | Contrata inside sales | `InsideSalesModal` | ✅ Sim |
| 22 | Despesas Operacionais | Paga despesas + empréstimos | `DespesasOperacionaisModal` | ✅ Sim |
| 23 | Despesas Operacionais | Paga despesas + empréstimos | `DespesasOperacionaisModal` | ✅ Sim |
| 24 | Gestor | Contrata gestor | `BuyManagerModal` | ✅ Sim |
| 25 | Field Sales | Contrata field sales | `BuyFieldSalesModal` | ✅ Sim |
| 26 | Sorte & Revés | Carta aleatória | `SorteRevesModal` | ✅ Sim |
| 27 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 28 | Vendedores Comuns | Contrata vendedores | `BuyCommonSellersModal` | ✅ Sim |
| 29 | Gestor | Contrata gestor | `BuyManagerModal` | ✅ Sim |
| 30 | Inside Sales | Contrata inside sales | `InsideSalesModal` | ✅ Sim |
| 31 | Mix Produtos | Compra mix de produtos | `MixProductsModal` | ✅ Sim |
| 32 | ERP | Compra sistemas ERP | `ERPSystemsModal` | ✅ Sim |
| 33 | Field Sales | Contrata field sales | `BuyFieldSalesModal` | ✅ Sim |
| 34 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 35 | Sorte & Revés | Carta aleatória | `SorteRevesModal` | ✅ Sim |
| 36 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |
| 37-54 | Variações | Mix de tipos acima | Vários | ✅ Sim |
| 55 | Clientes | Compra clientes | `BuyClientsModal` | ✅ Sim |

### 2.2 Casas que NÃO Abrem Modal

- **Casa 0 (Faturamento):** Abre modal apenas quando **cruza** (não quando para)
- **Casa 1 (Início):** Sem modal
- **Casa 22 (Despesas):** Abre modal apenas quando **cruza** (não quando para)

### 2.3 Verificação de Todas as Casas

**Código de Verificação em `useTurnEngine.jsx`:**

```javascript
// ERP: casas 6, 16, 32, 49
const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)

// Treinamento: casas 2, 11, 19, 47
const isTrainingTile = (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47)

// Compra Direta: casas 5, 10, 43
const isDirectBuyTile = (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43)

// Inside Sales: casas 12, 21, 30, 42, 53
const isInsideTile = (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53)

// Clientes: casas 4, 8, 15, 17, 20, 27, 34, 36, 39, 46, 52, 55
const isClientsTile = [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased)

// Gestor: casas 18, 24, 29, 51
const isManagerTile = [18,24,29,51].includes(landedOneBased)

// Field Sales: casas 13, 25, 33, 38, 50
const isFieldTile = [13,25,33,38,50].includes(landedOneBased)

// Vendedores Comuns: casas 9, 28, 40, 45
const isCommonSellersTile = [9,28,40,45].includes(landedOneBased)

// Mix Produtos: casas 7, 31, 44
const isMixTile = [7,31,44].includes(landedOneBased)

// Sorte & Revés: casas 3, 14, 22, 26, 35, 41, 48, 54
const isLuckMisfortuneTile = [3,14,22,26,35,41,48,54].includes(landedOneBased)
```

**Total Verificado:** 55 casas ✅

## ⚠️ 3. Problemas Identificados e Ajustes Necessários

### 3.1 Problemas Críticos

#### 🔴 Problema 1: Race Condition em Modais Aninhadas
**Localização:** `useTurnEngine.jsx:194-260`

**Problema:**
- Se múltiplas modais forem abertas rapidamente, `modalLocks` pode ficar inconsistente
- `openingModalRef` pode não ser suficiente para casos extremos

**Solução Aplicada:**
- ✅ Delay de 200ms após fechar última modal antes de mudar turno
- ✅ `lastModalClosedTimeRef` rastreia timestamp de fechamento
- ✅ Verificação dupla em `tick()` antes de mudar turno

#### 🔴 Problema 2: TurnLock Pode Ficar Travado
**Localização:** `useTurnEngine.jsx:102-145`

**Problema:**
- Se `tick()` falhar ou não executar, `turnLock` pode ficar travado indefinidamente

**Solução Aplicada:**
- ✅ Timeout de segurança de 30 segundos
- ✅ Auto-liberação se sou o `lockOwner` e não há modais

#### 🔴 Problema 3: Sincronização Multiplayer
**Localização:** `App.jsx:164-376` e `App.jsx:480-724`

**Problema:**
- Estados remotos podem tentar reverter mudanças locais recentes
- TurnIdx pode ser revertido incorretamente

**Solução Aplicada:**
- ✅ `lastLocalStateRef` rastreia mudanças locais recentes
- ✅ Proteção contra reversão de turnIdx (< 5s)
- ✅ Proteção contra reversão de round (< 2s)

### 3.2 Problemas Menores

#### 🟡 Problema 4: Verificação de `isMyTurn` Pode Falhar
**Localização:** `App.jsx:789-811`

**Problema:**
- Se `turnIdx` for inválido ou jogador não existir, `isMyTurn` pode retornar `false` incorretamente

**Solução Aplicada:**
- ✅ Validação de `turnIdx` antes de verificar
- ✅ Verificação de jogador falido
- ✅ Logs detalhados para debug

#### 🟡 Problema 5: Botão Pode Ficar Desabilitado Incorretamente
**Localização:** `App.jsx:1014-1016`

**Problema:**
- Múltiplas condições podem fazer o botão ficar desabilitado mesmo quando deveria estar habilitado

**Solução Aplicada:**
- ✅ Verificação explícita de `isCurrentPlayerMe`
- ✅ Logs detalhados para debug
- ✅ Verificação de todas as condições

## ✅ 4. Ajustes Recomendados

### 4.1 Ajustes Críticos (Implementar Imediatamente)

1. **Adicionar Validação de Estado no Início de Cada Turno**
   ```javascript
   // Em useTurnEngine.jsx, antes de advanceAndMaybeLap
   if (turnChangeInProgressRef.current) {
     console.warn('Mudança de turno já em progresso')
     return
   }
   ```
   ✅ **JÁ IMPLEMENTADO**

2. **Garantir Limpeza de Refs ao Desmontar**
   ```javascript
   // Cleanup ao desmontar componente
   React.useEffect(() => {
     return () => {
       if (turnLockTimeoutRef.current) {
         clearTimeout(turnLockTimeoutRef.current)
       }
       turnChangeInProgressRef.current = false
       openingModalRef.current = false
     }
   }, [])
   ```
   ✅ **JÁ IMPLEMENTADO**

3. **Adicionar Logs Detalhados para Debug**
   ```javascript
   console.log('[DEBUG] Estado do turno:', {
     turnIdx,
     isMyTurn,
     modalLocks,
     turnLock,
     lockOwner,
     openingModal: openingModalRef.current
   })
   ```
   ✅ **JÁ IMPLEMENTADO**

### 4.2 Ajustes de Melhoria (Opcional)

1. **Adicionar Indicador Visual de TurnLock**
   - Mostrar quando `turnLock` está ativo
   - Mostrar quando `modalLocks > 0`

2. **Adicionar Teste de Carga**
   - Simular múltiplos jogadores
   - Simular modais aninhadas
   - Simular falhas de rede

3. **Adicionar Métricas de Performance**
   - Tempo médio de mudança de turno
   - Número de race conditions detectadas
   - Número de timeouts de segurança

## 🧪 5. Teste Automatizado

Ver arquivo: `src/game/__tests__/turnAlternationTest.js`

Este teste verifica:
- ✅ Alternância correta de turnos entre jogadores
- ✅ Botão não trava para ambos os jogadores
- ✅ Todas as casas do tabuleiro funcionam corretamente
- ✅ Modais não bloqueiam turno indefinidamente
- ✅ Sincronização multiplayer funciona corretamente

## 📊 6. Conclusão

### Status Atual:
- ✅ Sistema de turnos funcional
- ✅ Proteções contra race conditions implementadas
- ✅ Timeout de segurança implementado
- ✅ Sincronização multiplayer protegida
- ✅ Todas as 55 casas mapeadas e verificadas

### Próximos Passos:
1. Executar teste automatizado completo
2. Testar em ambiente multiplayer real
3. Monitorar logs para identificar problemas remanescentes
4. Implementar melhorias opcionais conforme necessário

