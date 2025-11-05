// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// ✅ CORREÇÃO: Singleton pattern para evitar múltiplas instâncias
// Garante que apenas uma instância do Supabase client seja criada
export const supabase =
  globalThis.__sb__ ??
  (globalThis.__sb__ = createClient(url, anon, {
    auth: {
      storageKey: 'sb-sales-game-auth', // chave única para este app
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  }))
