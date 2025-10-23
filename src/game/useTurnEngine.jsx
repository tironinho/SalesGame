// src/game/useTurnEngine.jsx
import React from 'react'

// Pista
import { TRACK_LEN } from '../data/track'

// Modal system
import { useModal } from '../modals/ModalContext'

// Modais de jogo
import ERPSystemsModal from '../modals/ERPSystemsModal'
import TrainingModal from '../modals/TrainingModal'
import DirectBuyModal from '../modals/DirectBuyModal'
import InsideSalesModal from '../modals/InsideSalesModal'
import ClientsModal from '../modals/BuyClientsModal'
import ManagerModal from '../modals/BuyManagerModal'
import FieldSalesModal from '../modals/BuyFieldSalesModal'
import BuyCommonSellersModal from '../modals/BuyCommonSellersModal'
import MixProductsModal from '../modals/MixProductsModal'
import SorteRevesModal from '../modals/SorteRevesModal'
import FaturamentoDoMesModal from '../modals/FaturamentoMesModal'
import DespesasOperacionaisModal from '../modals/DespesasOperacionaisModal'

// Regras & helpers puros
import {
  applyDeltas,
  applyTrainingPurchase,
  crossedTile,
  countManagerCerts,
  hasBlue,
  hasPurple,
  hasYellow,
  capacityAndAttendance, // (importado caso queira usar para depurar HUD)
  computeDespesasFor,
  computeFaturamentoFor,
  countAlivePlayers,
  findNextAliveIdx,
} from './gameMath'

/**
 * Hook do motor de turnos.
 * Recebe estados do App e devolve handlers (advanceAndMaybeLap, onAction, nextTurn).
 */
export function useTurnEngine({
  players, setPlayers,
  round, setRound,
  turnIdx, setTurnIdx,
  roundFlags, setRoundFlags,
  isMyTurn,
  isMine,
  myUid, meId,
  myCash,
  current,
  broadcastState,
  appendLog,
  turnLock,
  setTurnLockBroadcast,
  gameOver, setGameOver,
  winner, setWinner,
  setShowBankruptOverlay,
}) {
  // ===== Modais =====
  const { pushModal, awaitTop, closeTop } = useModal?.() || {}

  // 🔒 contagem de modais abertas (para saber quando destravar turno)
  const [modalLocks, setModalLocks] = React.useState(0)
  const modalLocksRef = React.useRef(0)
  React.useEffect(() => { modalLocksRef.current = modalLocks }, [modalLocks])

  // 🔒 dono do cadeado de turno (garante que só o iniciador destrava)
  const [lockOwner, setLockOwner] = React.useState(null)
  const lockOwnerRef = React.useRef(null)
  React.useEffect(() => { lockOwnerRef.current = lockOwner }, [lockOwner])

  // helper: abrir modal e "travar"/"destravar" o contador
  const openModalAndWait = async (element) => {
    if (!(pushModal && awaitTop)) return null
    setModalLocks(c => c + 1)
    try {
      pushModal(element)
      const res = await awaitTop()
      return res
    } finally {
      setModalLocks(c => Math.max(0, c - 1))
    }
  }

  // ========= regras auxiliares de saldo =========
  const canPay = React.useCallback((idx, amount) => {
    const p = players[idx]
    const amt = Math.max(0, Number(amount || 0))
    return (Number(p?.cash || 0) >= amt)
  }, [players])

  const requireFunds = React.useCallback((idx, amount, reason) => {
    const ok = canPay(idx, amount)
    if (!ok) {
      appendLog(`Saldo insuficiente${reason ? ' para ' + reason : ''}. Use RECUPERAÇÃO (demitir / emprestar / reduzir) ou declare FALÊNCIA.`)
    }
    return ok
  }, [canPay, appendLog])

  // ========= fim de jogo =========
  const maybeFinishGame = React.useCallback((nextPlayers, nextRound) => {
    if (nextRound <= 5) return
    const ranked = [...nextPlayers].map(p => ({
      ...p,
      patrimonio: (p.cash || 0) + (p.bens || 0)
    })).sort((a,b) => b.patrimonio - a.patrimonio)
    setWinner(ranked[0] || null)
    setGameOver(true)
    appendLog('Fim de jogo! 5 rodadas completas.')
    setTurnLockBroadcast(false)
  }, [appendLog, setGameOver, setTurnLockBroadcast, setWinner])

  // ========= ação de andar no tabuleiro (inclui TODA a lógica de casas/modais) =========
  const advanceAndMaybeLap = React.useCallback((steps, deltaCash, note) => {
    if (gameOver || !players.length) return

    // Bloqueia os próximos jogadores até esta ação (e todas as modais) terminar
    setTurnLockBroadcast(true)
    setLockOwner(String(myUid))

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
        nextFlags = new Array(players.length).fill(false)
      }
    }
    setRoundFlags(nextFlags)

    // >>> pular jogadores falidos ao decidir o próximo turno
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

    // ================== Regras por casas (modais) ==================

    // ERP
    const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)
    if (isErpTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Treinamento
    const isTrainingTile = (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47)
    if (isTrainingTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Compra direta (menu)
    const isDirectBuyTile = (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43)
    if (isDirectBuyTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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
            if (r2 && (r2.action === 'HIRE' || r2.action === 'BUY')) {
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

    // Inside Sales (casa específica)
    const isInsideTile = (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53)
    if (isInsideTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Clientes
    const isClientsTile = [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased)
    if (isClientsTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Gestor
    const isManagerTile = [18,24,29,51].includes(landedOneBased)
    if (isManagerTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Field Sales
    const isFieldTile = [13,25,33,38,50].includes(landedOneBased)
    if (isFieldTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Vendedores Comuns
    const isCommonSellersTile = [9,28,40,45].includes(landedOneBased)
    if (isCommonSellersTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Mix de Produtos
    const isMixTile = [7,31,44].includes(landedOneBased)
    if (isMixTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
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

    // Sorte & Revés
    const isLuckMisfortuneTile = [3,14,22,26,35,41,48,54].includes(landedOneBased)
    if (isLuckMisfortuneTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        const res = await openModalAndWait(<SorteRevesModal />)
        if (!res || res.action !== 'APPLY_CARD') return

        const meNow = players[curIdx] || players.find(isMine) || {}

        let cashDelta    = Number.isFinite(res.cashDelta)    ? Number(res.cashDelta)    : 0
        let clientsDelta = Number.isFinite(res.clientsDelta) ? Number(res.clientsDelta) : 0

        if (res.id === 'key_client_at_risk' && hasYellow(meNow)) { cashDelta = 0; clientsDelta = 0 }
        if (res.id === 'needs_change_lose4' && hasBlue(meNow))   { clientsDelta = 0 }
        if (res.id === 'purple_award_25k' && !hasPurple(meNow))  { cashDelta = 0 }

        if (cashDelta < 0) {
          const need = -cashDelta
          if (!requireFunds(curIdx, need, 'pagar carta Sorte & Revés')) {
            try { alert(`Saldo insuficiente para pagar R$ ${need.toLocaleString()}. Use RECUPERAÇÃO FINANCEIRA (demitir / emprestar / reduzir) ou DECLARAR FALÊNCIA.`) } catch {}
            setTurnLockBroadcast(false)
            return
          }
        }

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
            if (res.id === 'casa_change_cert_blue') {
              next.az = (next.az || 0) + 1
              const curSet = new Set((next.trainingsByVendor?.comum || []))
              curSet.add('personalizado')
              next.trainingsByVendor = { ...(next.trainingsByVendor || {}), comum: Array.from(curSet) }
            }
            return next
          })
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })

        const anyDerived = res.perClientBonus || res.perCertifiedManagerBonus || res.mixLevelBonusABOnly
        if (anyDerived) {
          const me2 = players[curIdx] || players.find(isMine) || {}
          let extra = 0
          if (res.perClientBonus)           extra += (Number(me2.clients) || 0) * Number(res.perClientBonus || 0)
          if (res.perCertifiedManagerBonus) extra += countManagerCerts(me2) * Number(res.perCertifiedManagerBonus || 0)
          if (res.mixLevelBonusABOnly) {
            const level = String(me2.mixProdutos || '').toUpperCase()
            if (level === 'A' || level === 'B') extra += Number(res.mixLevelBonusABOnly || 0)
          }
          if (extra) {
            setPlayers(ps => {
              const upd = ps.map((p,i) => i===curIdx ? { ...p, cash: (Number(p.cash)||0) + extra } : p)
              broadcastState(upd, nextTurnIdx, nextRound); return upd
            })
          }
        }
      })()
    }

    // === AUTO-MODAIS (Faturamento / Despesas) ===
    if (crossedStart1 && isMyTurn && pushModal && awaitTop) {
      const meNow = players[curIdx] || {}
      const fat = Math.max(0, Math.floor(computeFaturamentoFor(meNow)))
      ;(async () => {
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
      const shouldChargeLoan = Number(lp.amount) > 0 && !lp.charged && (round >= Math.max(1, Number(lp.dueRound || 0)))
      const loanCharge = shouldChargeLoan ? Math.max(0, Math.floor(Number(lp.amount))) : 0

      ;(async () => {
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
        // libera apenas se EU for o dono do cadeado
        if (String(lockOwnerRef.current || '') === String(myUid)) {
          setTurnLockBroadcast(false)
        }
        return
      }
      if (Date.now() - start > 20000) {
        // força desbloqueio em caso extremo
        if (String(lockOwnerRef.current || '') === String(myUid)) {
          setTurnLockBroadcast(false)
        }
        return
      }
      setTimeout(tick, 80)
    }
    tick()
  }, [
    players, round, turnIdx, roundFlags, isMyTurn, isMine,
    myUid, myCash, gameOver,
    appendLog, broadcastState,
    setPlayers, setRound, setTurnIdx, setRoundFlags,
    setTurnLockBroadcast, requireFunds, maybeFinishGame,
    pushModal, awaitTop, closeTop
  ])

  // ========= handlers menores =========
  const nextTurn = React.useCallback(() => {
    if (gameOver || !players.length) return
    const nextTurnIdx = findNextAliveIdx(players, turnIdx)
    setTurnIdx(nextTurnIdx)
    broadcastState(players, nextTurnIdx, round)
  }, [broadcastState, gameOver, players, round, setTurnIdx, turnIdx])

  const onAction = React.useCallback((act) => {
    if (!act?.type || gameOver) return

    if (act.type === 'ROLL'){
      if (!isMyTurn) return
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

    if (act.type === 'RECOVERY_FIRE') {
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

      appendLog(`${players[curIdx]?.name || 'Jogador'}: ${act.note || 'Demissões'}`);
      setTurnLockBroadcast(false);
      return;
    }

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

      const dueRound = round + 1;
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

    if (act.type === 'BUY_MIX' || act.kind === 'MIX_BUY' || act.type === 'DIRECT_BUY_MIX') {
      const level = String(act.level || '').toUpperCase();
      const price = Math.max(0, Number(act.price ?? 0));
      if (!['A','B','C','D'].includes(level)) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      if (!canPay(curIdx, price)) { appendLog('Saldo insuficiente para comprar MIX'); setTurnLockBroadcast(false); return }

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

    if (act.type === 'BUY_ERP' || act.kind === 'ERP_BUY' || act.type === 'DIRECT_BUY_ERP') {
      const level = String(act.level || '').toUpperCase();
      const price = Math.max(0, Number(act.price ?? 0));
      if (!['A','B','C','D'].includes(level)) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      if (!canPay(curIdx, price)) { appendLog('Saldo insuficiente para comprar ERP'); setTurnLockBroadcast(false); return }

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
          else s.D = true;
        }
        return s;
      };
      const letterFromOwned = (s) => (s?.A ? 'A' : s?.B ? 'B' : s?.C ? 'C' : s?.D ? 'D' : '-');

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
            if (s.group === 'MIX')  mixOwned[s.level] = false;
            else                     erpOwned[s.level] = false;
          }

          const mixLetter = letterFromOwned(mixOwned);
          const erpLetter = letterFromOwned(erpOwned);

          return {
            ...p,
            cash: (Number(p.cash) || 0) + totalCredit,
            mixOwned, erpOwned,
            mix: mixOwned, erp: erpOwned,
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
      const curIdx = turnIdx
      try {
        const amI = String(players[curIdx]?.id) === String(myUid)
        if (amI) setShowBankruptOverlay?.(true)
      } catch {}

      const updatedPlayers = players.map((p, i) => (i === curIdx ? { ...p, bankrupt: true } : p))
      appendLog(`${players[curIdx]?.name || 'Jogador'} declarou FALÊNCIA.`)

      const alive = countAlivePlayers(updatedPlayers)
      if (alive <= 1) {
        const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
        setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
        setPlayers(updatedPlayers)
        setGameOver(true)
        setTurnLockBroadcast(false)
        broadcastState(updatedPlayers, turnIdx, round)
        return
      }

      const nextIdx = findNextAliveIdx(updatedPlayers, curIdx)
      setPlayers(updatedPlayers)
      setTurnIdx(nextIdx)
      setTurnLockBroadcast(false)
      broadcastState(updatedPlayers, nextIdx, round)
      return
    }
  }, [
    players, round, turnIdx, isMyTurn, isMine, myUid, myCash,
    gameOver, appendLog, broadcastState,
    setPlayers, setRound, setTurnIdx, setTurnLockBroadcast, setGameOver, setWinner,
    requireFunds, pushModal, awaitTop, closeTop, setShowBankruptOverlay
  ])

  // ====== efeitos de destrava automática ======

  // a) quando não houver modal aberta e ainda houver lock, tenta destravar
  React.useEffect(() => {
    if (modalLocks === 0 && turnLock) {
      if (String(lockOwner || '') === String(myUid)) {
        setTurnLockBroadcast(false)
      }
    }
  }, [modalLocks, turnLock, lockOwner, myUid, setTurnLockBroadcast])

  // b) quando virar "minha vez" e não houver modal, garanto unlock local
  React.useEffect(() => {
    if (isMyTurn && modalLocks === 0 && turnLock) {
      if (String(lockOwner || '') === String(myUid)) {
        setTurnLockBroadcast(false)
      }
    }
  }, [isMyTurn, modalLocks, turnLock, lockOwner, myUid, setTurnLockBroadcast])

  return {
    advanceAndMaybeLap,
    onAction,
    nextTurn,
    modalLocks,
    lockOwner,
  }
}
