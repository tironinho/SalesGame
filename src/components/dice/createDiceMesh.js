import * as THREE from 'three'

const PIP_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
}

function createFaceTexture(value) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#fffdf8')
  gradient.addColorStop(1, '#e8e2d8')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  // Borda suave
  ctx.strokeStyle = 'rgba(20, 24, 36, 0.18)'
  ctx.lineWidth = 10
  ctx.strokeRect(8, 8, size - 16, size - 16)

  ctx.fillStyle = '#1a1f2e'
  const pips = PIP_LAYOUT[value] || PIP_LAYOUT[1]
  const radius = value === 1 ? 28 : 22
  for (const [nx, ny] of pips) {
    ctx.beginPath()
    ctx.arc(nx * size, ny * size, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.arc(nx * size - 6, ny * size - 6, radius * 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1f2e'
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/**
 * Materiais do BoxGeometry: [+X, -X, +Y, -Y, +Z, -Z] = [3, 4, 1, 6, 2, 5]
 */
export function createDiceMaterials() {
  const faces = [3, 4, 1, 6, 2, 5]
  return faces.map((value) => new THREE.MeshStandardMaterial({
    map: createFaceTexture(value),
    roughness: 0.42,
    metalness: 0.05,
  }))
}

/**
 * Euler final para a face `result` olhar para a câmera (+Z).
 */
export function eulerForResultFace(result) {
  const face = Math.min(6, Math.max(1, Number(result) || 1))
  switch (face) {
    case 1: return new THREE.Euler(Math.PI / 2, 0, 0)
    case 2: return new THREE.Euler(0, 0, 0)
    case 3: return new THREE.Euler(0, -Math.PI / 2, 0)
    case 4: return new THREE.Euler(0, Math.PI / 2, 0)
    case 5: return new THREE.Euler(0, Math.PI, 0)
    case 6: return new THREE.Euler(-Math.PI / 2, 0, 0)
    default: return new THREE.Euler(0, 0, 0)
  }
}

export function createDiceMesh() {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2)
  const materials = createDiceMaterials()
  const mesh = new THREE.Mesh(geometry, materials)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}
