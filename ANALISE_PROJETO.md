# 📊 Análise Detalhada do Projeto Sales Game React

## 🎯 Visão Geral

**Sales Game** é um jogo de tabuleiro multiplayer desenvolvido em React com Vite, simula um jogo de vendas onde os jogadores competem através de um tabuleiro com 55 casas. O projeto utiliza Supabase para sincronização em tempo real e suporta múltiplos jogadores através de salas (lobbies).

---

## 🏗️ Arquitetura do Projeto

### **Stack Tecnológica**
- **Frontend**: React 18.2.0 + Vite 5.4.0
- **Backend/Sync**: Supabase (PostgreSQL + Realtime)
- **Build Tool**: Vite com plugin React
- **Estilos**: CSS puro (sem frameworks CSS)

### **Estrutura de Pastas**

```
src/
├── components/     # Componentes visuais reutilizáveis
├── pages/         # Páginas/telas principais
├── game/          # Lógica de jogo e engine
├── modals/         # Sistema de modais/dialogs
├── net/            # Sistema de sincronização em rede
├── lib/            # Utilitários e helpers
├── data/           # Dados estáticos (tabuleiro)
├── utils/          # Funções auxiliares
├── styles/         # Estilos CSS
├── lobby/          # Sistema de lobby (Firebase - legado?)
├── engine/         # Engine de jogo (legado?)
└── dev/            # Ferramentas de desenvolvimento
```

---

## 📱 Componentes Principais

### **1. App.jsx** (671 linhas)
**Arquivo central do aplicativo** - Gerencia roteamento de fases e estado global

**Funcionalidades principais:**
- ✅ Gerenciamento de fases: `start` → `lobbies` → `playersLobby` → `game`
- ✅ Sincronização multi-aba via `BroadcastChannel`
- ✅ Sincronização remota via Supabase (`GameNetProvider`)
- ✅ Gerenciamento de identidade por aba (sessionStorage)
- ✅ Sistema de turnos através do hook `useTurnEngine`
- ✅ Validação de estado em tempo real (debug mode)
- ✅ Gerenciamento de saída de salas

**Estados principais:**
- `phase`: Controla a fase atual do jogo
- `players`: Array de jogadores com seus estados
- `round`: Rodada atual
- `turnIdx`: Índice do jogador da vez
- `gameOver`: Flag de fim de jogo
- `winner`: Jogador vencedor

**Sincronização:**
- **BroadcastChannel**: Sincroniza entre abas do mesmo navegador
- **GameNetProvider**: Sincroniza entre navegadores via Supabase
- Preserva dados locais (certificados, treinamentos) durante sync

---

### **2. useTurnEngine.jsx**
**Motor de turnos** - Centraliza toda a lógica pesada do jogo

**Responsabilidades:**
- ✅ Gerenciamento de turnos e rodadas
- ✅ Movimento dos jogadores no tabuleiro
- ✅ Sistema de modais (compra, sorte/revés, etc.)
- ✅ Aplicação de ações (rolar dado, comprar, etc.)
- ✅ Sistema de falência e recuperação
- ✅ Lógica de vitória (3 voltas completas)
- ✅ Controle de bloqueio de turno (evita duplicação)

**Ações suportadas:**
- `ROLL`: Rolar dado e avançar
- `BUY_*`: Compras diversas (clientes, vendedores, gestores, etc.)
- `TRAIN_*`: Treinamentos e certificados
- `RECOVERY_MODAL`: Modal de recuperação financeira
- `BANKRUPT_MODAL`: Modal de falência
- `SORTE_REVES`: Eventos de sorte e revés
- `FATURAMENTO_MES`: Cobrança de faturamento
- `DESPESAS_OPERACIONAIS`: Cobrança de despesas

**Sistema de Modais:**
- Stack de modais (múltiplas modais abertas)
- Contador `modalLocks` para controlar quando destravar turno
- Modais são resolvidas via `ModalContext`

---

### **3. gameMath.js**
**Matemática do jogo** - Cálculos puros e regras de negócio

**Funções principais:**
- `computeFaturamentoFor(player)`: Calcula faturamento mensal
- `computeDespesasFor(player)`: Calcula despesas mensais
- `capacityAndAttendance(player)`: Calcula capacidade e atendimento
- `applyDeltas(player, deltas)`: Aplica mudanças de recursos
- `crossedTile(pos, oldPos, target)`: Verifica se passou por uma casa

**Configurações:**
- **Vendedores**: Comum (cap:2, fat:600+), Inside/Field (cap:5, fat:1500+)
- **Gestores**: Base 3000, boost por certificado (20%, 30%, 40%, 60%)
- **Mix Produtos**: Níveis A-D (faturamento e despesas variam)
- **ERP**: Níveis A-D (faturamento e despesas variam)

**Sistema de Certificados:**
- Azul (`az`), Amarelo (`am`), Roxo (`rox`)
- Treinamentos por tipo de vendedor (`trainingsByVendor`)
- Certificados de gestor (`gestor`)

---

### **4. Sistema de Modais**

**ModalContext.jsx**: Sistema centralizado de modais
- Stack de modais (suporta múltiplas abertas)
- Resolução via promises
- Logs detalhados de ações do jogador

**Modais disponíveis:**
- `BuyClientsModal`: Compra de clientes
- `BuyCommonSellersModal`: Compra de vendedores comuns
- `BuyFieldSalesModal`: Compra de field sales
- `InsideSalesModal`: Compra de inside sales
- `BuyManagerModal`: Compra de gestores
- `ERPSystemsModal`: Upgrade de ERP
- `MixProductsModal`: Upgrade de mix de produtos
- `TrainingModal`: Treinamentos e certificados
- `DirectBuyModal`: Compra direta
- `SorteRevesModal`: Eventos de sorte e revés
- `FaturamentoMesModal`: Cobrança de faturamento
- `DespesasOperacionaisModal`: Cobrança de despesas
- `RecoveryModal`: Recuperação financeira (empréstimo, demissão, redução)
- `BankruptcyModal`: Declaração de falência
- `InsufficientFundsModal`: Aviso de fundos insuficientes

---

### **5. Sistema de Rede (Sync)**

**GameNetProvider.jsx**: Sincronização via Supabase
- Tabela `rooms` no Supabase com estado do jogo
- Realtime via PostgreSQL changes
- Polling de segurança (fallback)
- Versionamento de estado

**lobbies.js**: Gerenciamento de salas
- `createLobby`: Cria sala
- `joinLobby`: Entra em sala
- `leaveRoom`: Sai da sala
- `listLobbies`: Lista salas disponíveis
- `onLobbyRealtime`: Realtime de mudanças no lobby
- `startMatch`: Inicia partida

**Tabelas Supabase:**
- `lobbies`: Salas de jogo
- `lobby_players`: Jogadores nas salas
- `rooms`: Estado do jogo (sync)
- `matches`: Histórico de partidas

---

### **6. Componentes Visuais**

**Board.jsx**: Tabuleiro do jogo
- Renderiza tabuleiro com imagem de fundo
- Posiciona jogadores nas casas
- Sistema de tokens (peões) com animações
- Responsivo (escala baseada no tamanho do container)

**HUD.jsx**: Painel de informações
- Faturamento, despesas, empréstimos
- Recursos (vendedores, gestores, clientes)
- Certificados (azul, amarelo, roxo)
- Placar de jogadores

**Controls.jsx**: Controles do jogo
- Botão "Rolar Dado"
- Botão "Recuperação Financeira"
- Botão "Declarar Falência"
- Bloqueio quando não é a vez do jogador

**StartScreen.jsx**: Tela inicial
- Solicita nome do jogador

**LobbyList.jsx**: Lista de salas
- Lista salas disponíveis
- Cria nova sala
- Entra em sala existente
- Realtime de atualizações

**PlayersLobby.jsx**: Lobby de jogadores
- Lista jogadores na sala
- Sistema de "ready"
- Botão "Iniciar Jogo"

---

## 🎮 Mecânicas do Jogo

### **Objetivo**
- Completar 3 voltas completas no tabuleiro (55 casas)
- Primeiro jogador a completar 3 voltas vence

### **Recursos**
- **Cash**: Dinheiro disponível
- **Bens**: Valor patrimonial
- **Clientes**: Número de clientes
- **Vendedores**: Comum, Inside Sales, Field Sales
- **Gestores**: Gestores comerciais
- **Mix Produtos**: Nível A-D
- **ERP**: Nível A-D
- **Certificados**: Azul, Amarelo, Roxo

### **Fluxo de Turno**
1. Jogador rola dado (1-6)
2. Avança no tabuleiro
3. Para na casa → Evento da casa
4. Pode comprar/treinar se tiver recursos
5. Próximo jogador

### **Eventos de Casa**
- **Compra de recursos**: Clientes, vendedores, gestores
- **Sorte e Revés**: Eventos aleatórios
- **Faturamento do Mês**: Recebe dinheiro
- **Despesas Operacionais**: Paga despesas
- **Treinamentos**: Adquire certificados

### **Sistema de Falência**
- Jogador pode declarar falência
- Remove jogador do jogo
- Jogo continua até haver vencedor

### **Recuperação Financeira**
- Empréstimo (aumenta cash, adiciona dívida)
- Demissão (reduz vendedores, reduz despesas)
- Redução (reduz recursos, reduz despesas)

---

## 🔄 Sincronização Multiplayer

### **Camadas de Sincronização**

1. **Local (Single Tab)**: Estado React local
2. **Multi-Aba (BroadcastChannel)**: Sincroniza entre abas do mesmo navegador
3. **Multi-Navegador (Supabase)**: Sincroniza entre diferentes navegadores

### **Estratégia de Sincronização**
- **Estado principal**: `players`, `turnIdx`, `round`, `gameOver`, `winner`
- **Preservação local**: Certificados (`az`, `am`, `rox`), treinamentos (`trainingsByVendor`), onboarding
- **Versionamento**: Sistema de versões para evitar conflitos
- **Broadcast**: Mensagens via BroadcastChannel e Supabase Realtime

### **Problemas Resolvidos**
- ✅ Sincronização de turnos entre jogadores
- ✅ Preservação de progresso local (certificados)
- ✅ Evita duplicação de ações (lock de turno)
- ✅ Sincronização de estado em tempo real

---

## 🧪 Sistema de Testes

**Localização**: `src/game/__tests__/`

**Tipos de Testes:**
- **Regressivos**: Valida cálculos e regras básicas
- **Integração**: Simula jogadas completas
- **Tempo Real**: Valida estado durante execução

**Funcionalidades testadas:**
- ✅ Cálculos (faturamento, despesas, capacidade)
- ✅ Movimento e posição
- ✅ Sistema de certificados
- ✅ Lógica de falência
- ✅ Aplicação de deltas
- ✅ Gerenciamento de turnos
- ✅ Regras de negócio

**Comandos disponíveis:**
```javascript
runAllTests()           // Executa todos os testes
enableValidation()      // Ativa validação em tempo real
createSimulator(2)      // Cria simulador interativo
```

---

## 🔐 Sistema de Autenticação

**auth.js**: Gerenciamento de identidade

**Estratégia:**
- **Por aba**: Cada aba do navegador = jogador diferente
- **sessionStorage**: ID e nome por aba
- **localStorage**: Fallback para compatibilidade

**Funções:**
- `getOrCreateTabPlayerId()`: ID único por aba
- `getOrSetTabPlayerName()`: Nome do jogador por aba
- `makeId()`: Gera UUID

---

## 🎨 Estilos e UI

**styles.css**: Estilos principais (430 linhas)
- Design dark theme
- Componentes estilizados (botões, modais, HUD)
- Responsivo
- Animações suaves

**Características:**
- Cores: Fundo escuro (#0f0f12), texto claro (#e9ecf1)
- Botões: Estilos primários, secundários, dark
- Modais: Overlay com fundo escurecido
- Board: Tabuleiro responsivo com imagem de fundo

---

## 📊 Dados do Tabuleiro

**track.js**: Dados da pista

- **55 casas** no tabuleiro
- Coordenadas normalizadas (0-1) para responsividade
- Função `scalePoint()` para converter para pixels
- Base de tamanho: 800x700px

---

## 🚀 Fluxo Completo do Jogo

### **1. Inicialização**
```
StartScreen → LobbyList → PlayersLobby → Game
```

### **2. Durante o Jogo**
```
Turno → Rolar Dado → Mover → Evento da Casa → Ações → Próximo Turno
```

### **3. Fim de Jogo**
```
3 Voltas Completas → FinalWinners → Retornar ao Lobby
```

---

## ⚠️ Pontos de Atenção

### **Problemas Potenciais**
1. **Sincronização**: Dependência de Supabase pode falhar
2. **Performance**: Muitos re-renders com muitos jogadores
3. **Estado**: Muito estado global no App.jsx
4. **Modais**: Sistema de modais pode ser melhorado (tipos TypeScript)
5. **Testes**: Testes não são executados automaticamente (CI/CD)

### **Melhorias Sugeridas**
1. ✅ Adicionar TypeScript para type safety
2. ✅ Separar lógica de estado (Context API ou Redux)
3. ✅ Adicionar testes automatizados (Jest/Vitest)
4. ✅ Melhorar tratamento de erros
5. ✅ Adicionar loading states
6. ✅ Otimizar re-renders (React.memo, useMemo)
7. ✅ Adicionar documentação de API
8. ✅ Adicionar sistema de logs estruturado

---

## 📈 Métricas do Projeto

- **Total de arquivos JSX/JS**: ~50+
- **Linhas de código**: ~10.000+
- **Componentes React**: ~20+
- **Modais**: ~15
- **Hooks customizados**: ~5
- **Dependências**: 5 principais (React, Supabase, Firebase, Vite)

---

## 🎯 Conclusão

O **Sales Game** é um projeto bem estruturado com:
- ✅ Arquitetura modular
- ✅ Sistema de sincronização robusto
- ✅ Lógica de jogo bem separada
- ✅ Sistema de testes abrangente
- ✅ UI moderna e responsiva

**Pontos fortes:**
- Separação clara de responsabilidades
- Sistema de sincronização multi-camadas
- Lógica de jogo centralizada
- Sistema de modais flexível

**Áreas de melhoria:**
- TypeScript para type safety
- Otimização de performance
- Testes automatizados
- Documentação de API

---

**Análise gerada em**: 2024
**Versão do projeto**: 0.0.1

