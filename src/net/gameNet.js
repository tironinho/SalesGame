// ✅ CORREÇÃO: Usa o client Supabase unificado
import { supabase } from '../lib/supabaseClient.js'
import { nanoid } from 'nanoid/non-secure'

/**
 * Protocolo:
 * - Estado autoritativo fica em `rooms.state` (JSON) + `version` (CAS).
 * - Atualizações: UPDATE rooms SET state=?, version=version+1 WHERE id=? AND version=?  (otimismo; se falhar, refaz com base no último).
 * - Realtime: escuta mudanças na row (UPDATE) e aplica no cliente.
 * - Presença: canal Realtime com presence (apenas p/ saber quem tá online).
 */

export class GameNet {
  constructor({ roomCode, playerId, playerName, onRemoteState }) {
    this.roomCode = roomCode
    this.playerId = playerId || nanoid(10)
    // ✅ Não inventa nome aqui; o fluxo correto exige StartScreen.
    this.playerName = playerName || ''
    this.onRemoteState = onRemoteState
    this.room = null
    this.channel = null
    this.closed = false
    this._joining = false
  }

  async _ensureRoom() {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', this.roomCode)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      // cria room vazia
      const { data: created, error: e2 } = await supabase
        .from('rooms')
        .insert({ code: this.roomCode, state: {}, version: 0 })
        .select()
        .single()
      if (e2) throw e2
      this.room = created
    } else {
      this.room = data
    }

    // upsert player na sala
    await supabase.from('room_players').upsert({
      room_id: this.room.id,
      player_id: this.playerId,
      name: this.playerName
    })
  }

  async connect() {
    if (this._joining) return
    this._joining = true
    await this._ensureRoom()

    // 1) Assina updates da row rooms (estado autoritativo)
    supabase
      .channel(`rooms_row_${this.room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${this.room.id}` },
        (payload) => {
          const row = payload.new
          this.room = row
          // Notifica UI com { state, version }
          if (typeof this.onRemoteState === 'function') {
            this.onRemoteState({ state: row.state, version: row.version })
          }
        }
      )
      .subscribe()

    // 2) Canal com presence + sinais leves (locks opcionais)
    this.channel = supabase.channel(`room_${this.room.id}`, {
      config: { presence: { key: this.playerId } }
    })

    this.channel.on('presence', { event: 'sync' }, () => {
      // lista de presentes (se quiser exibir)
      const presences = this.channel.presenceState()
      // console.log('[presence]', presences)
    })

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          playerId: this.playerId,
          name: this.playerName,
          ts: Date.now()
        })
      }
    })

    // Puxa snapshot inicial
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', this.room.id)
      .single()
    if (!error && data && typeof this.onRemoteState === 'function') {
      this.onRemoteState({ state: data.state, version: data.version })
    }
  }

  /**
   * Escrita autoritativa com CAS.
   * @param {(prev:any)=>any} produceNext - função que recebe o estado atual e retorna o próximo
   * @param {number} expectedVersion - versão local; se divergir, refaz com a remota
   */
  async commit(produceNext, expectedVersion) {
    // carrega última versão
    const { data: current, error: e1 } = await supabase
      .from('rooms')
      .select('id, state, version')
      .eq('id', this.room.id)
      .single()
    if (e1) throw e1

    const base = current.state || {}
    const mkStateId = () => {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
      } catch {}
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
    const produced = produceNext(base)
    const next = (produced && typeof produced === 'object')
      ? { ...produced, stateId: mkStateId() }
      : { stateId: mkStateId() }

    // tenta CAS
    const { data: updated, error: e2 } = await supabase
      .from('rooms')
      .update({
        state: next,
        version: current.version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.room.id)
      .eq('version', current.version)
      .select()
      .single()

    if (e2) {
      // conflito: alguém escreveu antes de nós; recarrega e tenta 1x
      const { data: cur2, error: e3 } = await supabase
        .from('rooms')
        .select('id, state, version')
        .eq('id', this.room.id)
        .single()
      if (e3) throw e3
      const next2 = produceNext(cur2.state || {})
      const { error: e4 } = await supabase
        .from('rooms')
        .update({
          state: (next2 && typeof next2 === 'object')
            ? { ...next2, stateId: mkStateId() }
            : { stateId: mkStateId() },
          version: cur2.version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.room.id)
        .eq('version', cur2.version)
        .select()
        .single()
      if (e4) throw e4
      return
    }

    this.room = updated
  }

  /**
   * Sinalização opcional (ex.: pedir lock de turno).
   */
  async signal(type, payload) {
    if (!this.channel) return
    await this.channel.send({
      type: 'broadcast',
      event: type,
      payload: { from: this.playerId, ...payload }
    })
  }

  async disconnect() {
    this.closed = true
    if (this.channel) await this.channel.unsubscribe()
  }
}
