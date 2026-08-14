import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Espelha o mapeamento de createDiceMesh.eulerForResultFace (sem Three no Node).
 */
function eulerTupleForFace(result) {
  const face = Math.min(6, Math.max(1, Number(result) || 1))
  switch (face) {
    case 1: return [Math.PI / 2, 0, 0]
    case 2: return [0, 0, 0]
    case 3: return [0, -Math.PI / 2, 0]
    case 4: return [0, Math.PI / 2, 0]
    case 5: return [0, Math.PI, 0]
    case 6: return [-Math.PI / 2, 0, 0]
    default: return [0, 0, 0]
  }
}

test('faces 1–6 têm orientação final distinta para a câmera', () => {
  const seen = new Set()
  for (let face = 1; face <= 6; face += 1) {
    const tuple = eulerTupleForFace(face).map((n) => n.toFixed(4)).join(',')
    assert.equal(seen.has(tuple), false)
    seen.add(tuple)
  }
  assert.equal(seen.size, 6)
})
