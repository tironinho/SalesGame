import test from 'node:test'
import assert from 'node:assert/strict'

import { PREFERRED_LOCK } from '../../../utils/screenOrientation.js'

test('orientação preferida no mobile é landscape (não portrait)', () => {
  assert.equal(PREFERRED_LOCK, 'landscape')
})
