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
    players: (l.lobby_players?.[0]?.count ?? 0) | 0,
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

  const { error: e3 } = await supabase
    .from('lobby_players')
    .upsert(
      {
        lobby_id: lobbyId,
        player_id: playerId,
        player_name: playerName,
        ready: !!ready,
        joined_at: new Date().toISOString(),
      },
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