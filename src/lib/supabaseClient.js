// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Garante instância única mesmo com HMR/StrictMode/múltiplos imports
const g = globalThis
export const supabase =
  g.__sg_supabase ||
  (g.__sg_supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // chave própria evita colisão com outros apps/instâncias
      storageKey: 'salesgame-auth'
    },
    realtime: { params: { eventsPerSecond: 10 } },
  }))
