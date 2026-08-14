import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const hook = readFileSync(join(root, 'src/hooks/useBoardPinchZoom.js'), 'utf8')
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')

test('zoom do tabuleiro é local (transform), não depende só do visualViewport da página', () => {
  assert.match(hook, /boardZoomLayer/)
  assert.match(hook, /sg40GameBoard/)
  assert.match(hook, /scale\(/)
  assert.match(hook, /MAX_SCALE\s*=\s*3/)
  assert.match(hook, /pointer:\s*coarse/)
  assert.match(hook, /preventDefault/)
  assert.match(hook, /phase|active/)
  assert.match(app, /useBoardPinchZoom/)
  assert.match(app, /boardWrapRef/)
  assert.match(app, /phase\s*===\s*['"]game['"]/)
  assert.match(css, /boardWrap--pinch/)
  assert.match(css, /touch-action:\s*none/)
})
