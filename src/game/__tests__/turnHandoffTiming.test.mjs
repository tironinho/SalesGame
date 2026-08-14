import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const dice = readFileSync(join(root, 'src/components/dice/DiceRollOverlay.jsx'), 'utf8')
const engine = readFileSync(join(root, 'src/game/useTurnEngine.jsx'), 'utf8')

test('dado 3D não ultrapassa ~1.6s (roll+hold+fade)', () => {
  const roll = Number(dice.match(/const ROLL_MS = (\d+)/)?.[1])
  const hold = Number(dice.match(/const HOLD_MS = (\d+)/)?.[1])
  const fade = Number(dice.match(/const FADE_MS = (\d+)/)?.[1])
  assert.ok(roll > 0 && hold > 0 && fade > 0)
  assert.ok(roll + hold + fade <= 1600, `total=${roll + hold + fade}`)
})

test('handoff de turno sem delay fixo de 500ms', () => {
  assert.doesNotMatch(engine, /setTimeout\(checkBeforeTick,\s*500\)/)
  assert.match(engine, /initialDelay/)
  assert.match(engine, /minTimeAfterModalClose = 100/)
})
