import { BOARD_40_TYPE_VISUALS } from '../../data/board40Preview.js'

export const BOARD_PREVIEW_ART_SOURCE = '/76419375-9805-4f12-b48d-cf19f1cb4ac2.png'
/** Centro do tabuleiro: logo Sales GAME */
export const BOARD_PREVIEW_CENTER_SOURCE = '/SalesGame_Logo-removebg-preview.png'

export const BOARD_40_VISUALS = BOARD_40_TYPE_VISUALS

export function isBoardPreviewPresentation(search = '') {
  return new URLSearchParams(search).get('presentation') === '1'
}
