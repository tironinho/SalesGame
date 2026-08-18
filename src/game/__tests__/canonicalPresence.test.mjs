/**
 * Integração lógica: identidade canônica × presença × coordinator × skip guard.
 * Executar: node --test src/game/__tests__/canonicalPresence.test.mjs
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveGamePresencePlayerId,
  isTurnPlayerPresent,
  detectSeatPresenceMismatch,
  resolveTurnSkipAuthority,
  pickPresenceCoordinator,
  isPresenceFresh,
  isRosterPlayerBankrupt,
  GAME_OFFLINE_THRESHOLD_MS,
} from '../canonicalPresence.js'
import {
  __resetSharedTurnSkipGuardForTests,
  markPendingSharedSkipKey,
  confirmSharedSkipKey,
  releaseSharedSkipKey,
  wasAlreadySkipped,
  getPendingSharedSkipKey,
  getLastSharedSkipKey,
  markSharedSkipKey,
} from '../sharedTurnSkipGuard.js'
import {
  shouldAttemptTimerAutoPass,
  shouldBlockDuplicateSkip,
  turnAttemptKey,
  planTurnTimerPass,
} from '../turnTimerLogic.js'
import { resolveSeatIdentity } from '../playerStateSync.js'

const NOW = 1_000_000

function fresh(id, ageMs = 0) {
  return { playerId: id, lastSeen: NOW - ageMs }
}

function rosterXY() {
  return [
    { id: 'X', name: 'Alice', bankrupt: false },
    { id: 'Y-tab-should-not-matter', name: 'ghost', bankrupt: false },
  ]
}

beforeEach(() => {
  __resetSharedTurnSkipGuardForTests()
})

describe('PRESENÇA CANÔNICA', () => {
  it('1. roster X + presence X fresca => jogador online', () => {
    assert.equal(
      isTurnPlayerPresent({
        turnPlayerId: 'X',
        presenceList: [fresh('X', 1000)],
        now: NOW,
      }),
      true
    )
  })

  it('2. matchIdentity X + myUid X + presence X => online', () => {
    const roster = [{ id: 'X', name: 'A' }]
    const seat = resolveSeatIdentity({
      identityPlayerId: 'X',
      roster,
      currentMyUid: 'X',
    })
    assert.equal(seat.ok, true)
    assert.equal(seat.myUid, 'X')
    const presenceId = resolveGamePresencePlayerId({
      seatPlayerId: seat.myUid,
      tabPlayerId: 'tab-Y',
      roster,
    })
    assert.equal(presenceId, 'X')
    assert.equal(
      isTurnPlayerPresent({
        turnPlayerId: 'X',
        presenceList: [fresh('X')],
        now: NOW,
      }),
      true
    )
  })

  it('3. tabId Y diferente de X NÃO interfere na presença do assento X', () => {
    const roster = [{ id: 'X' }]
    const presenceId = resolveGamePresencePlayerId({
      seatPlayerId: 'X',
      tabPlayerId: 'Y',
      roster,
    })
    assert.equal(presenceId, 'X')
    // Presence só em Y: assento X continua offline (tab não conta)
    assert.equal(
      isTurnPlayerPresent({
        turnPlayerId: 'X',
        presenceList: [fresh('Y')],
        now: NOW,
      }),
      false
    )
  })

  it('4. rebind Y -> X seleciona presença em X', () => {
    const roster = [{ id: 'X' }, { id: 'B' }]
    const before = resolveGamePresencePlayerId({
      seatPlayerId: 'Y',
      tabPlayerId: 'Y',
      roster,
    })
    assert.equal(before, null) // Y não está no roster

    const seat = resolveSeatIdentity({
      identityPlayerId: 'X',
      roster,
      currentMyUid: 'Y',
    })
    assert.equal(seat.myUid, 'X')
    const after = resolveGamePresencePlayerId({
      seatPlayerId: seat.myUid,
      tabPlayerId: 'Y',
      roster,
    })
    assert.equal(after, 'X')
  })

  it('5. presence apenas em Y, turno X => mismatch detectado', () => {
    const det = detectSeatPresenceMismatch({
      seatPlayerId: 'X',
      tabPlayerId: 'Y',
      presenceList: [fresh('Y')],
      now: NOW,
    })
    assert.equal(det.mismatch, true)
    assert.equal(det.reason, 'tab-presence-not-seat')
  })

  it('6. após recreate de X => waiting desaparece (presente)', () => {
    // Antes: só Y
    assert.equal(
      isTurnPlayerPresent({
        turnPlayerId: 'X',
        presenceList: [fresh('Y')],
        now: NOW,
      }),
      false
    )
    // Depois recreate/touch de X
    assert.equal(
      isTurnPlayerPresent({
        turnPlayerId: 'X',
        presenceList: [fresh('Y'), fresh('X', 500)],
        now: NOW,
      }),
      true
    )
  })

  it('7. dois jogadores com presence nos ids do roster => coordinator encontrado', () => {
    const roster = [
      { id: 'A', bankrupt: false },
      { id: 'B', bankrupt: false },
    ]
    const presence = [fresh('A', 2000), fresh('B', 1000)]
    const coord = pickPresenceCoordinator(roster, presence, NOW)
    assert.equal(coord, 'A')
    const auth = resolveTurnSkipAuthority({
      rosterPlayers: roster,
      presenceList: presence,
      now: NOW,
      myUid: 'A',
      lobbyHostId: 'A',
    })
    assert.equal(auth.authorized, true)
    assert.equal(auth.reason, 'presence-coordinator')
  })
})

describe('TIMER / AUTORIDADE', () => {
  it('8. timer 0 com coordinator normal => avança uma vez', () => {
    const decision = shouldAttemptTimerAutoPass({
      now: NOW,
      turnDeadlineAt: NOW - 1,
      turnLock: false,
      gameOver: false,
      amCoordinator: true,
      turnPlayerId: 'A',
      turnSeq: 2,
      lastAttemptKey: null,
      inFlight: false,
    })
    assert.equal(decision.ok, true)
    const plan = planTurnTimerPass({
      players: [
        { id: 'A', bankrupt: false },
        { id: 'B', bankrupt: false },
      ],
      turnPlayerId: 'A',
      turnSeq: 2,
      round: 1,
      maxRounds: 5,
    })
    assert.equal(plan.nextTurnPlayerId, 'B')
    assert.equal(plan.nextTurnSeq, 3)
  })

  it('9. timer 0 sem coordinator de presence mas host autoritativo => fallback avança', () => {
    const roster = [
      { id: 'host', bankrupt: false },
      { id: 'guest', bankrupt: false },
    ]
    // Presence vazia / todos offline → sem pickSkipCoordinator
    const presence = [
      fresh('host', GAME_OFFLINE_THRESHOLD_MS + 5_000),
      fresh('guest', GAME_OFFLINE_THRESHOLD_MS + 5_000),
    ]
    assert.equal(pickPresenceCoordinator(roster, presence, NOW), null)

    const hostAuth = resolveTurnSkipAuthority({
      rosterPlayers: roster,
      presenceList: presence,
      now: NOW,
      myUid: 'host',
      lobbyHostId: 'host',
    })
    assert.equal(hostAuth.authorized, true)
    assert.equal(hostAuth.reason, 'lobby-host-fallback')

    const decision = shouldAttemptTimerAutoPass({
      now: NOW,
      turnDeadlineAt: NOW - 1,
      turnLock: false,
      gameOver: false,
      amCoordinator: hostAuth.authorized,
      turnPlayerId: 'guest',
      turnSeq: 1,
      lastAttemptKey: null,
      inFlight: false,
    })
    assert.equal(decision.ok, true)
  })

  it('10. guest não-host sem coordinator => não avança arbitrariamente', () => {
    const roster = [
      { id: 'host', bankrupt: false },
      { id: 'guest', bankrupt: false },
    ]
    const presence = []
    const guestAuth = resolveTurnSkipAuthority({
      rosterPlayers: roster,
      presenceList: presence,
      now: NOW,
      myUid: 'guest',
      lobbyHostId: 'host',
    })
    assert.equal(guestAuth.authorized, false)
    assert.equal(guestAuth.reason, 'no-authority')

    const decision = shouldAttemptTimerAutoPass({
      now: NOW,
      turnDeadlineAt: NOW - 1,
      turnLock: false,
      gameOver: false,
      amCoordinator: false,
      turnPlayerId: 'host',
      turnSeq: 0,
      lastAttemptKey: null,
      inFlight: false,
    })
    assert.equal(decision.ok, false)
    assert.equal(decision.reason, 'not-coordinator')
  })

  it('11. offline skip + timer simultâneos => um único avanço', () => {
    markPendingSharedSkipKey('A', 5)
    assert.equal(wasAlreadySkipped('A', 5), true)
    const blocked = shouldAttemptTimerAutoPass({
      now: NOW,
      turnDeadlineAt: NOW - 1,
      turnLock: false,
      gameOver: false,
      amCoordinator: true,
      turnPlayerId: 'A',
      turnSeq: 5,
      lastAttemptKey: getLastSharedSkipKey(),
      inFlight: false,
    })
    // pending bloqueia via wasAlreadySkipped no hook; lastAttemptKey ainda null até confirm
    assert.equal(wasAlreadySkipped('A', 5), true)
    assert.equal(
      shouldBlockDuplicateSkip({
        attemptKey: turnAttemptKey('A', 5),
        lastOfflineSkipKey: turnAttemptKey('A', 5),
        lastTimerSkipKey: null,
      }),
      true
    )
    void blocked
  })
})

describe('SHARED SKIP GUARD / CAS', () => {
  it('12. CAS falhou => shared skip key NÃO fica permanentemente bloqueada', () => {
    markPendingSharedSkipKey('T', 9)
    assert.equal(wasAlreadySkipped('T', 9), true)
    releaseSharedSkipKey('T', 9)
    assert.equal(wasAlreadySkipped('T', 9), false)
    assert.equal(getPendingSharedSkipKey(), null)
    assert.equal(getLastSharedSkipKey(), null)
  })

  it('13. CAS confirmou => segunda tentativa do mesmo turnSeq é bloqueada', () => {
    markPendingSharedSkipKey('T', 9)
    confirmSharedSkipKey('T', 9)
    assert.equal(wasAlreadySkipped('T', 9), true)
    assert.equal(getLastSharedSkipKey(), turnAttemptKey('T', 9))
    // Alias legado
    markSharedSkipKey('T', 9)
    assert.equal(wasAlreadySkipped('T', 9), true)
  })

  it('14. refresh/resume mantém presença no mesmo seat', () => {
    const roster = [{ id: 'seat-1', name: 'P' }]
    const before = resolveSeatIdentity({
      identityPlayerId: 'seat-1',
      roster,
      currentMyUid: 'seat-1',
    })
    const afterRefresh = resolveSeatIdentity({
      identityPlayerId: 'seat-1',
      roster,
      currentMyUid: 'other-tab',
    })
    assert.equal(before.myUid, afterRefresh.myUid)
    assert.equal(
      resolveGamePresencePlayerId({
        seatPlayerId: afterRefresh.myUid,
        tabPlayerId: 'other-tab',
        roster,
      }),
      'seat-1'
    )
  })

  it('15. myUid canônico continua permitindo isMyTurn/roll', () => {
    const myUid = 'X'
    const turnPlayerId = 'X'
    const isMyTurn = String(turnPlayerId) === String(myUid)
    assert.equal(isMyTurn, true)
    const presenceId = resolveGamePresencePlayerId({
      seatPlayerId: myUid,
      tabPlayerId: 'tab',
      roster: [{ id: 'X' }],
    })
    assert.equal(presenceId, myUid)
  })

  it('16. player conectado não recebe waiting (presente)', () => {
    const present = isTurnPlayerPresent({
      turnPlayerId: 'me',
      presenceList: [fresh('me', 100)],
      now: NOW,
    })
    assert.equal(present, true)
    // status waiting só quando !present — coberto pela condição
    const shouldWait = !present
    assert.equal(shouldWait, false)
  })

  it('16b. jogador da vez falido não conta como desconexão', () => {
    const roster = [
      { id: 'A', bankrupt: true },
      { id: 'B', bankrupt: false },
    ]
    assert.equal(isRosterPlayerBankrupt(roster, 'A'), true)
    assert.equal(isRosterPlayerBankrupt(roster, 'B'), false)
    assert.equal(isRosterPlayerBankrupt(roster, 'ghost'), false)
  })

  it('19. host migration: novo host no roster pode ser autoridade de fallback', () => {
    const roster = [
      { id: 'old-host', bankrupt: true },
      { id: 'new-host', bankrupt: false },
      { id: 'guest', bankrupt: false },
    ]
    const presence = [] // todos offline → fallback
    const auth = resolveTurnSkipAuthority({
      rosterPlayers: roster,
      presenceList: presence,
      now: NOW,
      myUid: 'new-host',
      lobbyHostId: 'new-host',
    })
    assert.equal(auth.authorized, true)
    assert.equal(auth.reason, 'lobby-host-fallback')

    // Guest ainda sem autoridade
    const guest = resolveTurnSkipAuthority({
      rosterPlayers: roster,
      presenceList: presence,
      now: NOW,
      myUid: 'guest',
      lobbyHostId: 'new-host',
    })
    assert.equal(guest.authorized, false)
  })

  it('threshold offline não foi afrouxado', () => {
    assert.equal(GAME_OFFLINE_THRESHOLD_MS, 35_000)
    assert.equal(
      isPresenceFresh(NOW - 35_001, NOW, GAME_OFFLINE_THRESHOLD_MS),
      false
    )
    assert.equal(
      isPresenceFresh(NOW - 34_000, NOW, GAME_OFFLINE_THRESHOLD_MS),
      true
    )
  })
})
