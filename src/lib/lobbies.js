// src/lib/lobbies.js
// ✅ CORREÇÃO: Usa o client Supabase unificado
import { supabase } from './supabaseClient.js'

/* ==============================
   LISTAGEM DE LOBBIES
   ============================== */
export async function listLobbies() {
  // uma única query; conta jogadores com LEFT JOIN
  const { data, error } = await supabase
    .from('lobbies')
    .select(`
      id,
      name,
      max_players,
      status,
      created_at,
      lobby_players!left(count)
    `)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map(l => ({
    id: l.id,
    name: l.name,
    max: l.max_players,
    status: l.status || 'open',
    created_at: l.created_at,
    players: (l.lobby_players?.[0]?.count ?? 0) | 0,
    lobby_players: l.lobby_players,
  }))
}

/** Realtime da lista de lobbies */
export function onLobbiesRealtime(cb) {
  const ch = supabase
    .channel('lobbies-list')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => cb?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_players' }, () => cb?.())
    .subscribe()
  return () => supabase.removeChannel(ch)
}

/* ==============================
   CRUD LOBBY
   ============================== */
export async function createLobby({ name, hostId, max = 4 }) {
  if (!hostId) throw new Error('hostId obrigatório em createLobby')

  const id =
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const row = {
    id,
    name,
    host_id: hostId,
    max_players: Number(max) || 4,
    status: 'open',
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('lobbies')
    .insert(row)
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function deleteLobbyIfEmpty(lobbyId) {
  const { count, error } = await supabase
    .from('lobby_players')
    .select('lobby_id', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)
  if (error) throw error

  if ((count || 0) === 0) {
    const { error: e2 } = await supabase.from('lobbies').delete().eq('id', lobbyId)
    if (e2) throw e2
  }
}

/* ==============================
   ENTRAR / SAIR / JOGADORES
   ============================== */
export async function joinLobby({ lobbyId, playerId, playerName, ready = false }) {
  const { data: lobby, error: e1 } = await supabase
    .from('lobbies')
    .select('id, max_players, status, host_id')
    .eq('id', lobbyId)
    .single()
  if (e1) throw e1
  if (lobby.status !== 'open') throw new Error('Sala fechada.')

  const { count, error: e2 } = await supabase
    .from('lobby_players')
    .select('lobby_id', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)
  if (e2) throw e2
  if ((count || 0) >= lobby.max_players) throw new Error('Sala cheia.')

  // [SYNC FIX] expõe meu player_id do lobby para o app (mesma semântica do Firebase)
  try { window.__MY_UID = playerId } catch {}

  const playerUpsert = {
    lobby_id: lobbyId,
    player_id: playerId,
    player_name: playerName,
    ready: !!ready,
    joined_at: new Date().toISOString(),
    last_seen: new Date().toISOString(), // ✅ NOVO
  }

  const { error: e3 } = await supabase
    .from('lobby_players')
    .upsert(
      playerUpsert,
      { onConflict: 'lobby_id,player_id' }
    )
  if (e3) throw e3

  if (!lobby.host_id) {
    await supabase.from('lobbies').update({ host_id: playerId }).eq('id', lobbyId)
  }
}

export async function leaveLobby({ lobbyId, playerId }) {
  const { data: lobby, error: e0 } = await supabase
    .from('lobbies')
    .select('id, host_id')
    .eq('id', lobbyId)
    .single()
  if (e0) throw e0

  const { error } = await supabase
    .from('lobby_players')
    .delete()
    .match({ lobby_id: lobbyId, player_id: playerId })
  if (error) throw error

  const { data: rest, error: er } = await supabase
    .from('lobby_players')
    .select('player_id, joined_at')
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true })
  if (er) throw er

  if (!rest || rest.length === 0) {
    await supabase.from('lobbies').delete().eq('id', lobbyId)
    return
  }

  if (lobby?.host_id === playerId) {
    const nextHost = rest[0]?.player_id
    if (nextHost) {
      await supabase.from('lobbies').update({ host_id: nextHost }).eq('id', lobbyId)
    }
  }
}

export async function listLobbyPlayers(lobbyId) {
  const { data, error } = await supabase
    .from('lobby_players')
    .select('player_id, player_name, ready, joined_at')
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function setPlayerReady({ lobbyId, playerId, ready }) {
  const { error } = await supabase
    .from('lobby_players')
    .update({ ready })
    .match({ lobby_id: lobbyId, player_id: playerId })
  if (error) throw error
}
export async function setReady(lobbyId, playerId, ready) {
  return setPlayerReady({ lobbyId, playerId, ready })
}

/** Atualiza o nome do jogador (usado para sincronizar com a StartScreen) */
export async function setPlayerName({ lobbyId, playerId, playerName }) {
  const { error } = await supabase
    .from('lobby_players')
    .update({ player_name: playerName })
    .match({ lobby_id: lobbyId, player_id: playerId })
  if (error) throw error
}

/** Muda status do lobby (host/admin) */
export async function setLobbyStatus(lobbyId, status) {
  const { error } = await supabase
    .from('lobbies')
    .update({ status })
    .eq('id', lobbyId)
  if (error) throw error
}

/**
 * Realtime de um lobby específico (com debounce e logs).
 */
export function onLobbyRealtime(lobbyId, cb) {
  let raf = 0
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => cb?.())
  }

  const ch = supabase
    .channel(`lobby-${lobbyId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobbyId}` },
      (p) => { console.debug('[rt] lobby_players:INSERT', p.new); schedule() }
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobbyId}` },
      (p) => { console.debug('[rt] lobby_players:UPDATE', p.new); schedule() }
    )
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobbyId}` },
      (p) => { console.debug('[rt] lobby_players:DELETE', p.old); schedule() }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (p) => { console.debug('[rt] lobbies:*', p.new || p.old); schedule() }
    )
    .subscribe()

  return () => {
    if (raf) cancelAnimationFrame(raf)
    supabase.removeChannel(ch)
  }
}

/** Detalhes do lobby */
export async function getLobby(lobbyId) {
  const { data, error } = await supabase
    .from('lobbies')
    .select('id,name,status,max_players,host_id,created_at')
    .eq('id', lobbyId)
    .single()
  if (error) throw error
  return data
}

/** Registro do início da partida (retorna o id do match) */
export async function startMatch({ lobbyId }) {
  const { data: players } = await supabase
    .from('lobby_players')
    .select('player_id, player_name, ready')
    .eq('lobby_id', lobbyId)

  const { data, error } = await supabase
    .from('matches')
    .insert({
      lobby_id: lobbyId,
      host_id: players?.[0]?.player_id || null,
      state: { players },
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

/** Obtém o match mais recente da sala (para sincronizar a navegação) */
export async function getLatestMatch(lobbyId) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, lobby_id, created_at')
    .eq('lobby_id', lobbyId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] || null
}

/* ==============================
   GERENCIAMENTO DE SALAS DE JOGO (ROOMS)
   ============================== */

/**
 * Remove um jogador de uma sala de jogo e deleta a sala se ficar vazia
 * Trabalha com a tabela 'lobbies' que é onde as salas realmente estão armazenadas
 */
export async function leaveRoom({ roomCode, playerId }) {
  if (!roomCode || !playerId) {
    console.log('[leaveRoom] Parâmetros inválidos:', { roomCode, playerId })
    return
  }

  try {
    console.log(`[leaveRoom] Tentando remover jogador ${playerId} da sala ${roomCode}`)
    
    // 1. Busca a sala na tabela 'lobbies' pelo ID (roomCode é o ID da sala)
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('id, name, host_id')
      .eq('id', roomCode)
      .single()

    if (lobbyError) {
      console.warn('[leaveRoom] Erro ao buscar lobby:', lobbyError)
      return
    }

    if (!lobby) {
      console.log(`[leaveRoom] Lobby ${roomCode} não encontrado`)
      return
    }

    console.log(`[leaveRoom] Lobby encontrado:`, lobby)

    // 2. Remove o jogador da tabela 'lobby_players'
    const { error: removeError } = await supabase
      .from('lobby_players')
      .delete()
      .match({ lobby_id: roomCode, player_id: playerId })

    if (removeError) {
      console.warn('[leaveRoom] Erro ao remover jogador:', removeError)
    } else {
      console.log(`[leaveRoom] Jogador ${playerId} removido do lobby ${roomCode}`)
    }

    // 3. Verifica se ainda há jogadores no lobby
    const { data: remainingPlayers, error: countError } = await supabase
      .from('lobby_players')
      .select('player_id')
      .eq('lobby_id', roomCode)

    if (countError) {
      console.warn('[leaveRoom] Erro ao contar jogadores restantes:', countError)
      return
    }

    // 4. Se não há mais jogadores, deleta o lobby
    if (!remainingPlayers || remainingPlayers.length === 0) {
      const { error: deleteError } = await supabase
        .from('lobbies')
        .delete()
        .eq('id', roomCode)

      if (deleteError) {
        console.warn('[leaveRoom] Erro ao deletar lobby vazio:', deleteError)
      } else {
        console.log(`[leaveRoom] Lobby ${roomCode} deletado com sucesso (sem jogadores)`)
      }
    } else {
      console.log(`[leaveRoom] Jogador ${playerId} saiu do lobby ${roomCode}. Restam ${remainingPlayers.length} jogadores.`)
      
      // Se o jogador que saiu era o host, transfere para o próximo jogador
      if (lobby.host_id === playerId && remainingPlayers.length > 0) {
        const nextHost = remainingPlayers[0].player_id
        const { error: updateError } = await supabase
          .from('lobbies')
          .update({ host_id: nextHost })
          .eq('id', roomCode)

        if (updateError) {
          console.warn('[leaveRoom] Erro ao transferir host:', updateError)
        } else {
          console.log(`[leaveRoom] Host transferido para ${nextHost}`)
        }
      }
    }
  } catch (error) {
    console.error('[leaveRoom] Erro inesperado:', error)
  }
}

/**
 * Remove um jogador de uma sala de jogo usando o ID da sala
 * Trabalha com a tabela 'lobbies' que é onde as salas realmente estão armazenadas
 */
export async function leaveRoomById({ roomId, playerId }) {
  if (!roomId || !playerId) {
    console.log('[leaveRoomById] Parâmetros inválidos:', { roomId, playerId })
    return
  }

  try {
    console.log(`[leaveRoomById] Tentando remover jogador ${playerId} da sala ${roomId}`)
    
    // 1. Remove o jogador da tabela 'lobby_players'
    const { error: removeError } = await supabase
      .from('lobby_players')
      .delete()
      .match({ lobby_id: roomId, player_id: playerId })

    if (removeError) {
      console.warn('[leaveRoomById] Erro ao remover jogador:', removeError)
    } else {
      console.log(`[leaveRoomById] Jogador ${playerId} removido do lobby ${roomId}`)
    }

    // 2. Verifica se ainda há jogadores no lobby
    const { data: remainingPlayers, error: countError } = await supabase
      .from('lobby_players')
      .select('player_id')
      .eq('lobby_id', roomId)

    if (countError) {
      console.warn('[leaveRoomById] Erro ao contar jogadores restantes:', countError)
      return
    }

    // 3. Se não há mais jogadores, deleta o lobby
    if (!remainingPlayers || remainingPlayers.length === 0) {
      const { error: deleteError } = await supabase
        .from('lobbies')
        .delete()
        .eq('id', roomId)

      if (deleteError) {
        console.warn('[leaveRoomById] Erro ao deletar lobby vazio:', deleteError)
      } else {
        console.log(`[leaveRoomById] Lobby ${roomId} deletado com sucesso (sem jogadores)`)
      }
    } else {
      console.log(`[leaveRoomById] Jogador ${playerId} saiu do lobby ${roomId}. Restam ${remainingPlayers.length} jogadores.`)
    }
  } catch (error) {
    console.error('[leaveRoomById] Erro inesperado:', error)
  }
}

// ===============================
// Heartbeat + Cleanup (Lobby)
// ===============================

function _numEnv(name, fallback) {
  const raw = import.meta.env?.[name]
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function getLobbyConfig() {
  return {
    emptyLobbyTtlMin: _numEnv('VITE_EMPTY_LOBBY_TTL_MINUTES', 30),
    lockedLobbyTtlMin: _numEnv('VITE_LOCKED_LOBBY_TTL_MINUTES', 120),
    stalePlayerTtlMin: _numEnv('VITE_STALE_LOBBY_PLAYER_TTL_MINUTES', 3),
    cleanupIntervalMs: _numEnv('VITE_LOBBY_CLEANUP_INTERVAL_MS', 120000),
    heartbeatIntervalMs: _numEnv('VITE_LOBBY_HEARTBEAT_INTERVAL_MS', 30000),
    maxLobbiesHardCap: _numEnv('VITE_MAX_LOBBIES_HARD_CAP', 200), // opcional
  }
}

let __lastSeenSupported = null
let __lastSeenProbePromise = null

export async function isLastSeenSupported() {
  if (__lastSeenSupported !== null) return __lastSeenSupported
  if (__lastSeenProbePromise) return __lastSeenProbePromise

  __lastSeenProbePromise = (async () => {
    const { error } = await supabase
      .from('lobby_players')
      .select('last_seen')
      .limit(1)

    if (error) {
      console.warn('[lobby] last_seen não disponível no Supabase. Heartbeat/limpeza por inatividade ficará limitada.')
      __lastSeenSupported = false
      return false
    }

    __lastSeenSupported = true
    return true
  })()

  return __lastSeenProbePromise
}

export async function touchLobbyPlayer({ lobbyId, playerId }) {
  if (!lobbyId || !playerId) return { ok: false, skipped: true }

  const supported = await isLastSeenSupported()
  if (!supported) return { ok: false, skipped: true }

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('lobby_players')
    .update({ last_seen: nowIso })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId)

  if (error) {
    console.warn('[hb] falha ao atualizar last_seen:', error?.message || error)
    return { ok: false, error }
  }

  return { ok: true }
}

export function startLobbyHeartbeat({ lobbyId, playerId, intervalMs } = {}) {
  if (!lobbyId || !playerId) return () => {}

  const cfg = getLobbyConfig()
  const ms = Number.isFinite(intervalMs) ? intervalMs : cfg.heartbeatIntervalMs

  let stopped = false

  const tick = async () => {
    if (stopped) return
    await touchLobbyPlayer({ lobbyId, playerId })
  }

  // dispara já (não esperar 30s)
  tick().catch(() => {})
  const t = setInterval(() => tick().catch(() => {}), ms)

  return () => {
    stopped = true
    clearInterval(t)
  }
}

function _chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function _fixHostsIfNeeded(lobbyIds) {
  if (!lobbyIds?.length) return

  const chunks = _chunk(lobbyIds, 25)

  for (const ids of chunks) {
    const [{ data: lobbies, error: lErr }, { data: players, error: pErr }] = await Promise.all([
      supabase.from('lobbies').select('id,status,host_id').in('id', ids),
      supabase.from('lobby_players').select('lobby_id,player_id,joined_at').in('lobby_id', ids).order('joined_at', { ascending: true }),
    ])

    if (lErr) {
      console.warn('[cleanup] falha ao buscar lobbies p/ fix host:', lErr.message || lErr)
      continue
    }
    if (pErr) {
      console.warn('[cleanup] falha ao buscar players p/ fix host:', pErr.message || pErr)
      continue
    }

    const byLobby = new Map()
    for (const p of players || []) {
      if (!byLobby.has(p.lobby_id)) byLobby.set(p.lobby_id, [])
      byLobby.get(p.lobby_id).push(p.player_id)
    }

    for (const l of lobbies || []) {
      // só mexe em open (em locked, host não é crítico pro lobby)
      if (l.status !== 'open') continue

      const pids = byLobby.get(l.id) || []
      if (!pids.length) continue

      if (!pids.includes(l.host_id)) {
        const newHost = pids[0]
        const { error: uErr } = await supabase.from('lobbies').update({ host_id: newHost }).eq('id', l.id)
        if (uErr) console.warn('[cleanup] falha ao atualizar host:', uErr.message || uErr)
      }
    }
  }
}

export async function cleanupLobbiesOnce() {
  const cfg = getLobbyConfig()
  const now = Date.now()

  // 1) remover players inativos (precisa last_seen)
  const supported = await isLastSeenSupported()
  if (supported) {
    const cutoffIso = new Date(now - cfg.stalePlayerTtlMin * 60_000).toISOString()

    const { data: staleRows, error: sErr } = await supabase
      .from('lobby_players')
      .select('lobby_id,player_id,joined_at,last_seen')
      .or(`last_seen.lt.${cutoffIso},and(last_seen.is.null,joined_at.lt.${cutoffIso})`)
      .limit(1000)

    if (sErr) {
      console.warn('[cleanup] erro buscando stale players:', sErr.message || sErr)
    } else if (staleRows?.length) {
      const impactedLobbyIds = [...new Set(staleRows.map(r => r.lobby_id))]

      const { error: dErr } = await supabase
        .from('lobby_players')
        .delete()
        .or(`last_seen.lt.${cutoffIso},and(last_seen.is.null,joined_at.lt.${cutoffIso})`)

      if (dErr) console.warn('[cleanup] erro deletando stale players:', dErr.message || dErr)
      else console.log(`[cleanup] removidos players inativos: ${staleRows.length}`)

      await _fixHostsIfNeeded(impactedLobbyIds)
    } else {
      console.log('[cleanup] nenhum player inativo pra remover.')
    }
  } else {
    console.warn('[cleanup] last_seen indisponível: pulando limpeza por inatividade.')
  }

  // 2) deletar salas vazias por TTL (open e locked)
  const lobbies = await listLobbies() // já existe no seu arquivo
  const emptyOpenCut = now - cfg.emptyLobbyTtlMin * 60_000
  const emptyLockedCut = now - cfg.lockedLobbyTtlMin * 60_000

  const emptyCandidates = []
  for (const l of lobbies || []) {
    const created = Date.parse(l.created_at || '')
    const count = Array.isArray(l.lobby_players) ? Number(l.lobby_players?.[0]?.count || 0) : 0

    if (count !== 0) continue
    if (!Number.isFinite(created)) continue

    if (l.status === 'open' && created < emptyOpenCut) emptyCandidates.push(l.id)
    if (l.status === 'locked' && created < emptyLockedCut) emptyCandidates.push(l.id)
  }

  // hard cap opcional: se explodiu de lobby, prioriza apagar vazias antigas
  if ((lobbies?.length || 0) > cfg.maxLobbiesHardCap) {
    console.warn('[cleanup] hard cap de lobbies excedido - priorizando remoção de vazias antigas.')
  }

  if (!emptyCandidates.length) {
    console.log('[cleanup] nada para deletar (salas vazias fora do TTL).')
    return
  }

  for (const ids of _chunk(emptyCandidates, 25)) {
    const { error: delErr } = await supabase.from('lobbies').delete().in('id', ids)
    if (delErr) console.warn('[cleanup] erro deletando lobbies:', delErr.message || delErr)
  }

  console.log(`[cleanup] lobbies vazios deletados: ${emptyCandidates.length}`)
}