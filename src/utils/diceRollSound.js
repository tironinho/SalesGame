/**
 * Som de dado rolando + impacto final (Web Audio, sem arquivo).
 * Precisa de AudioContext "running" (gesto do usuário) — ver unlockDiceAudio.
 */

let sharedContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!sharedContext || sharedContext.state === 'closed') {
    try {
      sharedContext = new AC()
    } catch {
      return null
    }
  }
  return sharedContext
}

/** Desbloqueia + aquecimento (iOS/Safari). Chamar no clique de “Rolar”. */
export async function unlockDiceAudio() {
  const ctx = getAudioContext()
  if (!ctx) return false
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    // Buffer silencioso: garante que o grafo de áudio “acordou”
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
    return ctx.state === 'running'
  } catch {
    return false
  }
}

function playTick(ctx, time, intensity = 1) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1200 + Math.random() * 1600, time)
  filter.Q.value = 0.9
  osc.type = 'square'
  osc.frequency.setValueAtTime(180 + Math.random() * 220, time)
  const peak = Math.max(0.001, 0.22 * intensity)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + 0.06)
}

function playNoiseBurst(ctx, time, duration = 0.05, intensity = 1) {
  const sampleRate = ctx.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(700 + Math.random() * 900, time)
  filter.Q.value = 0.7
  const gain = ctx.createGain()
  const peak = Math.max(0.001, 0.28 * intensity)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(time)
  src.stop(time + duration + 0.02)
}

/**
 * Cascata audível de “cliques” ao longo de toda a rolagem.
 * Aguarda o contexto estar running (chame unlockDiceAudio antes).
 */
export async function playDiceTumbleSound(durationMs = 1800) {
  const ctx = getAudioContext()
  if (!ctx) return false
  try {
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    return false
  }
  if (ctx.state !== 'running') return false

  const now = ctx.currentTime + 0.02
  const duration = Math.max(0.5, durationMs / 1000)
  const clicks = Math.max(16, Math.floor(duration * 14))

  for (let i = 0; i < clicks; i += 1) {
    const progress = i / (clicks - 1)
    // Espaça no tempo todo da animação, um pouco irregular
    const jitter = (Math.random() - 0.5) * (duration / clicks) * 0.6
    const t = now + progress * duration * 0.92 + jitter
    const intensity = 0.75 + (1 - progress) * 0.55
    playNoiseBurst(ctx, t, 0.035 + Math.random() * 0.025, intensity)
    playTick(ctx, t + 0.001, intensity)
  }

  return true
}

/** Impacto seco quando o dado para. */
export async function playDiceLandSound() {
  const ctx = getAudioContext()
  if (!ctx) return false
  try {
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    return false
  }
  if (ctx.state !== 'running') return false

  const now = ctx.currentTime
  playNoiseBurst(ctx, now, 0.1, 1.6)
  playTick(ctx, now + 0.008, 1.5)

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(120, now)
  osc.frequency.exponentialRampToValueAtTime(48, now + 0.16)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.24)
  return true
}
