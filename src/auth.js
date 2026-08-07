// src/auth.js
// ✅ CORREÇÃO: Helpers de identidade por ABA (sessionStorage)
// Mantém também os helpers "legados" em localStorage para compatibilidade.
// NÃO cria client Supabase - usa o client unificado de src/lib/supabaseClient.js

// Re-exporta o client unificado para compatibilidade com código legado
export { supabase } from './lib/supabaseClient.js'

import { createUuidV4, isValidUuid } from './lib/uuid.js'

// Mantida por compatibilidade com imports existentes; sempre UUID válido.
export function makeId() {
  return createUuidV4();
}

/* ====== IDENTIDADE POR ABA (recomendado) ====== */
export function getOrCreateTabPlayerId() {
  const K = 'sg_tab_player_id';
  let id = sessionStorage.getItem(K);
  // Substitui IDs antigos inválidos (ex.: "1785934638134-yuhltw", gerados
  // pelo fallback anterior quando crypto.randomUUID não existia em HTTP).
  if (!isValidUuid(id)) {
    id = makeId();
    sessionStorage.setItem(K, id);
  }
  return id;
}

// ====== NOME DO JOGADOR (sem default automático) ======
export const TAB_PLAYER_NAME_KEY = 'sg:playerName'

export function getTabPlayerName() {
  try {
    return String(localStorage.getItem(TAB_PLAYER_NAME_KEY) || '')
  } catch {
    return ''
  }
}

export function clearTabPlayerName() {
  try { localStorage.removeItem(TAB_PLAYER_NAME_KEY) } catch {}
  try { sessionStorage.removeItem('sg_tab_player_name') } catch {}
}

export function getOrSetTabPlayerName(defaultName = '') {
  // ✅ OBRIGATÓRIO (regressão): NÃO gerar nome padrão automaticamente.
  // - Se já existe no sessionStorage, retorna (inclusive string vazia).
  // - Se receber explicitamente um defaultName válido, persiste e retorna.
  // - Caso contrário, retorna "".
  const SESSION_K = 'sg_tab_player_name'
  const existing = sessionStorage.getItem(SESSION_K)
  if (existing !== null && existing !== undefined) return String(existing)

  const clean = String(defaultName ?? '').trim()
  if (clean) {
    try { sessionStorage.setItem(SESSION_K, clean) } catch {}
    try { localStorage.setItem(TAB_PLAYER_NAME_KEY, clean) } catch {}
    return clean
  }
  return ''
}
export function setTabPlayerName(name) {
  const clean = String(name ?? '').trim()
  // ✅ Persistência explícita (apenas quando usuário confirma)
  if (clean) {
    try { localStorage.setItem(TAB_PLAYER_NAME_KEY, clean) } catch {}
    try { sessionStorage.setItem('sg_tab_player_name', clean) } catch {}
  }
  return clean
}

/* ====== Identidade por sala/partida (localStorage) ======
   Permite fechar a aba e reentrar na MESMA room com o mesmo playerId.
   Chave: sg:matchIdentity:<roomCode>
   Valor: { playerId, playerName }
   playerId é a chave canônica (UUID); nome é só cosmético. */
export const MATCH_IDENTITY_PREFIX = 'sg:matchIdentity:'

export function matchIdentityStorageKey (roomCode) {
  // Canonicaliza: UUID/código case-insensitive → chave estável no localStorage
  const code = String(roomCode ?? '').trim().toLowerCase()
  if (!code) return null
  return `${MATCH_IDENTITY_PREFIX}${code}`
}

function matchIdentityDevLog (event, detail) {
  if (!import.meta.env.DEV) return
  try {
    console.log(`[matchIdentity] ${event}`, detail ?? '')
  } catch {}
}

export function getMatchIdentity (roomCode) {
  const key = matchIdentityStorageKey(roomCode)
  if (!key) return null
  try {
    let raw = localStorage.getItem(key)
    // Compat: chave legada sem toLowerCase
    if (!raw) {
      const legacy = `${MATCH_IDENTITY_PREFIX}${String(roomCode ?? '').trim()}`
      if (legacy !== key) {
        raw = localStorage.getItem(legacy)
        if (raw) {
          localStorage.setItem(key, raw)
          localStorage.removeItem(legacy)
          matchIdentityDevLog('migrated-legacy-key', { hasValue: true })
        }
      }
    }
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const playerId = String(parsed?.playerId ?? '').trim()
    if (!isValidUuid(playerId)) return null
    return {
      playerId,
      playerName: String(parsed?.playerName ?? '').trim(),
    }
  } catch {
    return null
  }
}

export function setMatchIdentity (roomCode, { playerId, playerName } = {}) {
  const key = matchIdentityStorageKey(roomCode)
  const id = String(playerId ?? '').trim()
  if (!key || !isValidUuid(id)) {
    matchIdentityDevLog('set-skip', { reason: !key ? 'no-key' : 'bad-playerId' })
    return null
  }
  const payload = {
    playerId: id,
    playerName: String(playerName ?? '').trim(),
  }
  try {
    localStorage.setItem(key, JSON.stringify(payload))
    matchIdentityDevLog('set-ok', { keySuffix: key.slice(-8) })
  } catch (e) {
    matchIdentityDevLog('set-fail', { reason: 'storage' })
  }
  return payload
}

/** Remoção explícita (abandonar partida / nova sessão incompatível). Não chamar em refresh. */
export function clearMatchIdentity (roomCode) {
  const key = matchIdentityStorageKey(roomCode)
  if (!key) return
  try {
    localStorage.removeItem(key)
    // remove legado se existir
    const legacy = `${MATCH_IDENTITY_PREFIX}${String(roomCode ?? '').trim()}`
    if (legacy !== key) localStorage.removeItem(legacy)
    matchIdentityDevLog('clear', { keySuffix: key.slice(-8) })
  } catch {}
}

/** DEV: quantas identidades de sala existem no localStorage (sem expor IDs). */
export function countMatchIdentities () {
  let n = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(MATCH_IDENTITY_PREFIX)) n++
    }
  } catch {}
  return n
}

/**
 * Resolve o playerId para uma sala:
 * 1) identidade persistida da room (sobrevive fechar aba)
 * 2) senão UUID da aba atual, e grava como identidade dessa room
 */
export function resolvePlayerIdForRoom (roomCode, { playerName } = {}) {
  const code = String(roomCode ?? '').trim()
  const name = String(playerName ?? getTabPlayerName() ?? '').trim()
  const existing = getMatchIdentity(code)
  if (existing?.playerId) {
    if (name && name !== existing.playerName) {
      setMatchIdentity(code, { playerId: existing.playerId, playerName: name })
    }
    return existing.playerId
  }
  const id = getOrCreateTabPlayerId()
  if (code) setMatchIdentity(code, { playerId: id, playerName: name })
  return id
}

/* ====== Helpers legados (ainda usados em outras telas) ====== */
export function getOrCreateLocalPlayerId() {
  const K = 'sg_player_id';
  let id = localStorage.getItem(K);
  // Mesma validação: mantém UUID válido, troca valor ausente/inválido.
  if (!isValidUuid(id)) {
    id = makeId();
    localStorage.setItem(K, id);
  }
  return id;
}

export function getOrSetPlayerName(defaultName = 'Jogador') {
  const K = 'sg_player_name';
  let name = localStorage.getItem(K);
  if (!name) {
    name = defaultName;
    localStorage.setItem(K, name);
  }
  return name;
}
export function setLocalPlayerName(name) {
  localStorage.setItem('sg_player_name', name ?? 'Jogador');
  return name;
}
