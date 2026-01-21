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

export function getOrSetTabPlayerName(defaultName = 'Jogador') {
  const K = 'sg_tab_player_name';
  let name = sessionStorage.getItem(K);
  // ✅ FIX: considerar "ausente" APENAS quando for null/undefined.
  // string vazia "" é válida (StartScreen deve iniciar vazio).
  if (name === null || name === undefined) {
    // ✅ FIX: default único por aba (evita colisão de nome "Jogador" em múltiplos clients/abas)
    // Se caller passar um default diferente de "Jogador", respeita.
    const base = String(defaultName || 'Jogador')
    if (base.trim().toLowerCase() === 'jogador') {
      const id = getOrCreateTabPlayerId()
      const suffix = String(id || '').slice(-4).toUpperCase()
      name = `Jogador-${suffix || 'XXXX'}`
    } else {
      name = base
    }
    sessionStorage.setItem(K, name);
  }
  return name;
}
export function setTabPlayerName(name) {
  const clean = String(name ?? '')
  // ✅ Persistência explícita (apenas quando usuário confirma)
  try { localStorage.setItem(TAB_PLAYER_NAME_KEY, clean.trim()) } catch {}
  sessionStorage.setItem('sg_tab_player_name', clean);
  return clean;
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
