// src/utils/playerEmojis.js
// Utilitário para garantir design consistente dos peões em todas as telas

/**
 * Array de emojis de pessoinhas para os jogadores
 * Garante que todos os jogadores tenham o mesmo design em todas as telas
 */
export const PLAYER_EMOJIS = [
  '👤', // Pessoa genérica
  '👥', // Duas pessoas
  '👨', // Homem
  '👩', // Mulher
  '🧑', // Pessoa neutra
  '👦', // Menino
  '👧', // Menina
  '👶', // Bebê
]

/**
 * Obtém o emoji do jogador baseado no índice
 * @param {number} playerIndex - Índice do jogador (0, 1, 2, etc.)
 * @returns {string} Emoji do jogador
 */
export function getPlayerEmoji(playerIndex) {
  return PLAYER_EMOJIS[playerIndex % PLAYER_EMOJIS.length]
}

/**
 * Obtém o emoji do jogador da vez (com estrela)
 * @param {number} playerIndex - Índice do jogador
 * @param {boolean} isTurn - Se é a vez do jogador
 * @returns {string} Emoji do jogador (com estrela se for a vez)
 */
export function getPlayerEmojiWithTurn(playerIndex, isTurn) {
  const baseEmoji = getPlayerEmoji(playerIndex)
  return isTurn ? '⭐' : baseEmoji
}

/**
 * Obtém o emoji do jogador baseado no ID do jogador
 * @param {string} playerId - ID único do jogador
 * @param {Array} players - Array de jogadores
 * @returns {string} Emoji do jogador
 */
export function getPlayerEmojiById(playerId, players) {
  const playerIndex = players.findIndex(p => p.id === playerId)
  return playerIndex >= 0 ? getPlayerEmoji(playerIndex) : '👤'
}

/**
 * Obtém o emoji do jogador baseado no ID com indicação de turno
 * @param {string} playerId - ID único do jogador
 * @param {Array} players - Array de jogadores
 * @param {number} turnIdx - Índice do jogador da vez
 * @returns {string} Emoji do jogador (com estrela se for a vez)
 */
export function getPlayerEmojiByIdWithTurn(playerId, players, turnIdx) {
  const playerIndex = players.findIndex(p => p.id === playerId)
  const isTurn = playerIndex === turnIdx
  return playerIndex >= 0 ? getPlayerEmojiWithTurn(playerIndex, isTurn) : '👤'
}
