# 🎮 Análise Detalhada: Regras, Mecânicas e Multiplayer

## 📋 Sumário Executivo

Este documento fornece uma análise profunda das **regras de negócio**, **mecânicas de jogo** e **sistema multiplayer** do Sales Game, baseado na análise do código-fonte.

---

## 🎯 OBJETIVO DO JOGO

### **Condição de Vitória**
- **Primeiro jogador a completar 5 voltas completas no tabuleiro** (55 casas × 5 = 275 casas percorridas)
- **Alternativa**: Se todos os outros jogadores falirem, o último sobrevivente vence
- **Critério de Desempate**: Maior patrimônio (Cash + Bens)

### **Fim de Jogo**
- ✅ Jogo termina quando: `round > 5` (todos completaram 5 rodadas)
- ✅ Vencedor é determinado por: `patrimonio = cash + bens`
- ✅ Jogadores falidos são excluídos do ranking final

---

## 🏗️ ESTRUTURA DO TABULEIRO

### **Características**
- **55 casas** no total (0-54 em código)
- **Casa 0**: Partida/Faturamento do Mês (início)
- **Casa 22**: Despesas Operacionais (meio do tabuleiro)
- **Casa 55**: Última casa antes de completar a volta

### **Tipos de Casas**

| Tipo | Casas | Descrição |
|------|-------|-----------|
| **ERP** | 6, 16, 32, 49 | Upgrade de sistemas ERP |
| **Treinamento** | 2, 11, 19, 47 | Certificados e treinamentos |
| **Compra Direta** | 5, 10, 43 | Menu de compras (Mix, Gestor, Inside, Field, Common, ERP, Clientes, Treinamento) |
| **Inside Sales** | 12, 21, 30, 42, 53 | Contratação de Inside Sales |
| **Clientes** | 4, 8, 15, 17, 20, 27, 34, 36, 39, 46, 52, 55 | Compra de clientes |
| **Gestor** | 18, 24, 29, 51 | Contratação de gestores |
| **Field Sales** | 13, 25, 33, 38, 50 | Contratação de Field Sales |
| **Vendedores Comuns** | 9, 28, 40, 45 | Contratação de vendedores comuns |
| **Mix Produtos** | 7, 31, 44 | Upgrade de mix de produtos |
| **Sorte & Revés** | 3, 14, 22, 26, 35, 41, 48, 54 | Eventos aleatórios |

### **Casas Especiais**
- **Casa 0**: Ao passar por aqui, recebe **Faturamento do Mês**
- **Casa 22**: Ao passar por aqui, paga **Despesas Operacionais** + **Empréstimos Pendentes**

---

## 💰 SISTEMA DE RECURSOS

### **Recursos Principais**

#### **1. Cash (Dinheiro)**
- **Inicial**: R$ 18.000
- **Função**: Moeda principal para compras e pagamentos
- **Não pode ser negativo**: Mínimo = 0

#### **2. Bens (Patrimônio)**
- **Inicial**: R$ 4.000
- **Função**: Parte do patrimônio total (usado no ranking final)
- **Aumenta**: Compras de clientes, treinamentos, upgrades

#### **3. Clientes**
- **Inicial**: 1 cliente
- **Função**: Gera faturamento baseado no Mix de Produtos
- **Limite**: Capacidade de atendimento (vendedores)

#### **4. Vendedores**
- **Vendedores Comuns**: Cap: 2 clientes, Fat: R$ 600 + (R$ 100 × certificados)
- **Inside Sales**: Cap: 5 clientes, Fat: R$ 1.500 + (R$ 500 × certificados)
- **Field Sales**: Cap: 5 clientes, Fat: R$ 1.500 + (R$ 500 × certificados)

#### **5. Gestores**
- **Função**: Aumenta faturamento dos vendedores (boost)
- **Custo Base**: R$ 3.000 + (R$ 500 × certificados)
- **Boost**: 20%, 30%, 40%, 60% baseado em certificados (0-3+)
- **Cobertura**: Máximo 7 colaboradores por gestor

#### **6. Mix de Produtos**
- **Níveis**: A, B, C, D (inicial: D)
- **Faturamento por Cliente**: A: R$ 1.200, B: R$ 600, C: R$ 300, D: R$ 100
- **Despesa por Cliente**: A: R$ 700, B: R$ 400, C: R$ 200, D: R$ 50

#### **7. ERP/Sistemas**
- **Níveis**: A, B, C, D (inicial: D)
- **Faturamento por Colaborador**: A: R$ 1.000, B: R$ 500, C: R$ 200, D: R$ 70
- **Despesa por Colaborador**: A: R$ 400, B: R$ 200, C: R$ 100, D: R$ 50

#### **8. Certificados**
- **Azul (az)**: Protege contra "Necessidades Mudaram" (-4 clientes)
- **Amarelo (am)**: Protege contra "Cliente Chave em Risco" (-1 cliente, -R$ 2.000)
- **Roxo (rox)**: Bônus de R$ 25.000 em cartas de sorte

---

## 📊 CÁLCULOS FINANCEIROS

### **Faturamento Mensal**

```javascript
// Faturamento de Vendedores
fatComum = vendedoresComuns × (600 + 100 × certificados)
fatInside = insideSales × (1500 + 500 × certificados)
fatField = fieldSales × (1500 + 500 × certificados)
vendorRevenue = fatComum + fatInside + fatField

// Boost de Gestores
cobertura = min(1, (gestores × 7) / colaboradores)
boost = [0.20, 0.30, 0.40, 0.60][certificadosGestor] // 0-3+
vendorRevenue = vendorRevenue × (1 + cobertura × boost)

// Faturamento de Mix de Produtos
mixFat = MIX[mixLevel].fat × clientes

// Faturamento de ERP
erpFat = ERP[erpLevel].fat × (colaboradores + gestores)

// Faturamento Total
total = vendorRevenue + mixFat + erpFat + dynamicRevenue
```

### **Despesas Mensais**

```javascript
// Despesas de Vendedores
dComum = vendedoresComuns × (100 + 100 × certificados)
dInside = insideSales × (2000 + 100 × certificados)
dField = fieldSales × (2000 + 100 × certificados)

// Despesas de Gestores
dGestor = gestores × (3000 + 500 × certificados)

// Despesas de Mix de Produtos
mixDesp = MIX[mixLevel].desp × clientes

// Despesas de ERP
erpDesp = ERP[erpLevel].desp × (colaboradores + gestores)

// Despesas Totais
total = dComum + dInside + dField + dGestor + mixDesp + erpDesp + 1000 (base)
```

### **Capacidade e Atendimento**

```javascript
capacidade = (vendedoresComuns × 2) + (insideSales × 5) + (fieldSales × 5)
clientesEmAtendimento = min(clientes, capacidade)
```

---

## 🎲 MECÂNICAS DE TURNO

### **Fluxo de Turno**

1. **Rolar Dado** (1-6)
2. **Mover no Tabuleiro** (posição atual + dado)
3. **Verificar Eventos**:
   - Parou em casa específica → Modal de compra/evento
   - Passou pela casa 0 → Faturamento do Mês
   - Passou pela casa 22 → Despesas Operacionais
4. **Ações Disponíveis** (se tiver recursos):
   - Comprar recursos
   - Treinar equipe
   - Upgrades
5. **Próximo Turno** (após todas as modais fecharem)

### **Sistema de Rodadas**

- **Rodada**: Incrementa quando **TODOS** os jogadores passam pela casa 0
- **Flag de Rodada**: Array booleano para rastrear quem já passou
- **Jogo termina**: Após 5 rodadas completas

### **Sistema de Bloqueio de Turno**

- **Turn Lock**: Bloqueia ações de outros jogadores durante o turno atual
- **Modal Locks**: Contador de modais abertas (impede mudança de turno)
- **Lock Owner**: ID do jogador que iniciou o turno (só ele pode destravar)

---

## 🎴 EVENTOS DE SORTE E REVÉS

### **Cartas de Sorte** (Benefícios)

| ID | Título | Efeito |
|----|--------|--------|
| `gov_fgts` | Ação Governamental Positiva | +5 clientes |
| `referral_bonus` | Indicação Lucrativa | +R$ 800 |
| `network_cert_mgr` | Rede Estratégica | +R$ 5.000 × gestores certificados |
| `innovation_invest` | Inovação Premiada | +R$ 25.000 (se Mix A/B) |
| `segmentation` | Segmentação Inteligente | +R$ 1.000 |
| `casa_bonus_10k` | Casagrande Insights | +R$ 10.000 |
| `casa_network_7k` | Rede de Contatos Valiosa | +R$ 7.000 |
| `casa_strategy_5k` | Estratégia Personalizada | +R$ 5.000 |
| `casa_best_practices_8k` | Melhores Práticas | +R$ 8.000 |
| `casa_start_6k` | Satisfação do Cliente em Alta | +R$ 6.000 |
| `casa_change_cert_blue` | Gestão de Mudanças | +1 certificado azul |
| `training_roi_team` | Treinamento Personalizado | +R$ 500 × membros da equipe |
| `purple_award_25k` | Profissional do Ano | +R$ 25.000 (se tiver certificado roxo) |
| `reputation_1500` | Reputação Impecável | +R$ 1.500 |
| `client_cheer_per_client` | Cliente Promotor | +R$ 500 × clientes |
| `big_order_freight_save` | Grande Pedido | +R$ 1.500 |
| `sales_win_2k` | Vitória de Vendas | +R$ 2.000 |

### **Cartas de Revés** (Penalidades)

| ID | Título | Efeito | Proteção |
|----|--------|--------|----------|
| `missed_admission` | Admissão Não Reportada | -R$ 3.000 | - |
| `office_renovation` | Renovação Custosa | -R$ 7.000 | - |
| `env_fine_20k` | Impacto Ambiental | -R$ 20.000 | - |
| `key_client_at_risk` | Cliente Chave em Risco | -1 cliente, -R$ 2.000 | Certificado Amarelo |
| `social_crisis` | Crise nas Redes | -R$ 400, -2 clientes | - |
| `car_break` | Carro Quebrou | -R$ 1.000 | - |
| `service_improvement_1k` | Aprimoramentos de Serviço | -R$ 1.000 | - |
| `recovery_failed_5k` | Recuperação Mal Sucedida | -R$ 5.000 | - |
| `discount_pressure_1k` | Descontos Forçados | -R$ 1.000 | - |
| `domino_2k` | Efeito Dominó | -R$ 2.000 | - |
| `needs_change_lose4` | Necessidades Mudaram | -4 clientes | Certificado Azul |
| `payroll_error_1k` | Erro na Folha | -R$ 1.000 | - |
| `strike_lose5` | Greve Inesperada | -5 clientes | - |
| `customs_hold_3k` | Alfândega | -R$ 3.000 | - |
| `cyber_breach_7k_or_A` | Falha de Segurança | -R$ 7.000 | ERP Nível A |
| `supplier_issue_2k` | Fornecedor em Crise | -R$ 2.000 | - |
| `reg_change_30k` | Regulamentação Nova | -R$ 30.000 | - |
| `bad_mix_2500` | Mix de Produtos Desequilibrado | -R$ 2.500 | - |
| `quality_crisis` | Crise de Qualidade | -1 cliente, -R$ 1.000 | - |

---

## 💸 SISTEMA DE RECUPERAÇÃO FINANCEIRA

### **Opções Disponíveis**

#### **1. Empréstimo**
- **Função**: Aumenta cash imediatamente
- **Cobrança**: Na próxima passagem pela casa 22 (Despesas Operacionais)
- **Limite**: Apenas 1 empréstimo pendente por vez
- **Restrição**: Se já tiver empréstimo, deve declarar falência

#### **2. Demissão (Fire)**
- **Função**: Reduz vendedores e recebe crédito
- **Crédito por Tipo**:
  - Vendedor Comum: Valor variável
  - Inside Sales: Valor variável
  - Field Sales: Valor variável
  - Gestor: Valor variável
- **Efeito**: Reduz despesas mensais

#### **3. Redução (Reduce)**
- **Função**: Reduz níveis de Mix/ERP e recebe crédito
- **Crédito**: Valor de compra do nível (parcial)
- **Efeito**: Reduz faturamento e despesas

### **Fluxo de Recuperação**

1. **Saldo Insuficiente** → Modal de aviso
2. **Opções**:
   - Recuperação Financeira (modal)
   - Declarar Falência
3. **Se escolher Recuperação**:
   - Escolher tipo (Empréstimo, Demissão, Redução)
   - Confirmar ação
4. **Se escolher Falência**:
   - Jogador é removido do jogo
   - Jogo continua até haver vencedor

---

## 💀 SISTEMA DE FALÊNCIA

### **Condições**
- Jogador pode declarar falência voluntariamente
- Jogador não pode pagar despesas obrigatórias
- Jogador já tem empréstimo e não pode pagar despesas

### **Efeitos**
- **Jogador**: Marcado como `bankrupt: true`
- **Remoção**: Pula turnos (não joga mais)
- **Ranking**: Excluído do ranking final
- **Jogo**: Continua até haver vencedor ou todos falirem

### **Fim de Jogo por Falência**
- Se apenas 1 jogador vivo → Vence automaticamente
- Se todos falirem → Jogo termina sem vencedor

---

## 🔄 SISTEMA MULTIPLAYER

### **Arquitetura de Sincronização**

#### **3 Camadas de Sincronização**

1. **Local (Single Tab)**
   - Estado React local
   - Sem sincronização

2. **Multi-Aba (BroadcastChannel)**
   - Sincroniza entre abas do **mesmo navegador**
   - Mensagens via `BroadcastChannel API`
   - Chave: `sg-sync:{roomCode}`

3. **Multi-Navegador (Supabase)**
   - Sincroniza entre **diferentes navegadores**
   - Banco de dados: PostgreSQL (Supabase)
   - Realtime: PostgreSQL Changes
   - Polling de segurança: Fallback (700ms)

### **Estratégia de Sincronização**

#### **Estado Sincronizado**
```javascript
{
  players: [...],      // Array de jogadores
  turnIdx: 0,         // Índice do jogador da vez
  round: 1,           // Rodada atual
  gameOver: false,    // Flag de fim de jogo
  winner: null        // Jogador vencedor
}
```

#### **Dados Preservados Localmente**
- **Certificados**: `az`, `am`, `rox` (não sincronizados)
- **Treinamentos**: `trainingsByVendor` (não sincronizados)
- **Onboarding**: `onboarding` (não sincronizados)

**Motivo**: Dados de progresso pessoal que não afetam o estado global do jogo.

#### **Versionamento**
- **Versão**: Incrementa a cada commit
- **Conflitos**: Evitados por versão (última versão vence)
- **Merge**: Não há merge automático (apenas última versão)

### **Sistema de Salas (Lobbies)**

#### **Tabelas Supabase**
1. **`lobbies`**: Salas de jogo
   - `id`: UUID
   - `name`: Nome da sala
   - `max_players`: Máximo de jogadores (padrão: 4)
   - `status`: 'open' | 'closed'
   - `host_id`: ID do host

2. **`lobby_players`**: Jogadores nas salas
   - `lobby_id`: ID da sala
   - `player_id`: ID do jogador
   - `player_name`: Nome do jogador
   - `ready`: Status de pronto
   - `joined_at`: Data de entrada

3. **`rooms`**: Estado do jogo (sync)
   - `code`: Código único da sala
   - `state`: JSON com estado do jogo
   - `version`: Versão do estado
   - `host_id`: ID do host

4. **`matches`**: Histórico de partidas
   - `id`: UUID
   - `lobby_id`: ID da sala
   - `state`: Estado inicial
   - `created_at`: Data de criação

#### **Fluxo de Conexão**

1. **Criar Sala**
   ```javascript
   createLobby({ name, hostId, max: 4 })
   ```

2. **Entrar em Sala**
   ```javascript
   joinLobby({ lobbyId, playerId, playerName, ready: false })
   ```

3. **Iniciar Jogo**
   ```javascript
   startMatch({ lobbyId })
   ```

4. **Sincronizar Estado**
   ```javascript
   commitRemoteState({ players, turnIdx, round })
   ```

5. **Sair da Sala**
   ```javascript
   leaveRoom({ roomCode, playerId })
   ```

### **BroadcastChannel (Multi-Aba)**

#### **Mensagens**

1. **START**: Início do jogo
   ```javascript
   { type: 'START', players: [...], source: meId }
   ```

2. **SYNC**: Sincronização de estado
   ```javascript
   { type: 'SYNC', players: [...], turnIdx: 0, round: 1, gameOver: false, winner: null, source: meId }
   ```

3. **TURNLOCK**: Bloqueio de turno
   ```javascript
   { type: 'TURNLOCK', value: true/false, source: meId }
   ```

#### **Proteção contra Duplicação**
- **Source Check**: Ignora mensagens do próprio jogador
- **Lock Owner**: Apenas o iniciador pode destravar
- **Versionamento**: Última versão vence

### **Realtime (Supabase)**

#### **Configuração**
```javascript
supabase
  .channel(`rooms:${code}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'rooms',
    filter: `code=eq.${code}`
  }, (payload) => {
    // Atualiza estado local
  })
  .subscribe()
```

#### **Polling de Segurança**
- **Intervalo**: 700ms
- **Condição**: Se não houver evento realtime em 2s
- **Função**: Verifica mudanças no banco

### **Gerenciamento de Identidade**

#### **Estratégia: Por Aba**
- **Cada aba do navegador = jogador diferente**
- **sessionStorage**: ID e nome por aba
- **localStorage**: Fallback (compatibilidade)

#### **Funções**
```javascript
getOrCreateTabPlayerId()      // ID único por aba
getOrSetTabPlayerName(name)   // Nome do jogador por aba
```

---

## 🛡️ REGRAS DE VALIDAÇÃO

### **Validações Automáticas**

1. **Saldo não pode ser negativo**: `cash >= 0`
2. **Recursos não podem ser negativos**: `clients >= 0`, `vendedores >= 0`
3. **Níveis válidos**: Mix/ERP apenas A, B, C, D
4. **Posição válida**: 0 ≤ pos < 55
5. **Certificados não negativos**: `az >= 0`, `am >= 0`, `rox >= 0`
6. **Capacidade vs Atendimento**: `clientsEmAtendimento <= capacidade`
7. **Cálculos corretos**: Faturamento e despesas validados
8. **Turno válido**: `turnIdx` deve apontar para jogador existente
9. **Jogador do turno não falido**: `!players[turnIdx]?.bankrupt`
10. **Pelo menos 1 jogador vivo**: `alivePlayers.length > 0`
11. **Sincronização coerente**: Estado local vs remoto

---

## 📈 FLUXO COMPLETO DO JOGO

### **Inicialização**
```
StartScreen → LobbyList → PlayersLobby → Game
```

### **Durante o Jogo**
```
Turno → Rolar Dado → Mover → Evento da Casa → Ações → Próximo Turno
     ↓
  Rodada Incrementa (quando todos passam pela casa 0)
     ↓
  Jogo Termina (após 5 rodadas)
```

### **Fim de Jogo**
```
3 Opções:
1. Todos completaram 5 rodadas → Ranking por patrimônio
2. Apenas 1 jogador vivo → Vence automaticamente
3. Todos falidos → Sem vencedor
```

---

## 🔍 PONTOS CRÍTICOS DE SINCRONIZAÇÃO

### **Problemas Resolvidos**

1. ✅ **Sincronização de Turnos**: `turnIdx` sincronizado via BroadcastChannel + Supabase
2. ✅ **Preservação de Progresso**: Certificados e treinamentos não são sobrescritos
3. ✅ **Evita Duplicação**: Lock de turno impede ações duplicadas
4. ✅ **Sincronização em Tempo Real**: Realtime + Polling garantem atualização
5. ✅ **Gerenciamento de Saída**: `leaveRoom` remove jogador da sala

### **Problemas Potenciais**

1. ⚠️ **Race Conditions**: Múltiplos commits simultâneos podem causar conflitos
2. ⚠️ **Versionamento**: Última versão vence (pode perder dados)
3. ⚠️ **Offline**: Sem sincronização offline (depende de conexão)
4. ⚠️ **Performance**: Muitos re-renders com muitos jogadores

---

## 📊 RESUMO DAS MECÂNICAS

### **Recursos Críticos**
- **Cash**: Essencial para compras e pagamentos
- **Clientes**: Gera faturamento (baseado em Mix)
- **Vendedores**: Capacidade de atendimento
- **Gestores**: Boost de faturamento
- **Mix/ERP**: Multiplicadores de receita/despesa

### **Estratégias de Jogo**
1. **Expansão Agressiva**: Muitos clientes + vendedores
2. **Eficiência**: Certificados + gestores para boost
3. **Upgrades**: Mix/ERP alto para multiplicadores
4. **Gestão de Risco**: Certificados para proteção
5. **Recuperação**: Empréstimos e demissões estratégicas

### **Fatores de Vitória**
- ✅ Completar 5 rodadas primeiro
- ✅ Maior patrimônio (cash + bens)
- ✅ Último sobrevivente (se outros falirem)

---

## 🎯 CONCLUSÃO

O **Sales Game** possui um sistema complexo e bem estruturado de regras, mecânicas e sincronização multiplayer. O código demonstra:

- ✅ **Regras claras**: Objetivo e condições de vitória bem definidas
- ✅ **Mecânicas balanceadas**: Sistema de recursos e cálculos consistentes
- ✅ **Multiplayer robusto**: Sincronização multi-camadas (Local → BroadcastChannel → Supabase)
- ✅ **Validações automáticas**: Sistema de testes e validação em tempo real
- ✅ **Gestão de erros**: Tratamento de falências e recuperação financeira

**Pontos fortes:**
- Separação clara entre regras de negócio e sincronização
- Sistema de preservação de progresso local
- Múltiplas camadas de sincronização para robustez

**Áreas de melhoria:**
- Otimização de performance (re-renders)
- Tratamento de conflitos (merge automático)
- Sincronização offline (PWA/Service Workers)

---

**Análise gerada em**: 2024  
**Versão do código analisado**: 0.0.1

