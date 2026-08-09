// Overlays de preço das casas ERP/SISTEMAS no Board clássico.
// Coordenadas em % relativas ao board 2048×2048 (e ao container stretch com object-fit: fill).
// Cobrem só a lista de preços; o título "ERP/SISTEMAS" permanece na arte.

import { ERP_RULES } from '../game/gameRules.js'

/** Caixas percentuais das 4 casas ERP (houses 6, 16, 32, 49). */
export const ERP_BOARD_PRICE_OVERLAYS = [
  { house: 6, left: 31.89, top: 90.47, width: 11.02, height: 4.0 },
  { house: 16, left: 21.14, top: 10.68, width: 10.7, height: 4.47 },
  { house: 32, left: 46.21, top: 35.51, width: 11.43, height: 4.3 },
  { house: 49, left: 86.7, top: 10.74, width: 9.95, height: 5.13 },
]

/** Formata preço no estilo do board ($2.500). */
export function formatErpBoardPrice(price) {
  return `$${Number(price || 0).toLocaleString('pt-BR')}`
}

/** Linhas de preço A→D a partir de ERP_RULES (fonte única). */
export function getErpBoardPriceLines() {
  return ['A', 'B', 'C', 'D'].map(
    (level) => `NÍVEL ${level}: ${formatErpBoardPrice(ERP_RULES[level].price)}`
  )
}
