import test from 'node:test'
import assert from 'node:assert/strict'

import {
  playTokenHopSound,
  unlockTokenHopAudio,
} from '../../../utils/tokenHopSound.js'

test('som de pulo é seguro sem window (não lança)', async () => {
  assert.equal(playTokenHopSound(), false)
  assert.equal(await unlockTokenHopAudio(), false)
  assert.equal(playTokenHopSound({ muted: true }), false)
})
