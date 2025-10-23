// src/App.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react'
import './styles.css'

import StartScreen from './components/StartScreen.jsx'
import LobbyList from './pages/LobbyList.jsx'
import PlayersLobby from './pages/PlayersLobby.jsx'

import Board from './components/Board.jsx'
import HUD from './components/HUD.jsx'
import Controls from './components/Controls.jsx'
import { TRACK_LEN } from './data/track'

// >>> identidade POR ABA (evita bloquear em todo mundo)
import { getOrCreateTabPlayerId, getOrSetTabPlayerName } from './auth'

// >>> modal ERP
import { useModal } from './modals/ModalContext'
import ERPSystemsModal from './modals/ERPSystemsModal'
import TrainingModal from './modals/TrainingModal'
import DirectBuyModal from './modals/DirectBuyModal'

// >>> novas modais
import InsideSalesModal from './modals/InsideSalesModal'
import ClientsModal from './modals/BuyClientsModal'
import ManagerModal from './modals/BuyManagerModal'
import FieldSalesModal from './modals/BuyFieldSalesModal'

import BankruptOverlay from './modals/BankruptOverlay.jsx'

// >>> NOVA modal: Vendedores Comuns (casas 9, 28, 40, 45)
import BuyCommonSellersModal from './modals/BuyCommonSellersModal'

// >>> NOVA modal: Mix de Produtos (casas 7, 31, 44)
import MixProductsModal from './modals/MixProductsModal'

// >>> NOVA modal: Sorte & Revés (casas 3,14,22,26,35,41,48,54)
import SorteRevesModal from './modals/SorteRevesModal'

// >>> TELA FINAL (pódio)
import FinalWinners from './components/FinalWinners.jsx'

// >>> NOVAS MODAIS (passar pela casa 1 e 23)
import FaturamentoDoMesModal from './modals/FaturamentoMesModal'
import DespesasOperacionaisModal from './modals/DespesasOperacionaisModal'

// >>> (NOVO) Multiplayer em rede via Supabase Realtime (opcional se o provider existir)
import { useGameNet } from './net/GameNetProvider.jsx'

export default function App() {
  const [phase, setPhase] = useState('start')
  const [currentLobbyId, setCurrentLobbyId] = useState(null)

  const [showBankruptOverlay, setShowBankruptOverlay] = useState(false)

  // --- Starter Kit
  const STARTER_KIT = useMemo(() => Object.freeze({
    mixProdutos: 'D',
    erpLevel: 'D',
    clients: 1,
    vendedoresComuns: 1,
  }), [])

  const applyStarterKit = (obj = {}) => ({
    ...obj,
    mixProdutos: obj.mixProdutos ?? 'D',
    erpLevel: obj.erpLevel ?? 'D',
    clients: obj.clients ?? 1,
    vendedoresComuns: obj.vendedoresComuns ?? 1,
  })

  const [players, setPlayers] = useState([
    applyStarterKit({ id: 1, name: 'Jogador 1', cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 })
  ])
  const [round, setRound] = useState(1)
  const [turnIdx, setTurnIdx] = useState(0)
  const [log, setLog] = useState(['Bem-vindo ao Sales Game!'])
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState(null)

  // >>> controle de “quem já cruzou a casa 1” para fechar a rodada
  const [roundFlags, setRoundFlags] = useState([]) // bool por jogador

  // --- quem sou eu (por ABA)
  const meId = useMemo(() => getOrCreateTabPlayerId(), [])
  const myName = useMemo(() => getOrSetTabPlayerName('Jogador'), [])

  // --- id efetivo para comparar "de quem é a vez" (pode ser diferente do meId se vier do lobby)
  const [myUid, setMyUid] = useState(meId)

  // [SYNC FIX] se PlayersLobby / joinLobby expuseram window.__MY_UID, adote-o como meu id oficial
  useEffect(() => {
    const wuid = (typeof window !== 'undefined' && (window.__MY_UID || window.__myUid || window.__playerId)) || null
    if (wuid && String(wuid) !== String(myUid)) setMyUid(String(wuid))
  }, []) // somente no mount

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // BOOTSTRAP DE FASE: ao recarregar com ?room= ou última sala salva,
  // pule a tela inicial e vá direto para o lobby/sala correta.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const roomFromUrl = url.searchParams.get('room')
      const roomFromStorage = localStorage.getItem('sg:lastRoomName')
      const room = roomFromUrl || roomFromStorage

      if (room) {
        setCurrentLobbyId(room)
        window.__setRoomCode?.(room)
        // garante ?room na URL (idempotente) sem quebrar histórico
        try {
          url.searchParams.set('room', String(room))
          history.replaceState(null, '', url.toString())
        } catch {}
        setPhase('playersLobby')
      } else if (myName) {
        // se já há nome salvo mas nenhuma sala, vá para a lista de lobbies
        setPhase('lobbies')
      }
    } catch {}
  }, [myName]) // roda uma vez quando o nome estiver disponível
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  // ==== helpers ====
  const norm = (s) =>
    (String(s ?? '').normalize ? String(s ?? '').normalize('NFKC') : String(s ?? ''))
      .trim()
      .toLowerCase()

  // AJUSTE: só pelo ID (nunca pelo nome)
  const isMine = React.useCallback((p) => !!p && String(p.id) === String(myUid), [myUid])

  useEffect(() => {
    setTurnIdx(t => (players.length > 0 ? (t % players.length + players.length) % players.length : 0))
    // redimensiona/zera flags toda vez que muda a quantidade de jogadores
    setRoundFlags(new Array(Math.max(1, players.length)).fill(false))
  }, [players.length])

  const current = players[turnIdx]

  const isMyTurn = useMemo(() => {
    const owner = players[turnIdx]
    if (!owner) return false
    const byId = owner.id != null && String(owner.id) === String(myUid)
    const turn = byId
    console.log('[SG][App] isMyTurn? %o | owner=%o | myUid=%s | meId=%s | myName=%s', turn, owner, myUid, meId, myName)
    return turn
  }, [players, turnIdx, myUid, meId, myName])

  // >>> modais
  const { pushModal, awaitTop, closeTop } = useModal?.() || {}

  // 🔒 trava de modais
  const [modalLocks, setModalLocks] = useState(0)
  const hasBlockingModal = modalLocks > 0
  const openModalAndWait = async (element) => {
    if (!(pushModal && awaitTop)) return null
    setModalLocks(c => {
      const n = c + 1
      console.log('[SG][App] openModalAndWait: ++locks =>', n, element?.type?.name || element)
      return n
    })
    try {
      pushModal(element)
      const res = await awaitTop()
      console.log('[SG][App] openModalAndWait resolved =>', res)
      return res
    } finally {
      setModalLocks(c => {
        const n = Math.max(0, c - 1)
        console.log('[SG][App] openModalAndWait: --locks =>', n)
        return n
      })
    }
  }

  // ===== Cadeado de turno =====
  const [turnLock, setTurnLock] = useState(false)
  const modalLocksRef = useRef(0)
  useEffect(() => { modalLocksRef.current = modalLocks }, [modalLocks])

  const setTurnLockBroadcast = (value) => {
    const v = !!value
    setTurnLock(v)
    console.log('[SG][App] setTurnLockBroadcast(%o)', v)
    try {
      bcRef.current?.postMessage?.({ type: 'TURNLOCK', value: v, source: meId })
    } catch (e) {
      console.warn('[SG][App] Broadcast TURNLOCK failed:', e)
    }
  }

  // HUD vindo do Board
  const [meHud, setMeHud] = useState({
    id: null,
    name: players[0]?.name || 'Jogador',
    color: players[0]?.color || '#6c5ce7',
    cash: players[0]?.cash ?? 18000,
    possibAt: 0,
    clientsAt: 0,
    matchId: 'local',
  })

  // saldo desta aba
  const myCash = useMemo(
    () => (players.find(isMine)?.cash ?? 0),
    [players, isMine]
  )

  // sync meHud.cash
  useEffect(() => {
    const mine = players.find(isMine)
    if (!mine) return
    if (meHud.cash !== mine.cash) {
      console.log('[SG][App] meHud.cash <-', mine.cash)
      setMeHud(h => ({ ...h, cash: mine.cash })) }
  }, [players, isMine]) // eslint-disable-line

  // ======= Tabelas/Helpers de Cálculo =======
  const VENDOR_CONF = {
    comum:  { cap: 2, baseFat:  600, incFat: 100, baseDesp: 100, incDesp: 100 },
    inside: { cap: 5, baseFat: 1500, incFat: 500, baseDesp: 2000, incDesp: 100 },
    field:  { cap: 5, baseFat: 1500, incFat: 500, baseDesp: 2000, incDesp: 100 },
  };
  const GESTOR = { baseDesp: 3000, incDesp: 500, boostByCert: [0.20, 0.30, 0.40, 0.60] }; // até 7 colab/gestor

  const MIX = { A:{ fat:1200, desp:700 }, B:{ fat:600, desp:400 }, C:{ fat:300, desp:200 }, D:{ fat:100, desp:50 } };
  const ERP = { A:{ fat:1000, desp:400 }, B:{ fat:500, desp:200 }, C:{ fat:200, desp:100 }, D:{ fat:70, desp:50 } };

  const certCount = (player = {}, type) => new Set(player?.trainingsByVendor?.[type] || []).size;
  const num = (v) => Number(v || 0);

  // === Helpers de certificados ===
  const hasBlue   = (p) => Number(p?.az  || 0) > 0;   // certificado azul
  const hasYellow = (p) => Number(p?.am  || 0) > 0;   // certificado amarelo
  const hasPurple = (p) => Number(p?.rox || 0) > 0;   // certificado roxo
  const countManagerCerts = (p) => certCount(p, 'gestor');

  function countAlivePlayers(players) {
  return players.reduce((acc, p) => acc + (p?.bankrupt ? 0 : 1), 0)
}

function findNextAliveIdx(players, fromIdx) {
  const n = players.length
  if (n === 0) return 0
  let i = (fromIdx + 1) % n
  let guard = 0
  while (guard < n) {
    if (!players[i]?.bankrupt) return i
    i = (i + 1) % n
    guard++
  }
  // caso todos falidos (deveria ter sido pego antes)
  return fromIdx
}


  function capacityAndAttendance(player = {}) {
    const qComum  = num(player.vendedoresComuns);
    const qInside = num(player.insideSales);
    const qField  = num(player.fieldSales);
    const cap = qComum*VENDOR_CONF.comum.cap + qInside*VENDOR_CONF.inside.cap + qField*VENDOR_CONF.field.cap;
    const clients = num(player.clients);
    return { cap, inAtt: Math.min(clients, cap) };
  }

  // ======= aplica deltas =======
  function applyDeltas(player, deltas = {}) {
    const next = { ...player }
    const add = (k, v) => { next[k] = (next[k] ?? 0) + v }

    if (Number.isFinite(deltas.cashDelta)) add('cash', Number(deltas.cashDelta))
    if (Number.isFinite(deltas.clientsDelta)) add('clients', Number(deltas.clientsDelta))
    if (Number.isFinite(deltas.manutencaoDelta)) add('manutencao', Number(deltas.manutencaoDelta))
    if (Number.isFinite(deltas.bensDelta)) add('bens', Number(deltas.bensDelta))
    if (Number.isFinite(deltas.vendedoresComunsDelta)) add('vendedoresComuns', Number(deltas.vendedoresComunsDelta))
    if (Number.isFinite(deltas.fieldSalesDelta)) add('fieldSales', Number(deltas.fieldSalesDelta))
    if (Number.isFinite(deltas.insideSalesDelta)) add('insideSales', Number(deltas.insideSalesDelta))

    // aliases de gestores
    if (Number.isFinite(deltas.gestoresDelta)) {
      const g = Number(deltas.gestoresDelta)
      next.gestores = (next.gestores ?? 0) + g
      next.gestoresComerciais = (next.gestoresComerciais ?? 0) + g
      next.managers = (next.managers ?? 0) + g
    }

    if (Number.isFinite(deltas.revenueDelta)) add('revenue', Number(deltas.revenueDelta))

    if (typeof deltas.mixProdutosSet !== 'undefined') next.mixProdutos = deltas.mixProdutosSet
    if (deltas.mixBaseSet) next.mixBase = { ...(next.mixBase || {}), ...deltas.mixBaseSet }
    if (typeof deltas.erpLevelSet !== 'undefined') next.erpLevel = deltas.erpLevelSet

    if (Array.isArray(deltas.trainingsPush) && deltas.trainingsPush.length) {
      next.trainings = [ ...(next.trainings || []), ...deltas.trainingsPush ]
    }
    if (Array.isArray(deltas.directBuysPush) && deltas.directBuysPush.length) {
      next.directBuys = [ ...(next.directBuys || []), ...deltas.directBuysPush ]
    }
    return next
  }

  // ======= Cálculos =======
  function computeFaturamentoFor(player = {}) {
    const qComum  = num(player.vendedoresComuns);
    const qInside = num(player.insideSales);
    const qField  = num(player.fieldSales);
    const qGestor = num(player.gestores ?? player.gestoresComerciais ?? player.managers);

    const cComum  = certCount(player, 'comum');
    const cInside = certCount(player, 'inside');
    const cField  = certCount(player, 'field');
    const cGestor = certCount(player, 'gestor');

    // >>> faturamento NÃO usa utilização (conforme regra)
    const fatComum  = qComum  * (VENDOR_CONF.comum.baseFat  + VENDOR_CONF.comum.incFat  * cComum );
    const fatInside = qInside * (VENDOR_CONF.inside.baseFat + VENDOR_CONF.inside.incFat * cInside);
    const fatField  = qField  * (VENDOR_CONF.field.baseFat  + VENDOR_CONF.field.incFat * cField );

    let vendorRevenue = fatComum + fatInside + fatField;

    // Bônus de gestor (potencializa % do recebimento dos colaboradores)
    const colaboradores = qComum + qInside + qField;
    const cobertura = colaboradores > 0 ? Math.min(1, (qGestor * 7) / colaboradores) : 0;
    const boost = GESTOR.boostByCert[Math.min(3, Math.max(0, cGestor))] || 0;
    vendorRevenue = vendorRevenue * (1 + cobertura * boost);

    const mixLvl = String(player.mixProdutos || 'D').toUpperCase();
    const mixFat = (MIX[mixLvl]?.fat || 0) * num(player.clients);

    const erpLvl = String(player.erpLevel || 'D').toUpperCase();
    const staff = colaboradores + qGestor; // por colaborador (inclui gestores)
    const erpFat = (ERP[erpLvl]?.fat || 0) * staff;

    const dynamicRevenue = num(player.revenue);

    const total = Math.max(0, Math.floor(vendorRevenue + mixFat + erpFat + dynamicRevenue));
    return total
  }

  function computeDespesasFor(player = {}) {
    const qComum  = num(player.vendedoresComuns);
    const qInside = num(player.insideSales);
    const qField  = num(player.fieldSales);
    const qGestor = num(player.gestores ?? player.gestoresComerciais ?? player.managers);

    const cComum  = certCount(player, 'comum');
    const cInside = certCount(player, 'inside');
    const cField  = certCount(player, 'field');
    const cGestor = certCount(player, 'gestor');

    const dComum  = qComum  * (VENDOR_CONF.comum.baseDesp  + VENDOR_CONF.comum.incDesp  * cComum );
    const dInside = qInside * (VENDOR_CONF.inside.baseDesp + VENDOR_CONF.inside.incDesp * cInside);
    const dField  = qField  * (VENDOR_CONF.field.baseDesp  + VENDOR_CONF.field.incDesp * cField );
    const dGestor = qGestor * (GESTOR.baseDesp + GESTOR.incDesp * cGestor);

    const mixLvl = String(player.mixProdutos || 'D').toUpperCase();
    const mixDesp = (MIX[mixLvl]?.desp || 0) * num(player.clients);

    const erpLvl = String(player.erpLevel || 'D').toUpperCase();
    const colaboradores = qComum + qInside + qField + qGestor;
    const erpDesp = (ERP[erpLvl]?.desp || 0) * colaboradores;

    const extras = 0;

    const total = Math.max(0, Math.floor(dComum + dInside + dField + dGestor + mixDesp + erpDesp + extras));
    return total
  }

  function crossedTile(oldPos, newPos, tileIndex /* zero-based */) {
    if (oldPos === newPos) return false
    if (oldPos < newPos) return tileIndex > oldPos && tileIndex <= newPos
    return tileIndex > oldPos || tileIndex <= newPos // deu a volta
  }

  // ======= Treinamentos =======
  function applyTrainingPurchase(player, payload) {
    const { vendorType, items = [], total = 0 } = payload || {}
    const certMap = { personalizado: 'az', fieldsales: 'am', imersaomultiplier: 'rox' }

    const next = { ...player }
    next.cash = (next.cash ?? 0) - Number(total || 0)
    next.bens = (next.bens ?? 0) + Number(total || 0)
    next.onboarding = true

    items.forEach(it => {
      const key = certMap[it?.id]
      if (key) next[key] = (next[key] ?? 0) + 1
    })

    const tv = String(vendorType || 'comum')
    const current = new Set( (next.trainingsByVendor?.[tv] || []) )
    items.forEach(it => { if (it?.id) current.add(it.id) })

    next.trainingsByVendor = {
      ...(next.trainingsByVendor || {}),
      [tv]: Array.from(current)
    }

    return next
  }

  // ======= SYNC ENTRE ABAS =======
  const syncKey = useMemo(
    () => `sg-sync:${currentLobbyId || 'local'}`,
    [currentLobbyId]
  )
  const bcRef = useRef(null)

  useEffect(() => {
    try {
      bcRef.current?.close?.()
      const bc = new BroadcastChannel(syncKey)
      bc.onmessage = (e) => {
        const d = e.data || {}
        if (String(d.source) === String(meId)) return

        if (d.type === 'START') {
          console.log('[SG][BC] START received')
          const mapped = Array.isArray(d.players) ? d.players.map(applyStarterKit) : []
          if (!mapped.length) return

          // [SYNC FIX] tenta usar o UID global do lobby; se ausente, cai no match por nome
          try {
            const wuid = (typeof window !== 'undefined' && (window.__MY_UID || window.__myUid || window.__playerId)) || null
            if (wuid) setMyUid(String(wuid))
            else {
              const mineByName = mapped.find(p => norm(p.name) === norm(myName))
              if (mineByName?.id) setMyUid(String(mineByName.id))
            }
          } catch {}

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          setLog(['Jogo iniciado!'])
          setGameOver(false); setWinner(null)
          setMeHud(h => {
            const mine = mapped.find(isMine)
            return {
              ...h,
              name: mine?.name || mapped[0]?.name || 'Jogador',
              color: mine?.color || mapped[0]?.color || '#6c5ce7',
              cash: mine?.cash ?? 18000,
              possibAt: 0, clientsAt: 0
            }
          })
          setRoundFlags(new Array(Math.max(1, mapped.length)).fill(false))
          setPhase('game')
          return
        }

        if (d.type === 'TURNLOCK') {
          console.log('[SG][BC] TURNLOCK <-', d.value)
          setTurnLock(!!d.value)
          return
        }

        if (d.type === 'SYNC' && phase === 'game') {
          console.log('[SG][BC] SYNC <- turnIdx=%d round=%d', d.turnIdx, d.round)
          setPlayers(d.players)
          setTurnIdx(d.turnIdx)
          setRound(d.round)

          // [FIX] Failsafe
          if (modalLocksRef.current === 0 && turnLock) {
            console.log('[SG][BC][FIX] SYNC sem modal => auto-unlock')
            setTurnLock(false)
          }
        }
      }
      bcRef.current = bc
      return () => bc.close()
    } catch (e) {
      console.warn('[SG][App] BroadcastChannel init failed:', e)
    }
  }, [syncKey, meId, myName, phase, isMine]) // eslint-disable-line

  // ===== (NOVO) Multiplayer em rede: lê/commita estado autoritativo se o provider estiver presente =====
  const net = (() => {
    try { return useGameNet?.() } catch { return null }
  })() || null
  const netState = net?.state
  const netVersion = net?.version
  const netCommit = net?.commit

  // Recebe estado remoto e espelha no local (somente se de fato mudou)
  useEffect(() => {
    if (!netState) return
    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round) ? netState.round : null

    let changed = false
    if (np && JSON.stringify(np) !== JSON.stringify(players)) { setPlayers(np); changed = true }
    if (nt !== null && nt !== turnIdx) { setTurnIdx(nt); changed = true }
    if (nr !== null && nr !== round)  { setRound(nr); changed = true }

    // [SYNC FIX] se o lobby já publicou meu UID, adote-o aqui também
    const wuid = (typeof window !== 'undefined' && (window.__MY_UID || window.__myUid || window.__playerId)) || null
    if (wuid && String(wuid) !== String(myUid)) setMyUid(String(wuid))

    if (changed) console.log('[SG][NET] applied remote state v=%d', netVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netVersion])

  // helpers para commitar estado remoto e manter compat local/entre abas
  async function commitRemoteState(nextPlayers, nextTurnIdx, nextRound) {
    if (typeof netCommit === 'function') {
      try {
        await netCommit(prev => ({
          ...(prev || {}),
          players: nextPlayers,
          turnIdx: nextTurnIdx,
          round: nextRound,
        }))
      } catch (e) {
        console.warn('[SG][NET] commit failed:', e?.message || e)
      }
    }
  }

  function broadcastState(nextPlayers, nextTurnIdx, nextRound) {
    console.log('[SG][BC] SYNC -> turnIdx=%d round=%d', nextTurnIdx, nextRound)
    // 1) rede (outros computadores)
    commitRemoteState(nextPlayers, nextTurnIdx, nextRound)
    // 2) entre abas (mesma máquina)
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round: nextRound,
        source: meId,
      })
    } catch (e) { console.warn('[SG][App] broadcastState failed:', e) }
  }

  function broadcastStart(nextPlayers) {
    console.log('[SG][BC] START ->')
    // publica estado inicial na rede
    commitRemoteState(nextPlayers, 0, 1)
    // e no BroadcastChannel local
    try {
      bcRef.current?.postMessage?.({
        type: 'START',
        players: nextPlayers,
        source: meId,
      })
    } catch (e) { console.warn('[SG][App] broadcastStart failed:', e) }
  }

  function appendLog(msg){ setLog(l => [msg, ...l].slice(0, 12)) }

  // >>> fim de jogo
  function maybeFinishGame(nextPlayers, nextRound) {
    if (nextRound <= 5) return
    const ranked = [...nextPlayers].map(p => ({
      ...p,
      patrimonio: (p.cash || 0) + (p.bens || 0)
    })).sort((a,b) => b.patrimonio - a.patrimonio)
    setWinner(ranked[0] || null)
    setGameOver(true)
    appendLog('Fim de jogo! 5 rodadas completas.')
    setTurnLockBroadcast(false)
  }

  // >>>>>>>>>>>>>>>>> AJUSTES: saldo nunca negativo <<<<<<<<<<<<<<<<<
  const canPay = (idx, amount) => {
    const p = players[idx]
    const amt = Math.max(0, Number(amount || 0))
    return (Number(p?.cash || 0) >= amt)
  }
  const requireFunds = (idx, amount, reason) => {
    const ok = canPay(idx, amount)
    if (!ok) {
      appendLog(`Saldo insuficiente${reason ? ' para ' + reason : ''}. Use RECUPERAÇÃO (demitir / emprestar / reduzir) ou declare FALÊNCIA.`)
    }
    return ok
  }
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  function advanceAndMaybeLap(steps, deltaCash, note){
    console.log('[SG][App] advanceAndMaybeLap start | steps=%d deltaCash=%d note=%s', steps, deltaCash, note)
    if (gameOver) return
    if (!players.length) return

    setTurnLockBroadcast(true)

    const curIdx = turnIdx
    const cur = players[curIdx]
    if (!cur) { setTurnLockBroadcast(false); return }

    const oldPos = cur.pos
    const newPos = (oldPos + steps) % TRACK_LEN
    const lap = newPos < oldPos

    // aplica movimento + eventual cashDelta imediato (sem permitir negativo)
    const nextPlayers = players.map((p, i) => {
      if (i !== curIdx) return p
      const nextCash = (p.cash || 0) + (deltaCash || 0)
      return { ...p, pos: newPos, cash: Math.max(0, nextCash) }
    })

    // >>> controle de rodada: só vira quando TODOS cruzarem a casa 1
    let nextRound = round
    let nextFlags = roundFlags
    if (lap) {
      nextFlags = [...roundFlags]
      nextFlags[curIdx] = true
      const allDone = nextFlags.slice(0, players.length).every(Boolean)
      if (allDone) {
        nextRound = round + 1
        nextFlags = new Array(players.length).fill(false) // zera para a próxima rodada
      }
    }
    setRoundFlags(nextFlags)

    // >>> AJUSTE: pular jogadores falidos ao decidir o próximo turno
    const nextTurnIdx = findNextAliveIdx(nextPlayers, curIdx)

    if (deltaCash) appendLog(`${cur.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${(Math.abs(deltaCash)).toLocaleString()}`)
    if (note) appendLog(note)

    setPlayers(nextPlayers)
    setRound(nextRound)
    setTurnIdx(nextTurnIdx)
    broadcastState(nextPlayers, nextTurnIdx, nextRound)

    maybeFinishGame(nextPlayers, nextRound)
    if (nextRound > 5) { setTurnLockBroadcast(false); return }

    const landedOneBased = newPos + 1
    const crossedStart1 = crossedTile(oldPos, newPos, 0)
    const crossedExpenses23 = crossedTile(oldPos, newPos, 22)

    // === ERP/Sistemas: 6,16,32,49 ===
    const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)
    if (isErpTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] ERP tile landed:', landedOneBased)
        const res = await openModalAndWait(<ERPSystemsModal currentCash={players[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return
        const price = Number(res.values?.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: res.level })
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Treinamento: 2,11,19,47 ===
    const isTrainingTile = (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47)
    if (isTrainingTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] TRAINING tile landed:', landedOneBased)
        const ownerForTraining = players.find(isMine) || players[curIdx]
        const res = await openModalAndWait(<TrainingModal
          canTrain={{
            comum:  Number(ownerForTraining?.vendedoresComuns) || 0,
            field:  Number(ownerForTraining?.fieldSales) || 0,
            inside: Number(ownerForTraining?.insideSales) || 0,
            gestor: Number(ownerForTraining?.gestores ?? ownerForTraining?.gestoresComerciais ?? ownerForTraining?.managers) || 0
          }}
        />)
        if (!res || res.action !== 'BUY') return
        const trainCost = Number(res.total || 0)
        if (!requireFunds(curIdx, trainCost, 'comprar Treinamento')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyTrainingPurchase(p, res)
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Compra Direta: 5,10,43 ===
    const isDirectBuyTile = (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43)
    if (isDirectBuyTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] DIRECT BUY tile landed:', landedOneBased)
        // use o saldo já atualizado (nextPlayers) caso exista,
        // caindo para o myCash se algo falhar
        const cashNow =
          (Array.isArray(nextPlayers) && nextPlayers[curIdx]?.cash) ??
          (players[curIdx]?.cash ?? myCash)

        const res = await openModalAndWait(<DirectBuyModal currentCash={cashNow} />)
        if (!res) return

        if (res.action === 'OPEN') {
          const open = String(res.open || '').toUpperCase()

          if (open === 'MIX') {
            const r2 = await openModalAndWait(<MixProductsModal />)
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.compra || 0)
              const level = String(r2.level || 'D')
              if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=>
                  i!==curIdx ? p : applyDeltas(p, {
                    cashDelta: -price,
                    mixProdutosSet: level,
                    mixBaseSet: {
                      despesaPorCliente: Number(r2.despesa || 0),
                      faturamentoPorCliente: Number(r2.faturamento || 0),
                    }
                  })
                )
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'GESTOR') {
            const r2 = await openModalAndWait(<ManagerModal currentCash={players[curIdx]?.cash ?? myCash} />)
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const qty  = Number(r2.headcount ?? r2.qty ?? r2.managersQty ?? 1)
              const cashDelta = Number(
                (typeof r2.cashDelta !== 'undefined'
                  ? r2.cashDelta
                  : -(Number(r2.cost ?? r2.total ?? r2.totalHire ?? 0)))
              )
              const payAbs = cashDelta < 0 ? -cashDelta : 0
              if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Gestor')) { setTurnLockBroadcast(false); return }
              const mexp = Number(r2.expenseDelta ?? r2.totalExpense ?? r2.maintenanceDelta ?? 0)
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, {
                  cashDelta,
                  gestoresDelta: qty,
                  manutencaoDelta: mexp
                }))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'INSIDE') {
            const r2 = await openModalAndWait(<InsideSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const cost = Number(r2.cost ?? r2.total ?? 0)
              if (!requireFunds(curIdx, cost, 'contratar Inside Sales')) { setTurnLockBroadcast(false); return }
              const qty  = Number(r2.headcount ?? r2.qty ?? 1)
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty }))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'FIELD') {
            const r2 = await openModalAndWait(<FieldSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const qty = Number(r2.headcount ?? r2.qty ?? 1)
              const deltas = {
                cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
                manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
                revenueDelta: Number(r2.revenueDelta ?? 0),
                fieldSalesDelta: qty,
              }
              const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
              if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Field Sales')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'COMMON') {
            const r2 = await openModalAndWait(<BuyCommonSellersModal currentCash={players[curIdx]?.cash ?? myCash} />)
            if (r2 && r2.action === 'BUY') {
              const qty  = Number(r2.headcount ?? r2.qty ?? 0)
              const deltas = {
                cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
                vendedoresComunsDelta: qty,
                manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
                revenueDelta: Number(r2.revenueDelta ?? 0),
              }
              const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
              if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Vendedores Comuns')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'ERP') {
            const r2 = await openModalAndWait(<ERPSystemsModal currentCash={players[curIdx]?.cash ?? myCash} />)
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.values?.compra || 0)
              if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: r2.level }))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'CLIENTS') {
            const r2 = await openModalAndWait(<ClientsModal currentCash={players[curIdx]?.cash ?? myCash} />)
            if (r2 && r2.action === 'BUY') {
              const cost  = Number(r2.totalCost || 0)
              if (!requireFunds(curIdx, cost, 'comprar Clientes')) { setTurnLockBroadcast(false); return }
              const qty   = Number(r2.qty || 0)
              const mAdd  = Number(r2.maintenanceDelta || 0)
              const bensD = Number(r2.bensDelta || cost)
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, {
                  cashDelta: -cost,
                  clientsDelta: qty,
                  manutencaoDelta: mAdd,
                  bensDelta: bensD
                }))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'TRAINING') {
            const ownerForTraining = players.find(isMine) || players[curIdx]
            const r2 = await openModalAndWait(<TrainingModal
              canTrain={{
                comum:  Number(ownerForTraining?.vendedoresComuns) || 0,
                field:  Number(ownerForTraining?.fieldSales) || 0,
                inside: Number(ownerForTraining?.insideSales) || 0,
                gestor: Number(ownerForTraining?.gestores ?? ownerForTraining?.gestoresComerciais ?? ownerForTraining?.managers) || 0
              }}
            />)
            if (r2 && r2.action === 'BUY') {
              const trainCost = Number(r2.total || 0)
              if (!requireFunds(curIdx, trainCost, 'comprar Treinamento')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyTrainingPurchase(p, r2))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }
        }

        // Fallback: BUY direto
        if (res.action === 'BUY') {
          const isClientsBuy =
            res.kind === 'CLIENTS' ||
            res.modal === 'CLIENTS' ||
            typeof res.clientsQty !== 'undefined' ||
            typeof res.numClients !== 'undefined' ||
            typeof res.totalCost !== 'undefined' ||
            typeof res.maintenanceDelta !== 'undefined'

          if (isClientsBuy) {
            const cost  = Number(res.totalCost ?? res.total ?? res.amount ?? 0)
            if (!requireFunds(curIdx, cost, 'comprar Clientes')) { setTurnLockBroadcast(false); return }
            const qty   = Number(res.clientsQty ?? res.numClients ?? res.qty ?? 0)
            const mAdd  = Number(res.maintenanceDelta ?? res.maintenance ?? res.mexp ?? 0)
            const bensD = Number(res.bensDelta ?? cost)

            setPlayers(ps => {
              const upd = ps.map((p, i) =>
                i !== curIdx
                  ? p
                  : applyDeltas(p, {
                      cashDelta: -cost,
                      clientsDelta: qty,
                      manutencaoDelta: mAdd,
                      bensDelta: bensD
                    })
              )
              broadcastState(upd, nextTurnIdx, nextRound)
              return upd
            })
            return
          }

          const total = Number(res.total ?? res.amount ?? 0)
          if (!requireFunds(curIdx, total, 'esta compra')) { setTurnLockBroadcast(false); return }
          setPlayers(ps => {
            const upd = ps.map((p, i) =>
              i !== curIdx
                ? p
                : applyDeltas(p, {
                    cashDelta: -total,
                    directBuysPush: [ (res.item || { total }) ]
                  })
            )
            broadcastState(upd, nextTurnIdx, nextRound)
            return upd
          })
        }
      })()
    }

    // === Inside Sales: 12,21,30,42,53 ===
    const isInsideTile = (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53)
    if (isInsideTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] INSIDE tile landed:', landedOneBased)
        const res = await openModalAndWait(<InsideSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return
        const cost = Number(res.cost ?? res.total ?? 0)
        if (!requireFunds(curIdx, cost, 'contratar Inside Sales')) { setTurnLockBroadcast(false); return }
        const qty  = Number(res.headcount ?? res.qty ?? 1)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty })
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Clientes ===
    const isClientsTile =
      [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased)
    if (isClientsTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] CLIENTS tile landed:', landedOneBased)
        const res = await openModalAndWait(<ClientsModal currentCash={players[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return
        const cost  = Number(res.totalCost || 0)
        if (!requireFunds(curIdx, cost, 'comprar Clientes')) { setTurnLockBroadcast(false); return }
        const qty   = Number(res.qty || 0)
        const mAdd  = Number(res.maintenanceDelta || 0)
        const bensD = Number(res.bensDelta || cost)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : applyDeltas(p, {
                  cashDelta: -cost,
                  clientsDelta: qty,
                  manutencaoDelta: mAdd,
                  bensDelta: bensD
                })
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Gestor ===
    const isManagerTile = [18,24,29,51].includes(landedOneBased)
    if (isManagerTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] MANAGER tile landed:', landedOneBased)
        const res = await openModalAndWait(<ManagerModal currentCash={players[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'BUY' && res.action !== 'HIRE')) return
        const qty  = Number(res.headcount ?? res.qty ?? res.managersQty ?? 1)
        const cashDelta = Number(
          (typeof res.cashDelta !== 'undefined'
            ? res.cashDelta
            : -(Number(res.cost ?? res.total ?? res.totalHire ?? 0)))
        )
        const payAbs = cashDelta < 0 ? -cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Gestor')) { setTurnLockBroadcast(false); return }
        const mexp = Number(res.expenseDelta ?? res.totalExpense ?? res.maintenanceDelta ?? 0)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta, gestoresDelta: qty, manutencaoDelta: mexp })
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Field Sales ===
    const isFieldTile = [13,25,33,38,50].includes(landedOneBased)
    if (isFieldTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] FIELD tile landed:', landedOneBased)
        const res = await openModalAndWait(<FieldSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
        if (res && (res.action === 'HIRE' || res.action === 'BUY')) {
          const qty = Number(res.headcount ?? res.qty ?? 1)
          const deltas = {
            cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
            manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
            revenueDelta: Number(res.revenueDelta ?? 0),
            fieldSalesDelta: qty,
          }
          const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
          if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Field Sales')) { setTurnLockBroadcast(false); return }
          setPlayers(ps => {
            const upd = ps.map((p, i) =>
              i !== curIdx ? p : applyDeltas(p, deltas)
            )
            broadcastState(upd, nextTurnIdx, nextRound)
            return upd
          })
        }
      })()
    }

    // === Vendedores Comuns ===
    const isCommonSellersTile = [9,28,40,45].includes(landedOneBased)
    if (isCommonSellersTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] COMMON tile landed:', landedOneBased)
        const res = await openModalAndWait(<BuyCommonSellersModal currentCash={players[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return
        const qty  = Number(res.headcount ?? res.qty ?? 0)
        const deltas = {
          cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
          vendedoresComunsDelta: qty,
          manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
          revenueDelta: Number(res.revenueDelta ?? 0),
        }
        const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Vendedores Comuns')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, deltas)
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Mix de Produtos ===
    const isMixTile = [7,31,44].includes(landedOneBased)
    if (isMixTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] MIX tile landed:', landedOneBased)
        const res = await openModalAndWait(<MixProductsModal />)
        if (!res || res.action !== 'BUY') return
        const price = Number(res.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }
        const level = String(res.level || 'D')
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : applyDeltas(p, {
                  cashDelta: -price,
                  mixProdutosSet: level,
                  mixBaseSet: {
                    despesaPorCliente: Number(res.despesa || 0),
                    faturamentoPorCliente: Number(res.faturamento || 0),
                  },
                })
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Sorte & Revés ===
    const isLuckMisfortuneTile = [3,14,22,26,35,41,48,54].includes(landedOneBased)
    if (isLuckMisfortuneTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        console.log('[SG][Tiles] SORTE/REVÉS tile landed:', landedOneBased)
        const res = await openModalAndWait(<SorteRevesModal />)
        if (!res || res.action !== 'APPLY_CARD') return

        // Snapshot do jogador no momento da carta
        const meNow = players[curIdx] || players.find(isMine) || {}

        // --------- Regras condicionais por carta ----------
        // Ajusta deltas conforme certificados/estado atual
        let cashDelta    = Number.isFinite(res.cashDelta)    ? Number(res.cashDelta)    : 0
        let clientsDelta = Number.isFinite(res.clientsDelta) ? Number(res.clientsDelta) : 0

        // (REVÉS) "Sem certificado amarelo: perca 1 cliente e pague R$ 2.000,00."
        if (res.id === 'key_client_at_risk' && hasYellow(meNow)) {
          cashDelta = 0
          clientsDelta = 0
        }

        // (REVÉS) "Sem Certificado Azul: perca 4 clientes."
        if (res.id === 'needs_change_lose4' && hasBlue(meNow)) {
          clientsDelta = 0
        }

        // (SORTE) "Se tiver colaborador com certificado roxo premiado, receba R$ 25.000,00."
        if (res.id === 'purple_award_25k' && !hasPurple(meNow)) {
          cashDelta = 0
        }

        // --------- Bloqueio por falta de saldo (apenas se for pagar) ----------
        if (cashDelta < 0) {
          const need = -cashDelta
          if (!requireFunds(curIdx, need, 'pagar carta Sorte & Revés')) {
            // >>> AJUSTE: exibe alerta e NÃO aplica a carta; libera o turno para o jogador se recuperar
            try {
              alert(`Saldo insuficiente para pagar R$ ${need.toLocaleString()}. Use RECUPERAÇÃO FINANCEIRA (demitir / emprestar / reduzir) ou DECLARAR FALÊNCIA.`)
            } catch {}
            setTurnLockBroadcast(false)
            return
          }
        }

        // --------- Aplica efeitos base (deltas simples + células especiais) ----------
        setPlayers(ps => {
          const upd = ps.map((p,i) => {
            if (i !== curIdx) return p
            let next = { ...p }
            if (cashDelta)    next.cash    = Math.max(0, (next.cash    ?? 0) + cashDelta)
            if (clientsDelta) next.clients = Math.max(0, (next.clients ?? 0) + clientsDelta)
            if (res.gainSpecialCell) {
              next.fieldSales = (next.fieldSales || 0) + (res.gainSpecialCell.fieldSales || 0)
              next.support    = (next.support    || 0) + (res.gainSpecialCell.support    || 0)
              next.gestores   = (next.gestores   || 0) + (res.gainSpecialCell.manager    || 0)
              next.gestoresComerciais = (next.gestoresComerciais || 0) + (res.gainSpecialCell.manager || 0)
              next.managers   = (next.managers   || 0) + (res.gainSpecialCell.manager    || 0)
            }
            // (SORTE) "Ganhe um certificado azul para esse vendedor."
            if (res.id === 'casa_change_cert_blue') {
              next.az = (next.az || 0) + 1
              const curSet = new Set((next.trainingsByVendor?.comum || []))
              curSet.add('personalizado') // id do treinamento que dá azul
              next.trainingsByVendor = { ...(next.trainingsByVendor || {}), comum: Array.from(curSet) }
            }
            return next
          })
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })

        // --------- Efeitos derivados (bônus por cliente / gestor / mix) ----------
        const anyDerived =
          res.perClientBonus ||
          res.perCertifiedManagerBonus ||
          res.mixLevelBonusABOnly

        if (anyDerived) {
          const me2 = players[curIdx] || players.find(isMine) || {}
          let extra = 0

          if (res.perClientBonus) {
            extra += (Number(me2.clients) || 0) * Number(res.perClientBonus || 0)
          }

          if (res.perCertifiedManagerBonus) {
            const mgrCerts = countManagerCerts(me2) // certificados do tipo "gestor"
            extra += mgrCerts * Number(res.perCertifiedManagerBonus || 0)
          }

          if (res.mixLevelBonusABOnly) {
            const level = String(me2.mixProdutos || '').toUpperCase()
            if (level === 'A' || level === 'B') extra += Number(res.mixLevelBonusABOnly || 0)
          }

          if (extra) {
            setPlayers(ps => {
              const upd = ps.map((p,i) => i===curIdx ? { ...p, cash: (Number(p.cash)||0) + extra } : p)
              broadcastState(upd, nextTurnIdx, nextRound)
              return upd
            })
          }
        }
      })()
    }

    // === AUTO MODAIS ===
    if (crossedStart1 && isMyTurn && pushModal && awaitTop) {
      const meNow = players[curIdx] || {}
      const fat = Math.max(0, Math.floor(computeFaturamentoFor(meNow)))
      ;(async () => {
        console.log('[SG][Auto] FATURAMENTO +$%d', fat)
        await openModalAndWait(<FaturamentoDoMesModal value={fat} />)
        setPlayers(ps => {
          const upd = ps.map((p,i)=> i!==curIdx ? p : { ...p, cash: (p.cash||0) + fat })
          broadcastState(upd, nextTurnIdx, nextRound); return upd
        })
        appendLog(`${meNow.name} recebeu faturamento do mês: +$${fat.toLocaleString()}`)
        try { setTimeout(() => closeTop?.({ action:'AUTO_CLOSE_BELOW' }), 0) } catch {}
      })()
    }

    if (crossedExpenses23 && isMyTurn && pushModal && awaitTop) {
      const meNow = players[curIdx] || {}
      const expense = Math.max(0, Math.floor(computeDespesasFor(meNow)))

      const lp = meNow.loanPending || {}
      const shouldChargeLoan =
        Number(lp.amount) > 0 && !lp.charged &&
        (round >= Math.max(1, Number(lp.dueRound || 0)))

      const loanCharge = shouldChargeLoan ? Math.max(0, Math.floor(Number(lp.amount))) : 0

      ;(async () => {
        console.log('[SG][Auto] DESPESAS -$%d | loanCharge -$%d', expense, loanCharge)
        await openModalAndWait(<DespesasOperacionaisModal expense={expense} loanCharge={loanCharge} />)
        const totalCharge = expense + loanCharge
        if (!requireFunds(curIdx, totalCharge, 'pagar Despesas Operacionais')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = ps.map((p,i)=>{
            if (i!==curIdx) return p
            const next = { ...p, cash: Math.max(0, (p.cash||0) - totalCharge) }
            if (shouldChargeLoan) {
              next.loanPending = { ...(p.loanPending||{}), charged:true, chargedAtRound: round }
            }
            return next
          })
          broadcastState(upd, nextTurnIdx, nextRound); return upd
        })
        appendLog(`${meNow.name} pagou despesas operacionais: -$${expense.toLocaleString()}`)
        if (loanCharge > 0) appendLog(`${meNow.name} teve empréstimo cobrado: -$${loanCharge.toLocaleString()}`)
        try { setTimeout(() => closeTop?.({ action:'AUTO_CLOSE_BELOW' }), 0) } catch {}
      })()
    }

    // fail-safe: solta o cadeado quando todas as modais fecharem
    const start = Date.now()
    const tick = () => {
      if (modalLocksRef.current === 0) {
        console.log('[SG][App] tick(): modalLocks=0 => unlock')
        setTurnLockBroadcast(false); return
      }
      if (Date.now() - start > 20000) {
        console.warn('[SG][App] tick(): TIMEOUT 20s => force unlock')
        setModalLocks(0)
        setTurnLockBroadcast(false)
        return
      }
      setTimeout(tick, 80)
    }
    tick()
  }

  function nextTurn(){
    if (gameOver || !players.length) return
    // >>> AJUSTE: usa helper para pular jogadores falidos
    const nextTurnIdx = findNextAliveIdx(players, turnIdx)
    console.log('[SG][App] nextTurn() ->', nextTurnIdx)
    setTurnIdx(nextTurnIdx)
    broadcastState(players, nextTurnIdx, round)
  }

  function onAction(act){
    if (!act?.type || gameOver) return
    console.log('[SG][App] onAction =>', act)

    if (act.type === 'ROLL'){
      if (!isMyTurn) { console.warn('[SG][App] ROLL ignorado: não é a sua vez'); return }
      advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
      return
    }

    if (act.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      const cur = players.find(isMine)
      if (!cur) return
      const nextPlayers = players.map(p => (isMine(p) ? { ...p, cash: p.cash + recover } : p))
      appendLog(`${cur.name} ativou Recuperação Financeira (+$${recover})`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      setTurnLockBroadcast(false)
      return
    }

    if (act.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      const cur = players.find(isMine)
      if (!cur) return
      const nextPlayers = players.map(p => (isMine(p) ? { ...p, cash: p.cash + amount } : p))
      appendLog(`${cur.name} recuperou +$${amount}`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      setTurnLockBroadcast(false)
      return
    }

    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // AJUSTE: aplica resultado da demissão (RECOVERY_FIRE)
    if (act.type === 'RECOVERY_FIRE') {
      // { type:'FIRE', amount, items:{ comum, field, inside, gestor }, creditByRole, note }
      const amount = Number(act.amount || 0);
      const items  = act.items || {};

      const deltas = {
        cashDelta: amount,
        vendedoresComunsDelta: -Number(items.comum  || 0),
        fieldSalesDelta:      -Number(items.field  || 0),
        insideSalesDelta:     -Number(items.inside || 0),
        gestoresDelta:        -Number(items.gestor || 0),
      };

      const curIdx = turnIdx;
      setPlayers(ps => {
        const upd = ps.map((p, i) => (i !== curIdx ? p : applyDeltas(p, deltas)));
        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${current?.name || 'Jogador'}: ${act.note || 'Demissões'}`);
      setTurnLockBroadcast(false);
      return;
    }
    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    // >>> Empréstimo (entra no caixa agora e será cobrado nas Despesas Operacionais)
    if (act.type === 'RECOVERY_LOAN') {
      const amt = Math.max(0, Number(act.amount || 0));
      if (!amt) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      const cur = players[curIdx];

      if (cur?.loanPending && !cur.loanPending.charged) {
        appendLog(`${cur?.name || 'Jogador'} já possui um empréstimo pendente.`);
        setTurnLockBroadcast(false);
        return;
      }

      const dueRound = round + 1; // cobrar na próxima "Despesas Operacionais"
      setPlayers(ps => {
        const upd = ps.map((p, i) =>
          i !== curIdx
            ? p
            : {
                ...p,
                cash: (Number(p.cash) || 0) + amt,
                loanPending: { amount: amt, dueRound, charged: false },
              }
        );
        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${cur?.name || 'Jogador'} pegou empréstimo: +$${amt.toLocaleString()}`);
      setTurnLockBroadcast(false);
      return;
    }

    // -------------------------------------------------
    // COMPRA: MIX (acumula posse de níveis)
    // -------------------------------------------------
    if (act.type === 'BUY_MIX' || act.kind === 'MIX_BUY' || act.type === 'DIRECT_BUY_MIX') {
      const level = String(act.level || '').toUpperCase();   // 'A' | 'B' | 'C' | 'D'
      const price = Math.max(0, Number(act.price ?? 0));
      if (!['A','B','C','D'].includes(level)) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;
          const mixOwned = { ...(p.mixOwned || p.mix || {}), D: true };
          mixOwned[level] = true;

          return {
            ...p,
            cash: Math.max(0, (Number(p.cash) || 0) - price),
            mixOwned,
            mix: mixOwned,
            mixLevel: level,
            mixProdutos: level
          };
        });

        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${players[curIdx]?.name || 'Jogador'} comprou MIX nível ${level} por -$${price.toLocaleString()}`);
      setTurnLockBroadcast(false);
      return;
    }

    // -------------------------------------------------
    // COMPRA: ERP / SISTEMAS (acumula posse de níveis)
    // -------------------------------------------------
    if (act.type === 'BUY_ERP' || act.kind === 'ERP_BUY' || act.type === 'DIRECT_BUY_ERP') {
      const level = String(act.level || '').toUpperCase();   // 'A' | 'B' | 'C' | 'D'
      const price = Math.max(0, Number(act.price ?? 0));
      if (!['A','B','C','D'].includes(level)) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;

          const erpOwned = { ...(p.erpOwned || p.erp || {}), D: true };
          erpOwned[level] = true;

          return {
            ...p,
            cash: Math.max(0, (Number(p.cash) || 0) - price),
            erpOwned,
            erp: erpOwned,
            erpLevel: level,
            erpSystems: { ...(p.erpSystems || {}), level }
          };
        });

        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${players[curIdx]?.name || 'Jogador'} comprou ERP nível ${level} por -$${price.toLocaleString()}`);
      setTurnLockBroadcast(false);
      return;
    }

    // >>> Reduzir nível (vende um ou mais níveis de MIX/ERP e recebe o crédito agora)
    if (act.type === 'RECOVERY_REDUCE') {
      const normLevel = (v) => String(v || '').toUpperCase();
      const normGroup = (v) => {
        const g = String(v || '').toUpperCase();
        if (g === 'MIX' || g === 'ERP') return g;
        if (g.includes('MIX')) return 'MIX';
        if (g.includes('ERP')) return 'ERP';
        return '';
      };

      const collectSelections = () => {
        if (Array.isArray(act.items) && act.items.length) {
          return act.items
            .filter(it => (it?.selected ?? true))
            .map(it => ({
              group: normGroup(it.group || it.kind),
              level: normLevel(it.level),
              credit: Math.max(0, Number(it.credit ?? it.amount ?? 0)),
            }))
            .filter(s => (s.group === 'MIX' || s.group === 'ERP') && ['A','B','C','D'].includes(s.level));
        }

        const one = act.selection || act.target || null;
        if (one) {
          const s = {
            group: normGroup(one.group || one.kind),
            level: normLevel(one.level),
            credit: Math.max(0, Number(one.credit ?? one.amount ?? act.amount ?? 0)),
          };
          if ((s.group === 'MIX' || s.group === 'ERP') && ['A','B','C','D'].includes(s.level)) {
            return [s];
          }
        }

        return [];
      };

      const selections = collectSelections();

      // Fallback: apenas credita amount
      if (!selections.length) {
        const creditOnly = Math.max(0, Number(act.amount ?? 0));
        if (creditOnly > 0) {
          const curIdx = turnIdx;
          setPlayers(ps => {
            const upd = ps.map((p, i) =>
              i !== curIdx ? p : { ...p, cash: (Number(p.cash) || 0) + creditOnly }
            );
            broadcastState(upd, turnIdx, round);
            return upd;
          });
        }
        setTurnLockBroadcast(false);
        return;
      }

      const ensureOwnedFromLetter = (store, letter) => {
        const s = { A:false, B:false, C:false, D:false, ...(store || {}) };
        const L = normLevel(letter);
        if (!s.A && !s.B && !s.C && !s.D) {
          if (['A','B','C','D'].includes(L)) s[L] = true;
          else s.D = true; // base se nada existir
        }
        return s;
      };
      const letterFromOwned = (s) => {
        if (s?.A) return 'A';
        if (s?.B) return 'B';
        if (s?.C) return 'C';
        if (s?.D) return 'D';
        return '-';
      };

      const curIdx = turnIdx;
      const cur = players[curIdx];

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;

          let mixOwned = { A:false, B:false, C:false, D:false, ...(p.mixOwned || p.mix || {}) };
          let erpOwned = { A:false, B:false, C:false, D:false, ...(p.erpOwned || p.erp || {}) };

          mixOwned = ensureOwnedFromLetter(mixOwned, p.mixProdutos);
          erpOwned = ensureOwnedFromLetter(erpOwned, p.erpSistemas);

          let totalCredit = 0;
          for (const s of selections) {
            totalCredit += Math.max(0, Number(s.credit || 0));
            if (s.group === 'MIX') {
              mixOwned[s.level] = false;
            } else if (s.group === 'ERP') {
              erpOwned[s.level] = false;
            }
          }

          const mixLetter = letterFromOwned(mixOwned);
          const erpLetter = letterFromOwned(erpOwned);

          return {
            ...p,
            cash: (Number(p.cash) || 0) + totalCredit,

            // novas chaves de posse
            mixOwned,
            erpOwned,

            // compat com código legado que lê p.mix/p.erp como posse
            mix: mixOwned,
            erp: erpOwned,

            // letras usadas no HUD/painel
            mixProdutos: mixLetter,
            erpSistemas: erpLetter,
          };
        });

        broadcastState(upd, turnIdx, round);
        return upd;
      });

      const total = selections.reduce((acc, s) => acc + Math.max(0, Number(s.credit || 0)), 0);
      if (selections.length === 1) {
        const s = selections[0];
        appendLog(`${cur?.name || 'Jogador'} reduziu ${s.group} nível ${s.level} e recebeu +$${total.toLocaleString()}`);
      } else {
        appendLog(`${cur?.name || 'Jogador'} reduziu ${selections.length} níveis e recebeu +$${total.toLocaleString()}`);
      }

      setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'BANKRUPT'){
      // >>>>>>>>>>>>>>> INÍCIO: NOVA LÓGICA DE FALÊNCIA <<<<<<<<<<<<<<<
      const curIdx = turnIdx

      // Ativa overlay FALIDO na minha tela, se eu for o jogador atual
      try {
        const amI = String(players[curIdx]?.id) === String(myUid)
        if (amI) setShowBankruptOverlay(true)
      } catch {}

      // Marca o jogador como falido
      const updatedPlayers = players.map((p, i) => (i === curIdx ? { ...p, bankrupt: true } : p))

      appendLog(`${players[curIdx]?.name || 'Jogador'} declarou FALÊNCIA.`)

      // Evita travar avanço de rodada por jogador falido
      setRoundFlags(prev => {
        const nf = [...prev]
        nf[curIdx] = true
        return nf
      })

      // Se só restar 1 vivo, encerra e abre vencedores
      const alive = countAlivePlayers(updatedPlayers)
      if (alive <= 1) {
        // define vencedor (único não falido)
        const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
        setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
        setPlayers(updatedPlayers)
        setGameOver(true)
        setTurnLockBroadcast(false)
        broadcastState(updatedPlayers, turnIdx, round)
        return
      }

      // Caso contrário, segue o jogo pulando falidos
      const nextIdx = findNextAliveIdx(updatedPlayers, curIdx)
      setPlayers(updatedPlayers)
      setTurnIdx(nextIdx)
      setTurnLockBroadcast(false)
      broadcastState(updatedPlayers, nextIdx, round)
      // >>>>>>>>>>>>>>> FIM: NOVA LÓGICA DE FALÊNCIA <<<<<<<<<<<<<<<
      return
    }
  }

  // Mantém possibAt e clientsAt corretos
  useEffect(() => {
    const mine = players.find(isMine);
    if (!mine) return;
    const { cap, inAtt } = capacityAndAttendance(mine);
    console.log('[SG][App] capacity/attendance -> cap=%d inAtt=%d', cap, inAtt)
    setMeHud(h => ({ ...h, possibAt: cap, clientsAt: inAtt }));
  }, [players, isMine]) // eslint-disable-line

  // Fail-safe: solta o cadeado assim que não houver modal aberta
  useEffect(() => {
    if (modalLocks === 0 && turnLock) {
      console.log('[SG][App] useEffect unlock: modalLocks=0 & turnLock=true')
      setTurnLockBroadcast(false);
    }
  }, [modalLocks, turnLock]) // eslint-disable-line

  // [FIX] Quando virar MINHA vez e não houver modal, garanto unlock local.
  useEffect(() => {
    if (isMyTurn && !hasBlockingModal && turnLock) {
      console.log('[SG][FIX] Minha vez + sem modal => auto-unlock')
      setTurnLock(false)
    }
  }, [isMyTurn, hasBlockingModal, turnLock]) // eslint-disable-line

  // === Totais para o HUD
  const totals = useMemo(() => {
    const me = players.find(isMine) || players[0] || {};
    const fat = computeFaturamentoFor(me);
    const desp = computeDespesasFor(me);
    const { cap, inAtt } = capacityAndAttendance(me);
    const lvl = String(me.erpLevel || 'D').toUpperCase();
    const managerQty = Number(me.gestores ?? me.gestoresComerciais ?? me.managers ?? 0);
    return {
      faturamento: fat,
      manutencao: desp,
      emprestimos: (me.loanPending && !me.loanPending.charged) ? Number(me.loanPending.amount || 0) : 0,
      vendedoresComuns: me.vendedoresComuns || 0,
      fieldSales: me.fieldSales || 0,
      insideSales: me.insideSales || 0,
      mixProdutos: me.mixProdutos || 'D',
      bens: me.bens ?? 0,
      erpSistemas: lvl,
      clientes: me.clients || 0,
      onboarding: !!me.onboarding,
      az: me.az || 0, am: me.am || 0, rox: me.rox || 0,
      gestores: managerQty,
      gestoresComerciais: managerQty,
      possibAt: cap,
      clientsAt: inAtt,
    };
  }, [players, isMine]) // eslint-disable-line

  // === Start ===
  if (phase === 'start'){
    return (
      <StartScreen
        onEnter={(typedName) => {
          const name = getOrSetTabPlayerName(typedName || 'Jogador')
          setPlayers([applyStarterKit({ id: meId, name, cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 })])
          setRound(1); setTurnIdx(0); setLog([`Bem-vindo, ${name}!`])
          setGameOver(false); setWinner(null)
          setRoundFlags(new Array(1).fill(false))
          setPhase('lobbies')
        }}
      />
    )
  }

  // === Lobbies ===
  if (phase === 'lobbies'){
    return (
      <LobbyList
        onEnterRoom={(id) => {
          setCurrentLobbyId(id)
          // >>> informa ao provider para sincronizar nesta sala (use o UUID do lobby)
          window.__setRoomCode?.(id)
          // >>> já grava ?room e localStorage para compartilhar o link certo
          try {
            localStorage.setItem('sg:lastRoomName', String(id))
            const url = new URL(window.location.href)
            url.searchParams.set('room', String(id))
            history.replaceState(null, '', url.toString())
          } catch {}
          setPhase('playersLobby')
        }}
      />
    )
  }

  // === Players Lobby ===
  if (phase === 'playersLobby'){
    return (
      <PlayersLobby
        lobbyId={currentLobbyId}
        onBack={() => {
          // sair do lobby: pausa sync remoto
          window.__setRoomCode?.(null)
          setPhase('lobbies')
        }}
        onStartGame={(payload) => {
          // >>> garantir que todos usem a MESMA room (nome/uuid do lobby)
          const roomName =
            payload?.lobbyName ||
            payload?.lobby?.name ||
            payload?.name ||
            currentLobbyId ||
            'sala-demo'
          try {
            localStorage.setItem('sg:lastRoomName', String(roomName))
            const url = new URL(window.location.href)
            url.searchParams.set('room', String(roomName))
            history.replaceState(null, '', url.toString())
            if (!sessionStorage.getItem('sg:room-reloaded')) {
              sessionStorage.setItem('sg:room-reloaded', '1')
              location.reload()
              return // evita continuar neste ciclo; após reload o Provider já vem certo
            }
          } catch {}

          const raw = Array.isArray(payload)
            ? payload
            : (payload?.players ?? payload?.lobbyPlayers ?? [])
          const mapped = raw.map((p, i) =>
            applyStarterKit({
              id: String(p.id ?? p.player_id),
              name: p.name ?? p.player_name,
              cash: 18000,
              pos: 0,
              bens: 4000,
              color: ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4]
            })
          )
          if (mapped.length === 0) return

          // >>> alinhar meu UID com o id real vindo do lobby (comparando pelo nome)
          try {
            const mine = mapped.find(p => norm(p.name) === norm(myName))
            if (mine?.id) setMyUid(String(mine.id))
          } catch {}

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          setLog(['Jogo iniciado!'])
          setGameOver(false); setWinner(null)
          setMeHud(h => {
            const mine = mapped.find(isMine)
            return {
              ...h,
              name: mine?.name || mapped[0]?.name || 'Jogador',
              color: mine?.color || mapped[0]?.color || '#6c5ce7',
              cash: mine?.cash ?? 18000,
              possibAt: 0, clientsAt: 0
            }
          })
          setRoundFlags(new Array(mapped.length).fill(false))
          broadcastStart(mapped)
          setPhase('game')
        }}
      />
    )
  }

  // === Jogo ===
  const controlsCanRoll = isMyTurn && !turnLock // << nunca bloqueia por saldo
  console.log('[SG][Render] controlsCanRoll=%o | isMyTurn=%o turnLock=%o myCash=%d modalLocks=%d', controlsCanRoll, isMyTurn, turnLock, myCash, modalLocks)

  return (
    <div className="page">
      <header className="topbar">
        <div className="status" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span
            style={{
              width:18, height:18, borderRadius:'50%',
              border:'2px solid rgba(255,255,255,.9)',
              boxShadow:'0 0 0 2px rgba(0,0,0,.25)',
              background: meHud.color
            }}
          />
          <span style={{
            background:'#1f2430', border:'1px solid rgba(255,255,255,.12)',
            borderRadius:10, padding:'4px 10px', fontWeight:800
          }}>
            👤 {meHud.name}
          </span>
          <span>Possib. Atendimento: <b>{meHud.possibAt ?? 0}</b></span>
          <span>Clientes em Atendimento: <b>{meHud.clientsAt ?? 0}</b></span>
        </div>

        <div className="status" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span>Rodada: {round}</span>
          <span className="money">💵 $ {Number(myCash).toLocaleString()}</span>
        </div>
      </header>

      <main className="content">
        <div className="boardWrap">
          <Board
            players={players}
            turnIdx={turnIdx}
            onMeHud={setMeHud}
          />
        </div>
        <aside className="side">
          <HUD totals={totals} players={players} />

          {/* CONTROLES FIXOS NO RODAPÉ DA SIDEBAR */}
          <div className="controlsSticky">
            {/* usa o cadeado de turno entre abas + bloqueio por saldo */}
            <Controls onAction={onAction} current={current} isMyTurn={controlsCanRoll} />
            <div style={{ marginTop: 10 }}>
              <button
                className="btn dark"
                onClick={() => {
                  window.__setRoomCode?.(null) // pausa sync remoto ao sair
                  setPhase('lobbies')
                }}
              >
                Sair para Lobbies
              </button>
            </div>
          </div>

          {/* Tela final (pódio Top 3) */}
          {gameOver && (
            <FinalWinners
              players={players}
              onExit={() => {
                window.__setRoomCode?.(null)
                setPhase('lobbies')
              }}
              onRestart={() => {
                const reset = players.map(p => applyStarterKit({ ...p, cash:18000, bens:4000, pos:0 }))
                setPlayers(reset)
                setTurnIdx(0)
                setRound(1)
                setLog(['Novo jogo iniciado!'])
                setGameOver(false)
                setWinner(null)
                setRoundFlags(new Array(reset.length).fill(false))
              }}
            />
          )}
        </aside>
      </main>

      <footer className="foot">
        <small>Desenvolvido por <a href="https://www.tironitech.com" target="_blank" rel="noreferrer">tironitech.com</a></small>
      </footer>

      {/* Overlay persistente de FALÊNCIA para o meu jogador */}
      {showBankruptOverlay && <BankruptOverlay />}
    </div>
  )
}
