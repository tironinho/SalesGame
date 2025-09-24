// src/auth.js
// Cliente Supabase + helpers de identidade por ABA (sessionStorage)
// Mantém também os helpers "legados" em localStorage para compatibilidade.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '[auth] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env ' +
    'e no Vercel → Project → Settings → Environment Variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

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

export function getOrSetTabPlayerName(defaultName = 'Jogador') {
  const K = 'sg_tab_player_name';
  let name = sessionStorage.getItem(K);
  if (!name) {
    name = defaultName;
    sessionStorage.setItem(K, name);
  }
  return name;
}
export function setTabPlayerName(name) {
  sessionStorage.setItem('sg_tab_player_name', name ?? 'Jogador');
  return name;
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
