import './diceRollOverlay.css'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import { createDiceMesh, eulerForResultFace } from './createDiceMesh.js'
import {
  playDiceLandSound,
  playDiceTumbleSound,
  unlockDiceAudio,
} from '../../utils/diceRollSound.js'

const ROLL_MS = 1800
const HOLD_MS = 750
const FADE_MS = 320

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

/**
 * Overlay 3D do dado no tabuleiro.
 * `result` é a face final (1–6) — não sorteia de novo.
 */
export default function DiceRollOverlay({
  open = false,
  result = 1,
  playerName = '',
  onComplete,
}) {
  const hostRef = useRef(null)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!open) return undefined
    completedRef.current = false

    const host = hostRef.current
    if (!host) return undefined

    const finish = () => {
      if (completedRef.current) return
      completedRef.current = true
      onCompleteRef.current?.()
    }

    if (prefersReducedMotion()) {
      const t = setTimeout(finish, 80)
      return () => clearTimeout(t)
    }

    unlockDiceAudio().catch(() => {})

    const width = Math.max(160, host.clientWidth || 320)
    const height = Math.max(120, host.clientHeight || 240)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40)
    camera.position.set(0, 1.45, 4.35)
    camera.lookAt(0, 0.1, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)
    renderer.domElement.style.opacity = '1'
    host.style.setProperty('--dice-overlay-opacity', '1')

    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(2.8, 5.2, 3.2)
    const fill = new THREE.DirectionalLight(0x9ec5ff, 0.4)
    fill.position.set(-3.2, 1.4, 2.2)
    scene.add(ambient, key, fill)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.52
    scene.add(ground)

    const dice = createDiceMesh()
    scene.add(dice)

    const finalEuler = eulerForResultFace(result)
    const finalQuat = new THREE.Quaternion().setFromEuler(finalEuler)
    const startQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ))

    const spinAxis = new THREE.Vector3(
      0.35 + Math.random() * 0.65,
      0.55 + Math.random() * 0.6,
      0.2 + Math.random() * 0.55,
    ).normalize()
    const totalSpin = Math.PI * (11 + Math.random() * 3)

    const tumbleQuat = new THREE.Quaternion()
    const workQuat = new THREE.Quaternion()

    const start = performance.now()
    let landPlayed = false
    playDiceTumbleSound(ROLL_MS)

    let raf = 0

    const animate = (now) => {
      const elapsed = now - start
      const rollT = Math.min(1, elapsed / ROLL_MS)

      if (rollT < 1) {
        const ease = 1 - (1 - rollT) ** 2.2
        tumbleQuat.setFromAxisAngle(spinAxis, ease * totalSpin)
        workQuat.copy(startQuat).multiply(tumbleQuat)

        if (rollT > 0.62) {
          const settle = (rollT - 0.62) / 0.38
          const s = settle * settle * (3 - 2 * settle)
          workQuat.slerp(finalQuat, s)
        }

        dice.quaternion.copy(workQuat)
        const bounce = Math.abs(Math.sin(rollT * Math.PI * 5.2)) * (1 - rollT) * 0.5
        dice.position.set(
          Math.sin(rollT * Math.PI * 2.8) * 0.32 * (1 - ease),
          0.12 + bounce + (1 - ease) * 0.85,
          Math.cos(rollT * Math.PI * 2.1) * 0.18 * (1 - ease),
        )
        dice.scale.setScalar(0.82 + ease * 0.23)
      } else {
        dice.quaternion.copy(finalQuat)
        dice.position.set(0, 0.12, 0)
        dice.scale.setScalar(1.06)
        if (!landPlayed) {
          landPlayed = true
          playDiceLandSound()
        }
      }

      renderer.render(scene, camera)

      if (elapsed < ROLL_MS + HOLD_MS) {
        raf = requestAnimationFrame(animate)
      } else if (elapsed < ROLL_MS + HOLD_MS + FADE_MS) {
        const fade = 1 - (elapsed - ROLL_MS - HOLD_MS) / FADE_MS
        const opacity = Math.max(0, fade)
        renderer.domElement.style.opacity = String(opacity)
        host.style.setProperty('--dice-overlay-opacity', String(opacity))
        raf = requestAnimationFrame(animate)
      } else {
        finish()
      }
    }

    raf = requestAnimationFrame(animate)

    const onResize = () => {
      const w = Math.max(160, host.clientWidth || 320)
      const h = Math.max(120, host.clientHeight || 240)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      dice.geometry.dispose()
      if (Array.isArray(dice.material)) {
        dice.material.forEach((m) => {
          m.map?.dispose()
          m.dispose()
        })
      }
      ground.geometry.dispose()
      ground.material.dispose()
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement)
      }
    }
  }, [open, result])

  if (!open) return null

  return (
    <div
      className="diceRollOverlay"
      role="status"
      aria-live="polite"
      aria-label={playerName ? `${playerName} rolando o dado` : 'Rolando o dado'}
    >
      <div className="diceRollOverlay__stage" ref={hostRef} />
      <p className="diceRollOverlay__caption">
        {playerName ? `${playerName} rolou…` : 'Rolando o dado…'}
      </p>
    </div>
  )
}
