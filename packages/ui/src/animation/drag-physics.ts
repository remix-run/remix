interface SpringSettings {
  stiffness?: number
  dampingRatio?: number
}

export function springStep(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  settings: SpringSettings,
): { position: number; velocity: number } {
  let stiffness = settings.stiffness ?? 158
  let damping = 2 * (settings.dampingRatio ?? 1) * Math.sqrt(stiffness)
  velocity += (-stiffness * (position - target) - damping * velocity) * dt
  return { position: position + velocity * dt, velocity }
}

// Integrate in small steps so a dropped frame does not destabilize the spring.
export function frames(update: (dt: number) => boolean) {
  let previous = performance.now()
  let frame = requestAnimationFrame(tick)
  function tick(now: number) {
    let remaining = Math.min((now - previous) / 1000, 0.064)
    previous = now
    let active = true
    while (remaining > 0 && active) {
      let dt = Math.min(remaining, 1 / 240)
      active = update(dt)
      remaining -= dt
    }
    if (active) frame = requestAnimationFrame(tick)
  }
  return {
    stop() {
      cancelAnimationFrame(frame)
    },
    pause() {
      cancelAnimationFrame(frame)
    },
    resume() {
      previous = performance.now()
      frame = requestAnimationFrame(tick)
    },
  }
}
