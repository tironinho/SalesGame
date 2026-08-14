import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
const hook = readFileSync(join(root, 'src/hooks/useMobilePinchZoom.js'), 'utf8')

test('viewport permite pinch-zoom (user-scalable + maximum-scale > 1)', () => {
  assert.match(indexHtml, /user-scalable=yes/)
  assert.match(indexHtml, /maximum-scale=5/)
  assert.doesNotMatch(indexHtml, /user-scalable=no/)
  assert.doesNotMatch(indexHtml, /maximum-scale=1(?:\.0)?(?:\s|,|$)/)
})

test('CSS de zoom mobile só sob pointer coarse / sg-zoomed', () => {
  assert.match(css, /html\.sg-zoomed/)
  assert.match(css, /html\.sg-pinch-enabled/)
  assert.match(hook, /sg-zoomed/)
  assert.match(hook, /visualViewport/)
})
