// src/pages/LobbyList.jsx
import { useEffect, useState } from 'react'
import {
  getOrCreateTabPlayerId,     // <-- id por ABA
  makeId,                     // opcional, se quiser usar id novo ao criar
} from '../auth'
import { listLobbies, onLobbiesRealtime, cleanupLobbiesOnce, getLobbyConfig, createLobby, joinLobby } from '../lib/lobbies'

export default function LobbyList({ onEnterRoom, playerName }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cfg = getLobbyConfig()

    cleanupLobbiesOnce().catch(err => console.warn('[cleanup] falha:', err))

    const t = setInterval(() => {
      cleanupLobbiesOnce().catch(err => console.warn('[cleanup] falha:', err))
    }, cfg.cleanupIntervalMs)

    return () => clearInterval(t)
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const data = await listLobbies()
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const off = onLobbiesRealtime(() => refresh())
    return off
  }, [])

  // Cria e já entra na sala (host = jogador desta ABA)
  async function handleCreate() {
    const pn = String(playerName || '').trim()
    if (!pn) {
      alert('Digite seu nome na tela inicial antes de criar/entrar em salas.')
      return
    }
    const defaultName = `Sala de ${pn}`
    const name = prompt('Nome do lobby:', defaultName) || defaultName

    // usamos o id desta aba como hostId (ou gere um novo com makeId() se preferir)
    const hostId = getOrCreateTabPlayerId()
    try {
      const lobbyId = await createLobby({ name, hostId, max: 4 })
      await joinLobby({ lobbyId, playerId: hostId, playerName: pn, ready: false })
      onEnterRoom?.(lobbyId)
    } catch (e) {
      alert(e.message || 'Não foi possível criar o lobby.')
      await refresh()
    }
  }

  // Entra usando o id desta ABA (cada aba = jogador diferente)
  async function handleJoin(lobbyId) {
    try {
      const pn = String(playerName || '').trim()
      if (!pn) {
        alert('Digite seu nome na tela inicial antes de entrar em salas.')
        return
      }
      const playerId = getOrCreateTabPlayerId()
      await joinLobby({ lobbyId, playerId, playerName: pn, ready: false })
      onEnterRoom?.(lobbyId)
    } catch (e) {
      alert(e.message || 'Não foi possível entrar no lobby.')
    }
  }

  // ---------- UI ----------
  const styles = {
    page: { minHeight: '100vh', background: '#0f0f12', color: '#e9ecf1', padding: '32px 16px', display: 'flex', justifyContent: 'center' },
    container: { width: '100%', maxWidth: 980 },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
    title: { fontSize: 28, fontWeight: 800, color: '#fff' },
    actions: { display: 'flex', gap: 10 },
    btn: { padding: '12px 16px', border: 0, borderRadius: 12, fontWeight: 800, cursor: 'pointer' },
    btnPrimary: { background: '#4f46e5', color: '#fff', boxShadow: '0 8px 24px rgba(79,70,229,.25)' },
    btnSecondary: { background: '#20222a', color: '#fff', border: '1px solid #2b2e38' },
    // Área rolável (scroll interno, pois o body tem overflow:hidden no CSS global)
    // - overflowY: 'scroll' força reservar a barra
    // - maxHeight limita a área para a grid realmente “estourar” e rolar
    scrollArea: {
      flex: '1 1 auto',
      minHeight: 0,
      overflowY: 'scroll',
      maxHeight: 'calc(100vh - 180px)',
      paddingRight: 10,
      scrollbarGutter: 'stable',
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
    card: { background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 10px 20px rgba(0,0,0,.25)' },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    lobbyName: { fontSize: 18, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
    meta: { fontSize: 13, color: '#b8c0cc' },
    joinBtn: { padding: '10px 14px', borderRadius: 10, border: 0, background: '#7c3aed', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 20px rgba(124,58,237,.25)' },
    disabled: { opacity: .6, cursor: 'not-allowed', filter: 'grayscale(.3)' },
    empty: { marginTop: 24, padding: 18, borderRadius: 12, border: '1px dashed rgba(255,255,255,.12)', color: '#c7cfdb', textAlign: 'center' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>SalesGame — Lobbies</h2>
          <div style={styles.actions}>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleCreate}>Criar Lobby</button>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={refresh} disabled={loading}>
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {rows.length === 0 && !loading ? (
          <div style={styles.empty}>Nenhuma sala criada ainda. Clique em <b>Criar Lobby</b> para começar.</div>
        ) : (
          <div className="lobbyScroll" style={styles.scrollArea}>
            <div style={styles.grid}>
              {rows.map(r => {
                const isFull = (r.players ?? 0) >= (r.max ?? 4)
                const isOpen = (r.status ?? 'open') === 'open'
                const disabled = isFull || !isOpen

                return (
                  <div key={r.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div style={styles.lobbyName} title={r.name}>{r.name}</div>
                      <span style={styles.meta}>{r.players ?? 0}/{r.max ?? 4}</span>
                    </div>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={styles.meta}>status: {r.status ?? 'open'}</span>
                      <button
                        style={{ ...styles.joinBtn, ...(disabled ? styles.disabled : {}) }}
                        disabled={disabled}
                        onClick={() => handleJoin(r.id)}
                        title={disabled ? (isFull ? 'Sala cheia' : 'Sala não está aberta') : 'Entrar na sala'}
                      >
                        Entrar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
