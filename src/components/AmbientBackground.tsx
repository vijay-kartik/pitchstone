'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Subtle WebGL ambient layer: faint violet particles drifting behind the app,
// with a very faint slowly-rotating shard for depth. Pauses when the tab is
// hidden and renders a single static frame when reduced motion is requested.
export default function AmbientBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth <= 640

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 30

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    // Soft circular glow sprite for particles
    const sprite = makeGlowSprite()

    const COUNT = isMobile ? 60 : 150
    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 72
      positions[i * 3 + 1] = (Math.random() - 0.5) * 52
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40
      speeds[i] = 0.2 + Math.random() * 0.6
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      size: 1.7,
      map: sprite,
      color: new THREE.Color('#8d6bff'),
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // Faint elongated shard far behind, echoing the pitchstone monolith
    const shardGeo = new THREE.OctahedronGeometry(11, 0)
    shardGeo.scale(0.55, 1.5, 0.55)
    const shardMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#5a47a8'),
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    })
    const shard = new THREE.Mesh(shardGeo, shardMat)
    shard.position.set(2, 0, -16)
    scene.add(shard)

    let elapsed = 0
    let last = performance.now()
    let raf = 0

    const renderFrame = () => renderer.render(scene, camera)

    const animate = () => {
      const now = performance.now()
      elapsed += (now - last) / 1000
      last = now
      const t = elapsed
      const pos = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < COUNT; i++) {
        let y = pos.getY(i) + speeds[i] * 0.02
        if (y > 27) y = -27
        pos.setY(i, y)
      }
      pos.needsUpdate = true
      points.rotation.y = t * 0.02
      shard.rotation.y = t * 0.05
      shard.rotation.x = Math.sin(t * 0.1) * 0.15
      renderFrame()
      raf = requestAnimationFrame(animate)
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0 }
      } else if (!reduce && !raf) {
        last = performance.now()
        animate()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    if (reduce) renderFrame()
    else animate()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      geo.dispose()
      mat.dispose()
      shardGeo.dispose()
      shardMat.dispose()
      sprite.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}

function makeGlowSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(206,180,255,0.9)')
  g.addColorStop(1, 'rgba(141,107,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
