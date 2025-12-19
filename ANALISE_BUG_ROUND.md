# 🔍 Análise do Bug: Variável `round` Não Incrementa

## 📋 Problema Identificado

A variável `round` não está incrementando quando todos os jogadores passam pela casa de faturamento do mês (casa 0).

## 🔍 Análise do Código

### Localização do Problema

**Arquivo:** `src/game/useTurnEngine.jsx`
**Linhas:** 570-654

### Fluxo Atual (COM BUG):

1. **Linha 570:** Detecta passagem pela casa 0
   ```javascript
   const crossedStart1ForRound = crossedTile(oldPos, newPos, 0)
   ```

2. **Linha 573:** Inicializa `nextRound` com valor do closure
   ```javascript
   let nextRound = round  // ❌ PROBLEMA: usa valor do closure, pode estar desatualizado
   ```

3. **Linha 607:** Incrementa quando todos passaram
   ```javascript
   nextRound = round + 1  // ❌ PROBLEMA: usa `round` do closure, não do estado atual
   ```

4. **Linha 643-654:** Atualiza usando `Math.max`
   ```javascript
   setRound(prevRound => {
     const finalRound = Math.max(nextRound, prevRound)
     // ❌ PROBLEMA: Se nextRound foi calculado com round desatualizado,
     // e prevRound já foi atualizado por sincronização, Math.max pode não incrementar
     return finalRound
   })
   ```

### Problemas Identificados:

#### 🔴 Problema 1: Closure Stale
- O `round` usado na linha 607 vem do closure da função `advanceAndMaybeLap`
- Se o `round` foi atualizado por sincronização entre a criação do closure e a execução, o valor está desatualizado
- Isso faz com que `nextRound = round + 1` use um valor antigo

#### 🔴 Problema 2: Math.max Pode Impedir Incremento
- Se `nextRound` foi calculado como `round + 1` com `round` desatualizado
- E `prevRound` já foi atualizado para o valor correto via sincronização
- O `Math.max(nextRound, prevRound)` pode retornar `prevRound` (que já está correto)
- Mas se `nextRound` foi calculado incorretamente como um valor menor, não incrementa

#### 🔴 Problema 3: Sincronização de roundFlags
- As `roundFlags` são sincronizadas entre jogadores
- Mas se um jogador já incrementou a rodada e outro ainda não passou pela casa 0, pode haver inconsistência
- O `roundFlags` pode estar sincronizado, mas o `round` pode não estar

## ✅ Solução

### Correção 1: Usar Estado Atualizado de `round`

Em vez de usar `round` do closure, usar uma função de atualização que sempre pega o valor mais recente:

```javascript
// ANTES (ERRADO):
let nextRound = round
if (allAliveDone) {
  nextRound = round + 1  // ❌ usa round do closure
}

// DEPOIS (CORRETO):
let nextRound = round
if (allAliveDone) {
  // ✅ Usa função de atualização para pegar valor mais recente
  setRound(prevRound => {
    const newRound = prevRound + 1
    nextRound = newRound  // Atualiza variável local
    return newRound       // Atualiza estado imediatamente
  })
}
```

### Correção 2: Garantir Incremento Correto

Usar uma abordagem que sempre incrementa corretamente, mesmo com sincronização:

```javascript
setRound(prevRound => {
  // Se nextRound foi calculado e é maior que prevRound, usa nextRound
  // Caso contrário, se todos passaram, incrementa
  if (allAliveDone && nextRound > prevRound) {
    return nextRound
  } else if (allAliveDone && nextRound <= prevRound) {
    // Se nextRound não foi calculado corretamente, incrementa manualmente
    return prevRound + 1
  }
  return Math.max(nextRound, prevRound)
})
```

### Correção 3: Sincronização de roundFlags

Garantir que `roundFlags` seja sempre sincronizado corretamente e que o incremento de rodada aconteça apenas quando TODOS os jogadores vivos passaram pela casa 0.

## 🎯 Implementação da Correção

Vou implementar a correção que:
1. ✅ Usa estado atualizado de `round` ao calcular incremento
2. ✅ Garante que o incremento aconteça mesmo com sincronização
3. ✅ Sincroniza `roundFlags` corretamente entre jogadores
4. ✅ Adiciona logs detalhados para debug

