// src/lib/uuid.js
// Utilitário compartilhado de UUID.
// Motivo: crypto.randomUUID só existe em contexto seguro (HTTPS/localhost).
// Em acesso HTTP pela rede local, o fallback antigo gerava "timestamp-texto",
// que o Postgres rejeita em colunas uuid. Aqui o fallback continua sendo um
// UUID v4 canônico, gerado com crypto.getRandomValues (disponível em HTTP).

// Formato canônico 8-4-4-4-12 (case-insensitive). Não restringe a versão:
// um UUID válido de outra versão não deve ser descartado.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function createUuidV4() {
  const c = globalThis.crypto

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }

  let bytes
  if (c && typeof c.getRandomValues === 'function') {
    bytes = c.getRandomValues(new Uint8Array(16))
  } else {
    // Último recurso (sem crypto algum): ainda assim gera v4 canônico.
    bytes = new Uint8Array(16)
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versão 4 (nibble alto do byte 6)
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122 (bits altos do byte 8)

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
