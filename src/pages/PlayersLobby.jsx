// src/pages/PlayersLobby.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getLobby,
  listLobbyPlayers,
  onLobbyRealtime,
  leaveLobby,
  setReady,
  setLobbyStatus,
  startMatch,
  joinLobby,
  setPlayerName,
  getLatestMatch,          // <<< novo: verificar se já existe match
} from '../lib/lobbies'
import {
  getOrCreateTabPlayerId,   // id por ABA
  getOrSetTabPlayerName     // nome por ABA
} from '../auth'

export default function PlayersLobby({ lobbyId, onBack, onStartGame }) {
  const meId = getOrCreateTabPlayerId()
  const meName = getOrSetTabPlayerName('Jogador')

  const [lobby, setLobby] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  const triedEnsure   = useRef(false)
  const firstLoad     = useRef(true)
  const nameSynced    = useRef(false)
  const navigatedOnce = useRef(false)

  const amHost = useMemo(() => lobby?.host_id === meId, [lobby, meId])
  const me = useMemo(() => players.find(p => p.player_id === meId), [players, meId])
  const readyCount = useMemo(() => players.filter(p => p.ready).length, [players])
  const hasDuplicateNames = useMemo(() => {
    const names = players.map(p => String(p.player_name || '').trim().toLowerCase()).filter(Boolean)
    return new Set(names).size !== names.length
  }, [players])
  
  // precisa ser host, sala 'open', >=1 jogador e todos prontos
  const canStart = amHost && lobby?.status === 'open' && players.length >= 1 && readyCount === players.length
  
  // Debug logs para identificar o problema
  console.log('[PlayersLobby] Debug:', {
    players: players.length,
    readyCount,
    lobbyStatus: lobby?.status,
    amHost,
    canStart,
    meId,
    meName
  })

  // navega assim que existir match (evita corrida de eventos)
  async function maybeNavigate(pls) {
    if (navigatedOnce.current) return
    const match = await getLatestMatch(lobbyId)
    if (match?.id) {
      navigatedOnce.current = true
      const normalized = (pls || []).map((p, i) => ({
        id: p.player_id,
        name: p.player_name,
        index: i,
      }))
      onStartGame?.({
  lobbyId,
  matchId: match?.id,
  players: normalized,
  me: { id: meId, name: meName }   // <- ADICIONE ESTA LINHA
})
    }
  }

  async function refreshAll() {
    if (firstLoad.current) setLoading(true)
    try {
      console.log('[PlayersLobby] refreshAll - buscando lobby:', lobbyId)
      const [lb, pls] = await Promise.all([ getLobby(lobbyId), listLobbyPlayers(lobbyId) ])
      console.log('[PlayersLobby] refreshAll - lobby:', lb, 'players:', pls)
      setLobby(lb)
      setPlayers(pls)

      const mine = pls.find(p => p.player_id === meId)
      console.log('[PlayersLobby] refreshAll - mine:', mine, 'meId:', meId)

      // 1) Se não estou na sala, entra (uma vez)
      if (!mine && !triedEnsure.current && lb?.status === 'open') {
        console.log('[PlayersLobby] refreshAll - entrando na sala')
        triedEnsure.current = true
        try { 
          await joinLobby({ lobbyId, playerId: meId, playerName: meName, ready: false })
          console.log('[PlayersLobby] refreshAll - entrada na sala bem-sucedida')
          // Recarrega os jogadores após entrar na sala
          const newPls = await listLobbyPlayers(lobbyId)
          console.log('[PlayersLobby] refreshAll - jogadores após entrada:', newPls)
          setPlayers(newPls)
        } catch (e) {
          console.error('[PlayersLobby] refreshAll - erro ao entrar na sala:', e)
        }
      }

      // 2) Se estou na sala e o nome diverge, sincroniza (uma vez)
      if (mine && !nameSynced.current && meName && mine.player_name !== meName) {
        console.log('[PlayersLobby] refreshAll - sincronizando nome')
        nameSynced.current = true
        try { await setPlayerName({ lobbyId, playerId: meId, playerName: meName }) } catch {}
      }

      // 3) Se já existe match (host iniciou), navega todos imediatamente
      await maybeNavigate(pls)
    } catch (e) {
      console.error('[PlayersLobby] refreshAll - erro:', e)
    } finally {
      if (firstLoad.current) { firstLoad.current = false; setLoading(false) }
    }
  }

  // no topo do arquivo já existe: import { leaveLobby } from '../lib/lobbies'

useEffect(() => {
  const leave = () => {
    // melhor esforço: não bloqueia a navegação
    leaveLobby({ lobbyId, playerId: meId }).catch(() => {});
  };
  const onHide = () => leave();

  // 'pagehide' cobre mobile e navegações de SPA; 'beforeunload' cobre desktop
  window.addEventListener('pagehide', onHide);
  window.addEventListener('beforeunload', onHide);

  return () => {
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('beforeunload', onHide);
  };
}, [lobbyId, meId]);


  useEffect(() => {
    triedEnsure.current = false
    firstLoad.current = true
    nameSynced.current = false
    navigatedOnce.current = false
    refreshAll()
    const off = onLobbyRealtime(lobbyId, () => refreshAll())
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId])

  // Toggle otimista
  async function setReadyUI(next) {
    if (!me) return
    setToggling(true)
    const prev = me.ready
    setPlayers(curr => curr.map(p => p.player_id === meId ? { ...p, ready: next } : p))
    try {
      await setReady(lobbyId, meId, next)
    } catch (e) {
      setPlayers(curr => curr.map(p => p.player_id === meId ? { ...p, ready: prev } : p))
      console.error('setReadyUI failed', e)
    } finally {
      setToggling(false)
    }
  }

  async function handleLeave() {
    try { await leaveLobby({ lobbyId, playerId: meId }) } finally { onBack?.() }
  }

  async function handleStart() {
    if (!canStart) return
    const prev = lobby?.status
    await setLobbyStatus(lobbyId, 'locked')   // trava a sala
    try {
      const match = await startMatch({ lobbyId })
      // Host também navega (e marca para não navegar de novo via realtime)
      navigatedOnce.current = true
      const normalized = players.map((p, i) => ({ id: p.player_id, name: p.player_name, index: i }))
      onStartGame?.({
  lobbyId,
  matchId: match?.id,
  players: normalized,
  me: { id: meId, name: meName }   // <- ADICIONE ESTA LINHA
})
    } catch (e) {
      console.error('startMatch failed', e)
      await setLobbyStatus(lobbyId, prev || 'open') // rollback
    }
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.top}>
          <button style={s.backBtn} onClick={handleLeave}>← Voltar</button>
          <h2 style={s.title}>SalesGame — {lobby?.name || '...'}</h2>
        </div>

        <div style={s.table}>
          <div style={s.thead}>
            <div style={s.colPlayer}>Jogador</div>
            <div style={s.colReady}>Pronto?</div>
          </div>

        {loading ? (
          <div style={s.loading}>Carregando...</div>
        ) : (
          players.map((p) => (
            <div key={p.player_id} style={s.row}>
              <div style={s.colPlayer}>
                <span style={s.avatar}>{(p.player_name || '?').slice(0,2).toLowerCase()}</span>
                <span>{p.player_name || 'Anônimo'}</span>
                {lobby?.host_id === p.player_id && <span style={s.badgeHost}>Host</span>}
                {p.player_id === meId && <span style={s.badgeYou}>Você</span>}
              </div>

              <div style={s.colReady}>
                {p.player_id === meId ? (
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      style={{ ...s.btn, ...(!me?.ready ? s.btnDark : s.btnGhost) }}
                      onClick={() => setReadyUI(false)}
                      disabled={toggling || !me?.ready}
                    >
                      Não pronto
                    </button>
                    <button
                      style={{ ...s.btn, ...(me?.ready ? s.btnPrimary : s.btnPurple) }}
                      onClick={() => setReadyUI(true)}
                      disabled={toggling || !!me?.ready}
                    >
                      ⚡ {me?.ready ? 'Pronto' : 'Ficar pronto'}
                    </button>
                  </div>
                ) : (
                  <span style={p.ready ? s.pillReady : s.pillWait}>
                    {p.ready ? 'Pronto' : 'Aguardando'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        </div>

        <div style={s.footer}>
          <div style={s.statusWrap}>
            <span style={{ ...s.dot, background: lobby?.status === 'open' ? '#22c55e' : '#f59e0b' }} />
            <span>status: {lobby?.status || '...'}</span>
            <span style={{ marginLeft: 12 }}>Prontos: {readyCount}/{players.length}</span>
          </div>
          {hasDuplicateNames && (
            <div style={{ marginTop: 8, color: '#ffd54f', fontWeight: 800 }}>
              ⚠️ Aviso: existe nome duplicado na sala. (A identidade é pelo ID; renomear evita confusão.)
            </div>
          )}

          <div style={{ display:'flex', gap:12 }}>
            <button style={{ ...s.btn, ...(canStart ? s.btnPrimary : s.disabled) }} onClick={handleStart} disabled={!canStart}>
              Iniciar partida
            </button>
            <button style={{ ...s.btn, ...s.btnDark }} onClick={handleLeave}>
              Sair da sala
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'#0f0f12', color:'#e9ecf1', padding:'24px 16px', display:'flex', justifyContent:'center' },
  container: { width:'100%', maxWidth: 980 },
  top: { display:'flex', alignItems:'center', gap:12, marginBottom:16 },
  backBtn: { padding:'10px 14px', background:'#20222a', border:'1px solid #2b2e38', borderRadius:12, color:'#fff', cursor:'pointer' },
  title: { margin:0, fontSize:28, fontWeight:800 },
  table: { background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, overflow:'hidden' },
  thead: { display:'grid', gridTemplateColumns:'1fr 220px', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.08)', color:'#c7cfdb' },
  row: { display:'grid', gridTemplateColumns:'1fr 220px', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.06)' },
  colPlayer: { display:'flex', alignItems:'center', gap:10, minWidth:0 },
  colReady: { display:'flex', alignItems:'center', justifyContent:'flex-end' },
  avatar: { width:28, height:28, borderRadius:999, background:'#1f2430', display:'grid', placeItems:'center', color:'#c7cfdb', fontSize:12, textTransform:'lowercase' },
  badgeHost:{ marginLeft:8, fontSize:12, background:'#fde68a', color:'#111827', padding:'2px 8px', borderRadius:999, fontWeight:800 },
  badgeYou:{ marginLeft:8, fontSize:12, background:'#bfdbfe', color:'#111827', padding:'2px 8px', borderRadius:999, fontWeight:800 },
  loading:{ padding:16, color:'#c7cfdb' },
  pillReady:{ background:'rgba(34,197,94,.15)', color:'#22c55e', padding:'6px 10px', borderRadius:999, fontWeight:700 },
  pillWait:{ background:'rgba(245,158,11,.14)', color:'#f59e0b', padding:'6px 10px', borderRadius:999, fontWeight:700 },
  footer:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:16 },
  statusWrap:{ display:'flex', alignItems:'center', gap:6, color:'#c7cfdb' },
  dot:{ width:8, height:8, borderRadius:'50%' },
  btn:{ padding:'12px 16px', border:0, borderRadius:12, fontWeight:800, cursor:'pointer' },
  btnPrimary:{ background:'#4f46e5', color:'#fff', boxShadow:'0 8px 24px rgba(79,70,229,.25)' },
  btnPurple:{ background:'#7c3aed', color:'#fff' },
  btnDark:{ background:'#20222a', color:'#fff', border:'1px solid #2b2e38' },
  btnGhost:{ background:'transparent', color:'#e9ecf1', border:'1px solid rgba(255,255,255,.15)' },
  disabled:{ opacity:.5, cursor:'not-allowed', filter:'grayscale(.25)' },
}
