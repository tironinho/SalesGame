import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isIOSDevice } from '../../../utils/iosDetect.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')

test('isIOSDevice é false em ambiente Node (sem navigator iOS)', () => {
  assert.equal(isIOSDevice(), false)
})

test('CSS iOS landscape exige html.sg-ios (não altera Android genérico)', () => {
  assert.match(css, /html\.sg-ios/)
  assert.match(css, /--sg-vv-height/)
  // Bloco Android/genérico mobile landscape continua sem exigir sg-ios no seletor principal
  assert.match(
    css,
    /@media \(max-width:\s*960px\) and \(orientation:\s*landscape\) and \(pointer:\s*coarse\) \{/,
  )
  const iosIdx = css.indexOf('html.sg-ios .page')
  assert.ok(iosIdx > 0, 'overrides iOS presentes')
  const iosBlock = css.slice(iosIdx)
  assert.match(iosBlock, /var\(--sg-vv-height/)
  assert.match(iosBlock, /safe-area-inset/)
})
