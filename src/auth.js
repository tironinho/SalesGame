// src/auth.js
// ✅ CORREÇÃO: Helpers de identidade por ABA (sessionStorage)
// Mantém também os helpers "legados" em localStorage para compatibilidade.
// NÃO cria client Supabase - usa o client unificado de src/lib/supabaseClient.js

// Re-exporta o client unificado para compatibilidade com código legado
export { supabase } from './lib/supabaseClient.js'

export function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

/* ====== IDENTIDADE POR ABA (recomendado) ====== */
export function getOrCreateTabPlayerId() {
  const K = 'sg_tab_player_id';
  let id = sessionStorage.getItem(K);
  if (!id) {
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

/* ====== Helpers legados (ainda usados em outras telas) ====== */
export function getOrCreateLocalPlayerId() {
  const K = 'sg_player_id';
  let id = localStorage.getItem(K);
  if (!id) {
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
