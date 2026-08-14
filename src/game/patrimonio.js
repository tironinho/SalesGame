/**
 * Patrimônio usado no ranking/fim de partida.
 * Falido = 0; senão Caixa + Bens.
 * Fonte única para UI/pódio e motor de fim de jogo.
 */
export function computePatrimonio(player) {
  if (player?.bankrupt) return 0
  const cash = Number(player?.cash || 0)
  const bens = Number(player?.bens || 0)
  return cash + bens
}

/**
 * Ordena jogadores para o pódio / campeão.
 * 1) não falidos antes
 * 2) maior patrimônio (Caixa + Bens)
 * 3) desempate: maior caixa
 * 4) desempate: nome (A→Z)
 */
export function rankPlayersByPatrimonio(players = []) {
  return [...(players || [])]
    .map((player) => {
      const isBankrupt = !!player?.bankrupt
      const cash = Number(player?.cash || 0)
      const bens = Number(player?.bens || 0)
      return {
        ...player,
        cash,
        bens,
        patrimonio: computePatrimonio(player),
        isBankrupt,
      }
    })
    .sort((a, b) => {
      if (a.isBankrupt !== b.isBankrupt) return a.isBankrupt ? 1 : -1
      if (b.patrimonio !== a.patrimonio) return b.patrimonio - a.patrimonio
      if (b.cash !== a.cash) return b.cash - a.cash
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
}

/** Campeão (1º não falido), ou null se ninguém estiver ativo. */
export function pickWinnerByPatrimonio(players = []) {
  const ranked = rankPlayersByPatrimonio(players)
  const champ = ranked.find((p) => !p.isBankrupt) || null
  return champ
}
