# 🐛 BUG CRÍTICO: Sincronização Multiplayer

## ❌ PROBLEMA IDENTIFICADO

Quando o **Player1 compra algo** (ex: ERP, Clientes, Vendedores), o **Player2** recebe os dados sincronizados e **SOBRESCREVE seus próprios dados** (cash, bens, clientes, vendedores, etc.), mantendo apenas os certificados locais.

### **Cenário do Bug**

1. **Player1** compra um ERP (gasta R$ 10.000)
   - Player1: `cash: 18000` → `cash: 8000`
   - Player1: `erpLevel: 'D'` → `erpLevel: 'C'`

2. **Sincronização** envia dados para Player2
   - `broadcastState()` envia `players` atualizado
   - Player2 recebe via `BroadcastChannel` ou `Supabase`

3. **Player2 recebe os dados** e SOBRESCREVE seus próprios dados
   - Player2: `cash: 18000` → `cash: 8000` ❌ (PERDEU R$ 10.000!)
   - Player2: `erpLevel: 'D'` → `erpLevel: 'C'` ❌ (GANHOU upgrade de graça!)
   - Player2: `bens: 4000` → `bens: 4000` (pode ser diferente)
   - Player2: `clients: 1` → `clients: 1` (pode ser diferente)

### **O que é preservado (corretamente)**
- ✅ `az`, `am`, `rox` (certificados)
- ✅ `trainingsByVendor` (treinamentos)
- ✅ `onboarding` (flag)

### **O que é SOBRESCRITO (incorretamente)**
- ❌ `cash` (dinheiro)
- ❌ `bens` (patrimônio)
- ❌ `clients` (clientes)
- ❌ `vendedoresComuns` (vendedores comuns)
- ❌ `fieldSales` (field sales)
- ❌ `insideSales` (inside sales)
- ❌ `gestores` (gestores)
- ❌ `mixProdutos` (mix de produtos)
- ❌ `erpLevel` (nível ERP)
- ❌ `pos` (posição no tabuleiro)
- ❌ Todos os outros dados do jogador

---

## 📍 LOCALIZAÇÃO DO BUG

### **Arquivo**: `src/App.jsx`

#### **1. BroadcastChannel SYNC (linhas 164-201)**

```javascript
if (d.type === 'SYNC' && phase === 'game') {
  // ...
  const syncedPlayers = d.players.map(syncedPlayer => {
    const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
    if (!localPlayer) return syncedPlayer
    
    return {
      ...syncedPlayer,  // ❌ SOBRESCREVE TODOS OS DADOS
      // Preserva apenas certificados e treinamentos locais
      az: localPlayer.az || syncedPlayer.az || 0,
      am: localPlayer.am || syncedPlayer.am || 0,
      rox: localPlayer.rox || syncedPlayer.rox || 0,
      trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
      onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
    }
  })
  setPlayers(syncedPlayers)  // ❌ APLICA DADOS SOBRESCRITOS
}
```

#### **2. Supabase SYNC (linhas 268-300)**

```javascript
if (np && JSON.stringify(np) !== JSON.stringify(players)) { 
  const syncedPlayers = np.map(syncedPlayer => {
    const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
    if (!localPlayer) return syncedPlayer
    
    return {
      ...syncedPlayer,  // ❌ SOBRESCREVE TODOS OS DADOS
      // Preserva apenas dados de progresso local (certificados e treinamentos)
      az: localPlayer.az || syncedPlayer.az || 0,
      am: localPlayer.am || syncedPlayer.am || 0,
      rox: localPlayer.rox || syncedPlayer.rox || 0,
      trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
      onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
    }
  })
  setPlayers(syncedPlayers);  // ❌ APLICA DADOS SOBRESCRITOS
}
```

---

## ✅ SOLUÇÃO

### **Correção Necessária**

A sincronização deve **preservar os dados locais** quando é o próprio jogador, e **aplicar apenas os dados sincronizados de outros jogadores**.

#### **Correção para BroadcastChannel SYNC**

```javascript
if (d.type === 'SYNC' && phase === 'game') {
  setTurnIdx(d.turnIdx)
  setRound(d.round)
  
  const syncedPlayers = d.players.map(syncedPlayer => {
    const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
    if (!localPlayer) return syncedPlayer
    
    // ✅ CORREÇÃO: Se é o próprio jogador, preserva dados locais
    if (String(syncedPlayer.id) === String(myUid)) {
      // Preserva TODOS os dados locais do próprio jogador
      return {
        ...localPlayer,
        // Aplica apenas certificados e treinamentos sincronizados (se houver)
        az: syncedPlayer.az || localPlayer.az || 0,
        am: syncedPlayer.am || localPlayer.am || 0,
        rox: syncedPlayer.rox || localPlayer.rox || 0,
        trainingsByVendor: syncedPlayer.trainingsByVendor || localPlayer.trainingsByVendor || {},
        onboarding: syncedPlayer.onboarding !== undefined ? syncedPlayer.onboarding : localPlayer.onboarding
      }
    }
    
    // ✅ CORREÇÃO: Para outros jogadores, aplica dados sincronizados
    return {
      ...syncedPlayer,
      // Preserva certificados e treinamentos locais (se houver)
      az: localPlayer.az || syncedPlayer.az || 0,
      am: localPlayer.am || syncedPlayer.am || 0,
      rox: localPlayer.rox || syncedPlayer.rox || 0,
      trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
      onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
    }
  })
  setPlayers(syncedPlayers)
  
  // ... resto do código
}
```

#### **Correção para Supabase SYNC**

```javascript
if (np && JSON.stringify(np) !== JSON.stringify(players)) { 
  const syncedPlayers = np.map(syncedPlayer => {
    const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
    if (!localPlayer) return syncedPlayer
    
    // ✅ CORREÇÃO: Se é o próprio jogador, preserva dados locais
    if (String(syncedPlayer.id) === String(myUid)) {
      // Preserva TODOS os dados locais do próprio jogador
      return {
        ...localPlayer,
        // Aplica apenas certificados e treinamentos sincronizados (se houver)
        az: syncedPlayer.az || localPlayer.az || 0,
        am: syncedPlayer.am || localPlayer.am || 0,
        rox: syncedPlayer.rox || localPlayer.rox || 0,
        trainingsByVendor: syncedPlayer.trainingsByVendor || localPlayer.trainingsByVendor || {},
        onboarding: syncedPlayer.onboarding !== undefined ? syncedPlayer.onboarding : localPlayer.onboarding
      }
    }
    
    // ✅ CORREÇÃO: Para outros jogadores, aplica dados sincronizados
    return {
      ...syncedPlayer,
      // Preserva certificados e treinamentos locais (se houver)
      az: localPlayer.az || syncedPlayer.az || 0,
      am: localPlayer.am || syncedPlayer.am || 0,
      rox: localPlayer.rox || syncedPlayer.rox || 0,
      trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
      onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
    }
  })
  setPlayers(syncedPlayers); 
  changed = true 
}
```

---

## 🧪 TESTE DO BUG

### **Passos para Reproduzir**

1. Abra 2 abas do navegador (ou 2 navegadores diferentes)
2. Entre na mesma sala com 2 jogadores diferentes
3. **Player1**: Compre algo (ex: ERP, Cliente, Vendedor)
4. **Player2**: Observe o painel (HUD)
5. **Resultado**: Player2 perde dinheiro/recursos e ganha o que Player1 comprou

### **Evidência do Bug**

- **Player1** compra ERP nível C (gasta R$ 10.000)
  - Player1: `cash: 8000`, `erpLevel: 'C'`

- **Player2** recebe sincronização
  - Player2: `cash: 8000` ❌ (deveria ser 18000)
  - Player2: `erpLevel: 'C'` ❌ (deveria ser 'D')

---

## 📊 IMPACTO

### **Severidade**: 🔴 **CRÍTICA**

### **Consequências**

1. **Player2 perde dinheiro** quando Player1 compra algo
2. **Player2 ganha recursos** que Player1 comprou (sem pagar)
3. **Jogo fica inválido** - dados inconsistentes entre jogadores
4. **Experiência de jogo quebrada** - multiplayer não funciona corretamente

### **Afeta**

- ✅ Todos os recursos do jogo (cash, bens, clientes, vendedores, etc.)
- ✅ Todos os tipos de compras (ERP, Mix, Clientes, Vendedores, Gestores, etc.)
- ✅ Todas as ações que modificam o estado do jogador
- ✅ Sincronização via BroadcastChannel e Supabase

---

## 🔧 IMPLEMENTAÇÃO DA CORREÇÃO

A correção deve ser aplicada em **2 locais**:

1. **BroadcastChannel SYNC** (linha ~174)
2. **Supabase SYNC** (linha ~278)

A lógica deve ser:
- **Se é o próprio jogador** (`id === myUid`): Preserva dados locais
- **Se é outro jogador**: Aplica dados sincronizados

---

## 📝 NOTAS

### **Por que certificados são preservados?**

Certificados (`az`, `am`, `rox`) e treinamentos (`trainingsByVendor`) são considerados "dados de progresso pessoal" que não afetam o estado global do jogo. Eles são preservados localmente para permitir que cada jogador tenha seus próprios certificados independentemente da sincronização.

### **Por que outros dados não são preservados?**

Todos os outros dados (cash, bens, clientes, vendedores, etc.) são parte do estado global do jogo e devem ser sincronizados entre jogadores. No entanto, **cada jogador deve ver apenas seus próprios dados**, não os dados de outros jogadores.

---

**Bug identificado em**: 2024  
**Severidade**: 🔴 Crítica  
**Status**: 🐛 Confirmado - Correção necessária

