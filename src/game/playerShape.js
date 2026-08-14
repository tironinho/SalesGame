/**
 * Canonicaliza aliases do player sem mudar regras de jogo.
 * Mantém campos legados preenchidos a partir da fonte canônica,
 * para o merge/sync e o HUD não divergirem.
 */

function pickFirstDefined(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null) return v
  }
  return undefined
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * @param {object} player
 * @returns {object}
 */
export function normalizePlayerAliases(player) {
  if (!player || typeof player !== 'object') return player

  const gestoresRaw = pickFirstDefined(
    player.gestores,
    player.gestoresComerciais,
    player.managers,
  )
  const gestores = Number(gestoresRaw ?? 0)
  const gestoresSafe = Number.isFinite(gestores) ? gestores : 0

  const trainingsByVendor = asObject(
    pickFirstDefined(player.trainingsByVendor, player.trainingByVendor, {}),
  )

  const erpOwned = asObject(pickFirstDefined(player.erpOwned, player.erp, {}))
  const mixOwned = asObject(pickFirstDefined(player.mixOwned, player.mix, {}))

  return {
    ...player,
    gestores: gestoresSafe,
    gestoresComerciais: gestoresSafe,
    managers: gestoresSafe,
    trainingsByVendor,
    // alias legado mantido sincronizado
    trainingByVendor: trainingsByVendor,
    erpOwned,
    mixOwned,
    // aliases legados de owned maps
    erp: erpOwned,
    mix: mixOwned,
  }
}

export function normalizePlayersAliases(players) {
  if (!Array.isArray(players)) return []
  return players.map((p) => normalizePlayerAliases(p))
}
