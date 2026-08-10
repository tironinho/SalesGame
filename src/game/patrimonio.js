/**
 * Patrimônio usado no ranking/fim de partida.
 * Falido = 0; senão Caixa + Bens.
 * Não altera regra — única fonte de cálculo para UI/pódio.
 */
export function computePatrimonio(player) {
  if (player?.bankrupt) return 0
  const cash = Number(player?.cash || 0)
  const bens = Number(player?.bens || 0)
  return cash + bens
}
