import { createRoot, type Handle } from 'remix/component'

import { dragRelease } from './drag-release.ts'
import { spring, type SpringPreset } from 'remix/component'

interface TrailPoint {
  x: number
  y: number
  time: number
}

function PointerTrail(handle: Handle) {
  let canvas: HTMLCanvasElement
  let points: TrailPoint[] = []
  let isDown = false
  let releaseTime = 0
  let animationId: number | null = null

  let maxAge = 150 // ms - how long points stay in the trail while dragging
  let fadeDuration = 800 // ms - how long the trail fades after release

  function draw() {
    if (!canvas) return
    let ctx = canvas.getContext('2d')
    if (!ctx) return

    let now = performance.now()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate overall opacity based on release time
    let overallOpacity = 1
    if (!isDown && releaseTime > 0) {
      let elapsed = now - releaseTime
      overallOpacity = Math.max(0, 1 - elapsed / fadeDuration)
      if (overallOpacity <= 0) {
        points = []
        animationId = null
        return
      }
    }

    // Filter out old points while dragging
    if (isDown) {
      points = points.filter((p) => now - p.time < maxAge)
    }

    if (points.length < 2) {
      if (isDown || overallOpacity > 0) {
        animationId = requestAnimationFrame(draw)
      } else {
        animationId = null
      }
      return
    }

    // Draw the trail as a tapered path
    ctx.beginPath()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 1; i < points.length; i++) {
      let prev = points[i - 1]
      let curr = points[i]

      // Age-based opacity (older = more transparent)
      let age = isDown ? (now - prev.time) / maxAge : 0
      let segmentOpacity = (1 - age) * overallOpacity

      // Thickness tapers from thin (old) to thick (new)
      let progress = i / (points.length - 1)
      let thickness = 2 + progress * 8

      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(curr.x, curr.y)
      ctx.strokeStyle = `rgba(14, 165, 233, ${segmentOpacity * 0.6})`
      ctx.lineWidth = thickness
      ctx.stroke()
    }

    // Draw a red glow at the end to show direction
    if (points.length > 0) {
      let last = points[points.length - 1]
      let gradient = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 20)
      gradient.addColorStop(0, `rgba(239, 68, 68, ${overallOpacity * 0.6})`)
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(last.x, last.y, 20, 0, Math.PI * 2)
      ctx.fill()
    }

    animationId = requestAnimationFrame(draw)
  }

  function startDrawing() {
    if (!animationId) {
      animationId = requestAnimationFrame(draw)
    }
  }

  handle.on(document, {
    pointerdown(event) {
      if (!(event.target as HTMLElement).closest('.draggable')) return
      isDown = true
      releaseTime = 0
      points = [{ x: event.clientX, y: event.clientY, time: performance.now() }]
      startDrawing()
    },

    pointermove(event) {
      if (!isDown) return
      points.push({ x: event.clientX, y: event.clientY, time: performance.now() })
    },

    pointerup() {
      if (!isDown) return
      isDown = false
      releaseTime = performance.now()
    },

    pointercancel() {
      isDown = false
      releaseTime = performance.now()
    },
  })

  return () => (
    <canvas
      connect={(node) => {
        canvas = node
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }}
      css={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
}

function SpringDemo(handle: Handle) {
  // Target circle position (click to move)
  let targetX = window.innerWidth / 2
  let targetY = window.innerHeight / 2

  // Draggable circle state
  let dragX = window.innerWidth / 2 - 150
  let dragY = window.innerHeight / 2
  let isDragging = false
  let isAnimating = false

  // Current spring transitions (separate for X and Y to capture 2D velocity)
  let transitionX = ''
  let transitionY = ''

  let selectedPreset: SpringPreset = 'bouncy'

  // Get default spring transition for target circle
  let springValue = spring(selectedPreset)

  handle.on(document, {
    click(event) {
      // Ignore clicks on controls or when dragging
      if ((event.target as HTMLElement).closest('.controls')) return
      if ((event.target as HTMLElement).closest('.draggable')) return

      targetX = event.clientX
      targetY = event.clientY
      handle.update()
    },
  })

  return () => (
    <div
      css={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#1a1a2e',
        cursor: 'crosshair',
        overflow: 'hidden',
      }}
    >
      {/* Pointer trail */}
      <PointerTrail />

      {/* Target circle */}
      <div
        css={{
          position: 'absolute',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'transparent',
          border: '3px dashed rgba(233, 69, 96, 0.5)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
        style={{
          left: `${targetX}px`,
          top: `${targetY}px`,
          transition: `left ${springValue}, top ${springValue}`,
        }}
      />

      {/* Draggable circle */}
      <div
        className="draggable"
        css={{
          position: 'absolute',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#0ea5e9',
          boxShadow: '0 0 20px rgba(14, 165, 233, 0.5)',
          transform: 'translate(-50%, -50%)',
          userSelect: 'none',
          touchAction: 'none',
          zIndex: 10,
        }}
        style={{
          left: `${dragX}px`,
          top: `${dragY}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isAnimating ? `left ${transitionX}, top ${transitionY}` : 'none',
        }}
        on={{
          transitionend() {
            isAnimating = false
            handle.update()
          },

          pointerdown(event) {
            event.preventDefault()
            isDragging = true
            isAnimating = false
            handle.update()
          },

          pointermove(event) {
            if (!isDragging) return
            dragX = event.clientX
            dragY = event.clientY
            handle.update()
          },

          [dragRelease](event) {
            isDragging = false

            // Calculate distance to target on each axis
            let distX = targetX - dragX
            let distY = targetY - dragY

            if (Math.abs(distX) < 1 && Math.abs(distY) < 1) {
              handle.update()
              return
            }

            // Create separate springs for X and Y with their own normalized velocities
            // normalizedVelocity = velocity / distance (with sign!) for each axis
            // The sign matters: positive = moving toward target, negative = moving away
            if (Math.abs(distX) >= 1) {
              let normalizedVelocityX = event.velocityX / distX
              normalizedVelocityX = Math.max(-20, Math.min(20, normalizedVelocityX))
              transitionX = String(spring(selectedPreset, { velocity: normalizedVelocityX }))
            } else {
              transitionX = String(spring(selectedPreset))
            }

            if (Math.abs(distY) >= 1) {
              let normalizedVelocityY = event.velocityY / distY
              normalizedVelocityY = Math.max(-20, Math.min(20, normalizedVelocityY))
              transitionY = String(spring(selectedPreset, { velocity: normalizedVelocityY }))
            } else {
              transitionY = String(spring(selectedPreset))
            }

            // Animate to target
            isAnimating = true
            dragX = targetX
            dragY = targetY
            handle.update()
          },
        }}
      />

      {/* Controls */}
      <div
        className="controls"
        css={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '4px',
          padding: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          cursor: 'default',
        }}
      >
        {(Object.keys(spring.presets) as SpringPreset[]).map((preset) => (
          <label
            key={preset}
            css={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
              '&:has(input:checked)': {
                backgroundColor: 'rgba(14, 165, 233, 0.3)',
              },
            }}
          >
            <input
              type="radio"
              name="spring-preset"
              value={preset}
              checked={selectedPreset === preset}
              css={{
                accentColor: '#0ea5e9',
              }}
              on={{
                change() {
                  selectedPreset = preset
                  springValue = spring(selectedPreset)
                  handle.update()
                },
              }}
            />
            {preset}
          </label>
        ))}
      </div>

      {/* Instructions */}
      <div
        css={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#ffffff80',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        Click to move target • Drag the blue circle and release to see velocity-based spring
      </div>
    </div>
  )
}

createRoot(document.body).render(<SpringDemo />)
