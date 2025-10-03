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

// >>> usa identidade POR ABA (evita bloquear em todo mundo)
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

export default function App() {
  const [phase, setPhase] = useState('start')
  const [currentLobbyId, setCurrentLobbyId] = useState(null)

  const [players, setPlayers] = useState([
    { id: 1, name: 'Jogador 1', cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 }
  ])
  const [round, setRound] = useState(1)
  const [turnIdx, setTurnIdx] = useState(0)
  const [log, setLog] = useState(['Bem-vindo ao Sales Game!'])
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState(null)

  // --- quem sou eu (por ABA)
  const meId = useMemo(() => getOrCreateTabPlayerId(), [])
  const myName = useMemo(() => getOrSetTabPlayerName('Jogador'), [])

  // 👉 clamp do índice de turno quando muda a quantidade de players
  useEffect(() => {
    setTurnIdx(t => (players.length > 0 ? (t % players.length + players.length) % players.length : 0))
  }, [players.length])

  const current = players[turnIdx]

  // 🔒 vez do jogador: prioriza ID; só cai para nome se faltar id
  const isMyTurn = useMemo(() => {
    const owner = players[turnIdx]
    if (!owner) return false
    if (owner.id != null) return String(owner.id) === String(meId)
    return (owner.name || '') === (myName || '')
  }, [players, turnIdx, meId, myName])

  // >>> acesso ao sistema de modais
  const { pushModal, awaitTop, closeTop } = useModal?.() || {}

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

  // >>> SALDO ATUAL DO JOGADOR DESTA ABA (sempre atualizado)
  const myCash = useMemo(
    () => (players.find(p => String(p.id) === String(meId) || p.name === myName)?.cash ?? 0),
    [players, meId, myName]
  )

  // Mantém o meHud.cash sincronizado (caso outros pontos dependam dele)
  useEffect(() => {
    const mine = players.find(p => String(p.id) === String(meId) || p.name === myName)
    if (!mine) return
    setMeHud(h => (h.cash === mine.cash ? h : { ...h, cash: mine.cash }))
  }, [players, meId, myName])

  // ======= helper: aplica deltas padronizados em um player =======
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
    if (Number.isFinite(deltas.gestoresDelta)) add('gestores', Number(deltas.gestoresDelta))
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

  // ======= helpers para as modais automáticas =======
  function computeFaturamentoFor(player = {}) {
    const insideQty = Number(player.insideSales || 0)
    const insideCertsCount = new Set(player?.trainingsByVendor?.inside || []).size
    const insideRevenuePer = 1500 + 500 * insideCertsCount
    const insideRevenueTotal = insideQty * insideRevenuePer

    const ERP = { A:{ fat:1000 }, B:{ fat:500 }, C:{ fat:200 }, D:{ fat:70 } }
    const lvl = String(player.erpLevel || 'D').toUpperCase()
    const erpFat  = (ERP[lvl]?.fat  ?? 0)

    const dynamicRevenue = Number(player.revenue || 0)
    return 770 + insideRevenueTotal + erpFat + dynamicRevenue
  }

  function computeDespesasFor(player = {}) {
    const insideQty = Number(player.insideSales || 0)
    const insideCertsCount = new Set(player?.trainingsByVendor?.inside || []).size
    const insideExpensePer = 2000 + 100 * insideCertsCount
    const insideExpenseTotal = insideQty * insideExpensePer

    const ERP = { A:{ desp:400 }, B:{ desp:200 }, C:{ desp:100 }, D:{ desp:50 } }
    const lvl = String(player.erpLevel || 'D').toUpperCase()
    const erpDesp = (ERP[lvl]?.desp ?? 0)

    const baseMaintenance = 1150 + Number(player.manutencao || 0)
    return baseMaintenance + insideExpenseTotal + erpDesp
  }

  function crossedTile(oldPos, newPos, tileIndex /* zero-based */) {
    if (oldPos === newPos) return false
    if (oldPos < newPos) return tileIndex > oldPos && tileIndex <= newPos
    return tileIndex > oldPos || tileIndex <= newPos // deu a volta
  }

  // ======= helper ESPECÍFICO: aplicar compra de treinamentos =======
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

  // ======= SYNC ENTRE ABAS (mesmo navegador) =======
  const syncKey = useMemo(
    () => `sg-sync:${currentLobbyId || 'local'}`,
    [currentLobbyId]
  )
  const bcRef = useRef(null)

  useEffect(() => {
    if (phase !== 'game') return
    try {
      bcRef.current?.close?.()
      const bc = new BroadcastChannel(syncKey)
      bc.onmessage = (e) => {
        const d = e.data
        if (!d || d.type !== 'SYNC') return
        if (String(d.source) === String(meId)) return
        setPlayers(d.players)
        setTurnIdx(d.turnIdx)
        setRound(d.round)
      }
      bcRef.current = bc
      return () => bc.close()
    } catch {}
  }, [phase, syncKey, meId])

  function broadcastState(nextPlayers, nextTurnIdx, nextRound) {
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round: nextRound,
        source: meId,
      })
    } catch {}
  }

  function appendLog(msg){ setLog(l => [msg, ...l].slice(0, 12)) }

  // >>> encerra jogo quando TOD@S completarem 5 rodadas
  function maybeFinishGame(nextPlayers, nextRound) {
    if (nextRound <= 5) return
    const ranked = [...nextPlayers].map(p => ({
      ...p,
      patrimonio: (p.cash || 0) + (p.bens || 0)
    })).sort((a,b) => b.patrimonio - a.patrimonio)
    setWinner(ranked[0] || null)
    setGameOver(true)
    appendLog('Fim de jogo! 5 rodadas completas.')
  }

  function advanceAndMaybeLap(steps, deltaCash, note){
    if (gameOver) return
    if (!players.length) return

    const curIdx = turnIdx
    const cur = players[curIdx]
    if (!cur) return

    const oldPos = cur.pos
    const newPos = (oldPos + steps) % TRACK_LEN
    const lap = newPos < oldPos

    const nextPlayers = players.map((p, i) =>
      i !== curIdx ? p : { ...p, pos: newPos, cash: p.cash + (deltaCash || 0) }
    )
    const nextRound = lap ? round + 1 : round
    const nextTurnIdx = (curIdx + 1) % players.length

    if (deltaCash) appendLog(`${cur.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${Math.abs(deltaCash)}`)
    if (note) appendLog(note)

    setPlayers(nextPlayers)
    setRound(nextRound)
    setTurnIdx(nextTurnIdx)
    broadcastState(nextPlayers, nextTurnIdx, nextRound)

    // verifica fim de jogo
    maybeFinishGame(nextPlayers, nextRound)
    if (nextRound > 5) return // não abre mais modais após fim

    // === Tiles (1-based) ===
    const landedOneBased = newPos + 1

    // === Verificações de "passou por" (não precisa parar exatamente)
    const crossedStart1 = crossedTile(oldPos, newPos, 0)      // casa 1 (índice 0)
    const crossedExpenses23 = crossedTile(oldPos, newPos, 22) // casa 23 (índice 22)

    // === ERP/Sistemas: 6,16,32,49 ===
    const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)
    if (isErpTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<ERPSystemsModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const price = Number(res.values?.compra || 0)
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
      pushModal(<TrainingModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
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
      pushModal(<DirectBuyModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (!res) return

        if (res.action === 'OPEN') {
          const open = String(res.open || '').toUpperCase()

          if (open === 'MIX') {
            pushModal(<MixProductsModal />)
            const r2 = await awaitTop()
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.compra || 0)
              const level = String(r2.level || 'D')
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
            pushModal(<ManagerModal currentCash={players[curIdx]?.cash ?? myCash} />)
            const r2 = await awaitTop()
            if (r2 && r2.action === 'BUY') {
              const qty  = Number(r2.qty ?? 1)
              const cashDelta = Number(
                (typeof r2.cashDelta !== 'undefined' ? r2.cashDelta : -(Number(r2.cost ?? r2.total ?? 0)))
              )
              const mexp = Number(r2.expenseDelta ?? r2.totalExpense ?? 0)
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
            pushModal(<InsideSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
            const r2 = await awaitTop()
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const cost = Number(r2.cost ?? r2.total ?? 0)
              const qty  = Number(r2.headcount ?? r2.qty ?? 1)
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty }))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'FIELD') {
            pushModal(<FieldSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
            const r2 = await awaitTop()
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const qty = Number(r2.headcount ?? r2.qty ?? 1)
              const deltas = {
                cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
                manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
                revenueDelta: Number(r2.revenueDelta ?? 0),
                fieldSalesDelta: qty,
              }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'COMMON') {
            pushModal(<BuyCommonSellersModal currentCash={players[curIdx]?.cash ?? myCash} />)
            const r2 = await awaitTop()
            if (r2 && r2.action === 'BUY') {
              const qty  = Number(r2.qty ?? 0)
              const deltas = {
                cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? 0))),
                vendedoresComunsDelta: qty,
                manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
                revenueDelta: Number(r2.revenueDelta ?? 0),
              }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'ERP') {
            pushModal(<ERPSystemsModal currentCash={players[curIdx]?.cash ?? myCash} />)
            const r2 = await awaitTop()
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.values?.compra || 0)
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: r2.level }))
                broadcastState(upd, nextTurnIdx, nextRound); return upd
              })
            }
            return
          }

          if (open === 'CLIENTS') {
            pushModal(<ClientsModal currentCash={players[curIdx]?.cash ?? myCash} />)
            const r2 = await awaitTop()
            if (r2 && r2.action === 'BUY') {
              const cost  = Number(r2.totalCost || 0)
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
            pushModal(<TrainingModal />)
            const r2 = await awaitTop()
            if (r2 && r2.action === 'BUY') {
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
            typeof res.qty !== 'undefined' ||
            typeof res.totalCost !== 'undefined' ||
            typeof res.maintenanceDelta !== 'undefined'

          if (isClientsBuy) {
            const cost  = Number(res.totalCost ?? res.total ?? res.amount ?? 0)
            const qty   = Number(res.qty ?? res.clientsQty ?? res.numClients ?? 0)
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
      pushModal(<InsideSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return
        const cost = Number(res.cost ?? res.total ?? 0)
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

    // === Clientes: 4,8,15,17,20,27,34,36,39,46,52,55 ===
    const isClientsTile = (
      landedOneBased === 4 || landedOneBased === 8 || landedOneBased === 15 || landedOneBased === 17 ||
      landedOneBased === 20 || landedOneBased === 27 || landedOneBased === 34 || landedOneBased === 36 ||
      landedOneBased === 39 || landedOneBased === 46 || landedOneBased === 52 || landedOneBased === 55
    )
    if (isClientsTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<ClientsModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const cost  = Number(res.totalCost || 0)
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

    // === Gestor: 18,24,29,51 ===
    const isManagerTile = (landedOneBased === 18 || landedOneBased === 24 || landedOneBased === 29 || landedOneBased === 51)
    if (isManagerTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<ManagerModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const qty  = Number(res.qty ?? 1)
        const cashDelta = Number(
          (typeof res.cashDelta !== 'undefined' ? res.cashDelta : -(Number(res.cost ?? res.total ?? 0)))
        )
        const mexp = Number(res.expenseDelta ?? res.totalExpense ?? 0)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta, gestoresDelta: qty, manutencaoDelta: mexp })
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Field Sales: 13,25,33,38,50 ===
    const isFieldTile = (landedOneBased === 13 || landedOneBased === 25 || landedOneBased === 33 || landedOneBased === 38 || landedOneBased === 50)
    if (isFieldTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<FieldSalesModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (res && (res.action === 'HIRE' || res.action === 'BUY')) {
          const qty = Number(res.headcount ?? res.qty ?? 1)
          const deltas = {
            cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
            manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
            revenueDelta: Number(res.revenueDelta ?? 0),
            fieldSalesDelta: qty,
          }
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

    // === Vendedores Comuns: 9,28,40,45 ===
    const isCommonSellersTile = (landedOneBased === 9 || landedOneBased === 28 || landedOneBased === 40 || landedOneBased === 45)
    if (isCommonSellersTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<BuyCommonSellersModal currentCash={players[curIdx]?.cash ?? myCash} />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const qty  = Number(res.qty ?? 0)
        const deltas = {
          cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? 0))),
          vendedoresComunsDelta: qty,
          manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
          revenueDelta: Number(res.revenueDelta ?? 0),
        }
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, deltas)
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Mix de Produtos: 7,31,44 ===
    const isMixTile = (landedOneBased === 7 || landedOneBased === 31 || landedOneBased === 44)
    if (isMixTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<MixProductsModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const price = Number(res.compra || 0)
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

    // === Sorte & Revés: 3,14,22,26,35,41,48,54 ===
    const isLuckMisfortuneTile = (
      landedOneBased === 3  || landedOneBased === 14 ||
      landedOneBased === 22 || landedOneBased === 26 ||
      landedOneBased === 35 || landedOneBased === 41 ||
      landedOneBased === 48 || landedOneBased === 54
    )
    if (isLuckMisfortuneTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<SorteRevesModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'APPLY_CARD') return

        setPlayers(ps => {
          const upd = ps.map((p,i) => {
            if (i !== curIdx) return p
            let next = { ...p }
            if (Number.isFinite(res.cashDelta)) next.cash = (next.cash ?? 0) + Number(res.cashDelta)
            if (Number.isFinite(res.clientsDelta)) next.clients = Math.max(0, (next.clients || 0) + Number(res.clientsDelta))
            if (res.gainSpecialCell) {
              next.fieldSales = (next.fieldSales || 0) + (res.gainSpecialCell.fieldSales || 0)
              next.support    = (next.support    || 0) + (res.gainSpecialCell.support    || 0)
              next.gestores   = (next.gestores   || 0) + (res.gainSpecialCell.manager    || 0)
            }
            return next
          })
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })

        if (res.perClientBonus || res.perCertifiedManagerBonus || res.mixLevelBonusABOnly) {
          const me = players[curIdx] || players.find(p => String(p.id) === String(meId) || p.name === myName)
          let delta = 0
          if (res.perClientBonus) delta += (me?.clients || 0) * res.perClientBonus
          if (res.perCertifiedManagerBonus) {
            const certifiedManagers = (me?.gestoresCertificados || 0)
            delta += certifiedManagers * res.perCertifiedManagerBonus
          }
          if (res.mixLevelBonusABOnly) {
            const level = String(me?.mixProdutos || '').toUpperCase()
            if (level === 'A' || level === 'B') delta += res.mixLevelBonusABOnly
          }
          if (delta) {
            setPlayers(ps => {
              const upd = ps.map((p,i) => i===curIdx ? { ...p, cash: (p.cash||0) + delta } : p)
              broadcastState(upd, nextTurnIdx, nextRound)
              return upd
            })
          }
        }
      })()
    }

    // === MODAIS AUTOMÁTICAS POR PASSAR NAS CASAS ===

    // Casa 1: Faturamento do mês (fecha também a modal abaixo, se existir)
    if (crossedStart1 && isMyTurn && pushModal && awaitTop) {
      const meNow = players[curIdx] || {}
      const fat = Math.max(0, Math.floor(computeFaturamentoFor(meNow)))
      pushModal(<FaturamentoDoMesModal value={fat} />)
      ;(async () => {
        await awaitTop()
        setPlayers(ps => {
          const upd = ps.map((p,i)=> i!==curIdx ? p : { ...p, cash: (p.cash||0) + fat })
          broadcastState(upd, nextTurnIdx, nextRound); return upd
        })
        appendLog(`${meNow.name} recebeu faturamento do mês: +$${fat.toLocaleString()}`)
        try { setTimeout(() => closeTop?.({ action:'AUTO_CLOSE_BELOW' }), 0) } catch {}
      })()
    }

    // Casa 23: Despesas operacionais (+ cobrança única de empréstimo, se houver)
    if (crossedExpenses23 && isMyTurn && pushModal && awaitTop) {
      const meNow = players[curIdx] || {}
      const expense = Math.max(0, Math.floor(computeDespesasFor(meNow)))

      const lp = meNow.loanPending || {} // { amount, dueRound, charged }
      const shouldChargeLoan =
        Number(lp.amount) > 0 &&
        !lp.charged &&
        (round >= Math.max(1, Number(lp.dueRound || 0)))

      const loanCharge = shouldChargeLoan ? Math.max(0, Math.floor(Number(lp.amount))) : 0

      pushModal(<DespesasOperacionaisModal expense={expense} loanCharge={loanCharge} />)
      ;(async () => {
        await awaitTop()
        setPlayers(ps => {
          const upd = ps.map((p,i)=>{
            if (i!==curIdx) return p
            const next = { ...p, cash: (p.cash||0) - (expense + loanCharge) }
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
  }

  function nextTurn(){
    if (gameOver || !players.length) return
    const nextTurnIdx = (turnIdx + 1) % players.length
    setTurnIdx(nextTurnIdx)
    broadcastState(players, nextTurnIdx, round)
  }

  function onAction(act){
    if (!act?.type || gameOver) return

    if (act.type === 'ROLL'){
      if (!isMyTurn) return
      advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
      return
    }

    if (act.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      const cur = players.find(p => String(p.id) === String(meId) || p.name === myName)
      if (!cur) return
      const nextPlayers = players.map(p => (String(p.id) === String(meId) || p.name === myName) ? { ...p, cash: p.cash + recover } : p)
      appendLog(`${cur.name} ativou Recuperação Financeira (+$${recover})`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      return
    }

    if (act.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      const cur = players.find(p => String(p.id) === String(meId) || p.name === myName)
      if (!cur) return
      const nextPlayers = players.map(p => (String(p.id) === String(meId) || p.name === myName) ? { ...p, cash: p.cash + amount } : p)
      appendLog(`${cur.name} recuperou +$${amount}`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      return
    }

    if (act.type === 'BANKRUPT'){
      appendLog(`${current?.name || 'Jogador'} declarou falência!`)
      nextTurn()
      return
    }
  }

  // === Totais para o HUD (do jogador desta ABA)
  const totals = useMemo(() => {
    const me = players.find(p => String(p.id) === String(meId) || p.name === myName) || players[0] || {}

    const insideQty = Number(me.insideSales || 0)
    const insideCertsCount = new Set(me?.trainingsByVendor?.inside || []).size
    const insideRevenuePer = 1500 + 500 * insideCertsCount
    const insideExpensePer = 2000 + 100 * insideCertsCount
    const insideRevenueTotal = insideQty * insideRevenuePer
    const insideExpenseTotal = insideQty * insideExpensePer

    const ERP = {
      A:{ fat:1000, desp:400 },
      B:{ fat:500,  desp:200 },
      C:{ fat:200,  desp:100 },
      D:{ fat:70,   desp:50  },
    }
    const lvl = String(me.erpLevel || 'D').toUpperCase()
    const erpFat  = (ERP[lvl]?.fat  ?? 0)
    const erpDesp = (ERP[lvl]?.desp ?? 0)

    const dynamicRevenue = Number(me.revenue || 0)

    return {
      faturamento: 770 + insideRevenueTotal + erpFat + dynamicRevenue,
      manutencao: 1150 + (me.manutencao || 0) + insideExpenseTotal + erpDesp,
      emprestimos: 0,
      vendedoresComuns: me.vendedoresComuns || 0,
      fieldSales: me.fieldSales || 0,
      insideSales: insideQty,
      mixProdutos: me.mixProdutos || 'D',
      bens: me.bens ?? 0,
      erpSistemas: lvl,
      clientes: me.clients || 0,
      onboarding: !!me.onboarding,
      az: me.az || 0, am: me.am || 0, rox: me.rox || 0,
      gestores: me.gestores || 0,
    }
  }, [players, meId, myName])

  // === Start ===
  if (phase === 'start'){
    return (
      <StartScreen
        onEnter={(typedName) => {
          const name = getOrSetTabPlayerName(typedName || 'Jogador')
          setPlayers([{ id: meId, name, cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 }])
          setRound(1); setTurnIdx(0); setLog([`Bem-vindo, ${name}!`])
          setGameOver(false); setWinner(null)
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
          setPhase('playersLobby')
        }}
      />
    )
  }

  // === Players Lobby (pronto / host / iniciar) ===
  if (phase === 'playersLobby'){
    return (
      <PlayersLobby
        lobbyId={currentLobbyId}
        onBack={() => setPhase('lobbies')}
        onStartGame={(payload) => {
          const raw = Array.isArray(payload)
            ? payload
            : (payload?.players ?? payload?.lobbyPlayers ?? [])
          // mantém id (string) vindo do lobby; ordem do lobby define ordem dos turnos
          const mapped = raw.map((p, i) => ({
            id: String(p.id ?? p.player_id),
            name: p.name ?? p.player_name,
            cash: 18000,
            pos: 0,
            bens: 4000,
            color: ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4]
          }))

          if (mapped.length === 0) return

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          setLog(['Jogo iniciado!'])
          setGameOver(false); setWinner(null)
          setMeHud(h => {
            const mine = mapped.find(x => String(x.id) === String(meId) || x.name === myName)
            return {
              ...h,
              name: mine?.name || mapped[0]?.name || 'Jogador',
              color: mine?.color || mapped[0]?.color || '#6c5ce7',
              cash: mine?.cash ?? 18000,
              possibAt: 0, clientsAt: 0
            }
          })
          setPhase('game')
        }}
      />
    )
  }

  // === Jogo ===
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
            <Controls onAction={onAction} current={current} isMyTurn={isMyTurn} />
            <div style={{ marginTop: 10 }}>
              <button className="btn dark" onClick={() => setPhase('lobbies')}>Sair para Lobbies</button>
            </div>
          </div>

          {/* Tela final (pódio Top 3) */}
          {gameOver && (
            <FinalWinners
              players={players}
              onExit={() => setPhase('lobbies')}
              onRestart={() => {
                const reset = players.map(p => ({ ...p, cash:18000, bens:4000, pos:0 }))
                setPlayers(reset)
                setTurnIdx(0)
                setRound(1)
                setLog(['Novo jogo iniciado!'])
                setGameOver(false)
                setWinner(null)
              }}
            />
          )}
        </aside>
      </main>

      <footer className="foot">
        <small>Desenvolvido por <a href="https://www.tironitech.com" target="_blank" rel="noreferrer">tironitech.com</a></small>
      </footer>
    </div>
  )
}
