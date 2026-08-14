export const BOARD_VISUAL_LAYOUTS = Object.freeze({
  'landscape-13x9': Object.freeze({ columns: 13, rows: 9 }),
  'portrait-8x14': Object.freeze({ columns: 8, rows: 14 }),
})

/** Percurso horário a partir do canto superior esquerdo. */
function clockwisePerimeter(columns, rows) {
  const cells = []
  for (let column = 1; column <= columns; column += 1) {
    cells.push({ row: 1, column })
  }
  for (let row = 2; row <= rows - 1; row += 1) {
    cells.push({ row, column: columns })
  }
  for (let column = columns; column >= 1; column -= 1) {
    cells.push({ row: rows, column })
  }
  for (let row = rows - 1; row >= 2; row -= 1) {
    cells.push({ row, column: 1 })
  }
  return cells
}

function rotateToStart(cells, match) {
  const start = cells.findIndex(match)
  if (start < 0) throw new Error('Perimeter start cell not found')
  return [...cells.slice(start), ...cells.slice(0, start)]
}

/**
 * Casa 01 no canto inferior direito; 02, 03, 04… seguem o perímetro
 * no sentido horário (pela base, da direita para a esquerda).
 */
const PERIMETER_BY_LAYOUT = Object.freeze({
  'landscape-13x9': Object.freeze(
    rotateToStart(
      clockwisePerimeter(13, 9),
      (cell) => cell.row === 9 && cell.column === 13,
    ),
  ),
  'portrait-8x14': Object.freeze(
    rotateToStart(
      clockwisePerimeter(8, 14),
      (cell) => cell.row === 14 && cell.column === 8,
    ),
  ),
})

const validate = (index, layout) => {
  if (!Number.isInteger(index) || index < 0 || index >= 40) {
    throw new RangeError('Board visual index must be an integer from 0 through 39')
  }
  if (!Object.hasOwn(BOARD_VISUAL_LAYOUTS, layout)) {
    throw new RangeError(`Unknown board visual layout: ${layout}`)
  }
}

export function getBoardVisualCoordinate(index, layout = 'landscape-13x9') {
  validate(index, layout)
  return PERIMETER_BY_LAYOUT[layout][index]
}
