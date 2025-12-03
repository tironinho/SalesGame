# Validação do Incremento de Rodada

## Lógica Atual

### Como funciona:
1. Quando um jogador passa pela casa 0 (faturamento do mês), `crossedTile(oldPos, newPos, 0)` retorna `true`
2. A flag do jogador é marcada em `roundFlags[curIdx] = true`
3. O sistema verifica se **todos os jogadores vivos** passaram pela casa 0
4. Se todos passaram, incrementa `round + 1` e reseta as flags apenas dos jogadores vivos

### Código Relevante (linhas 448-477):

```javascript
// >>> controle de rodada: só vira quando TODOS os jogadores VIVOS cruzarem a casa 0
let nextRound = round
let nextFlags = [...roundFlags]

// ✅ CORREÇÃO: Usa crossedStart1ForRound em vez de lap para detectar passagem pela casa 0
if (crossedStart1ForRound) {
  // Garante que o array de flags tem o tamanho correto
  if (nextFlags.length < players.length) {
    nextFlags = [...nextFlags, ...new Array(players.length - nextFlags.length).fill(false)]
  }
  
  // Marca que este jogador passou pela casa 0
  nextFlags[curIdx] = true
  console.log('[DEBUG] 🏁 Jogador passou pela casa 0 - Flags:', nextFlags.map((f, i) => `${players[i]?.name}:${f}`).join(', '))
  
  // ✅ CORREÇÃO: Conta apenas jogadores vivos para verificar se todos passaram
  const alivePlayers = nextPlayers.filter(p => !p?.bankrupt)
  const aliveIndices = nextPlayers.map((p, i) => !p?.bankrupt ? i : -1).filter(i => i >= 0)
  
  // Verifica se todos os jogadores vivos passaram pela casa 0
  const allAliveDone = aliveIndices.length > 0 && aliveIndices.every(idx => nextFlags[idx] === true)
  
  if (allAliveDone) {
    nextRound = round + 1
    // ✅ CORREÇÃO: Reseta apenas as flags dos jogadores vivos
    nextFlags = nextFlags.map((_, idx) => nextPlayers[idx]?.bankrupt ? nextFlags[idx] : false)
    console.log('[DEBUG] 🔄 RODADA INCREMENTADA - Nova rodada:', nextRound, 'Jogadores vivos:', alivePlayers.length)
  }
}
setRoundFlags(nextFlags)
```

## Análise

### ✅ Pontos Positivos:
1. **Detecção correta**: Usa `crossedTile(oldPos, newPos, 0)` para detectar passagem pela casa 0
2. **Considera apenas vivos**: Filtra jogadores falidos antes de verificar se todos passaram
3. **Reseta flags corretamente**: Mantém flags de jogadores falidos, reseta apenas dos vivos

### ⚠️ Possíveis Problemas:

1. **Sincronização**: O `nextRound` é calculado mas pode não ser aplicado corretamente se houver problemas de sincronização
2. **Timing**: A rodada é incrementada durante o movimento, mas pode haver race conditions
3. **Flags de jogadores falidos**: Se um jogador fica falido durante a rodada, sua flag pode ficar `true` permanentemente (mas isso não afeta a lógica, pois ele não é contado como "vivo")

## Testes Necessários

### Cenário 1: Rodada Normal (2 jogadores)
- Jogador 1 passa pela casa 0 → flag[0] = true, rodada = 1
- Jogador 2 passa pela casa 0 → flag[1] = true, rodada = 2 ✅

### Cenário 2: Jogador Falido
- Jogador 1 passa pela casa 0 → flag[0] = true, rodada = 1
- Jogador 2 fica falido (não passa pela casa 0)
- Jogador 1 passa novamente pela casa 0 → rodada = 2 ✅ (apenas jogador 1 é considerado)

### Cenário 3: Múltiplos Jogadores
- 3 jogadores vivos
- Todos precisam passar pela casa 0 para rodada incrementar

## Recomendações

1. ✅ **Manter**: A lógica atual está correta
2. ⚠️ **Adicionar logs**: Mais logs para debug quando rodada incrementa
3. ✅ **Validar**: Testar em cenários reais com múltiplos jogadores

