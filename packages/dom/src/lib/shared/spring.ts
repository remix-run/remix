export type SpringPreset = 'smooth' | 'snappy' | 'bouncy'

export interface SpringOptions {
  duration?: number
  bounce?: number
  velocity?: number
}

export interface SpringIterator extends IterableIterator<number> {
  duration: number
  easing: string
  toString(): string
}

let presets: Record<SpringPreset, { duration: number; bounce: number }> = {
  smooth: { duration: 400, bounce: -0.3 },
  snappy: { duration: 200, bounce: 0 },
  bouncy: { duration: 400, bounce: 0.3 },
}

let restSpeed = 0.01
let restDelta = 0.005
let maxSettlingTime = 20_000
let frameMs = 1000 / 60

export function spring(
  preset: SpringPreset,
  overrides?: Omit<SpringOptions, 'bounce'>,
): SpringIterator
export function spring(options?: SpringOptions): SpringIterator
export function spring(
  presetOrOptions?: SpringPreset | SpringOptions,
  overrides?: Omit<SpringOptions, 'bounce'>,
): SpringIterator {
  let options = resolveOptions(presetOrOptions, overrides)
  let { position, settlingTime, easing } = computeSpring(options)
  let duration = Math.round(settlingTime)

  function* generator() {
    let time = 0
    while (time < settlingTime) {
      yield position(time)
      time += frameMs
    }
    yield 1
  }

  let iter = generator()
  Object.defineProperties(iter, {
    duration: { value: duration, enumerable: true },
    easing: { value: easing, enumerable: true },
    toString: {
      value() {
        return `${duration}ms ${easing}`
      },
    },
  })
  return iter as unknown as SpringIterator
}

spring.transition = function transition(
  property: string | string[],
  presetOrOptions?: SpringPreset | SpringOptions,
  overrides?: Omit<SpringOptions, 'bounce'>,
): string {
  let value =
    typeof presetOrOptions === 'string'
      ? spring(presetOrOptions, overrides)
      : spring(presetOrOptions)
  let properties = Array.isArray(property) ? property : [property]
  return properties.map((entry) => `${entry} ${value}`).join(', ')
}

spring.presets = presets

function resolveOptions(
  presetOrOptions?: SpringPreset | SpringOptions,
  overrides?: Omit<SpringOptions, 'bounce'>,
) {
  if (typeof presetOrOptions === 'string') {
    let preset = presets[presetOrOptions]
    return {
      duration: overrides?.duration ?? preset.duration,
      bounce: preset.bounce,
      velocity: overrides?.velocity,
    }
  }
  if (presetOrOptions) return presetOrOptions
  return presets.snappy
}

function computeSpring(options: SpringOptions): {
  position: (time: number) => number
  settlingTime: number
  easing: string
} {
  let { duration: durationMs = 300, bounce = 0, velocity = 0 } = options
  let durationSec = durationMs / 1000
  let omega0 = (2 * Math.PI) / durationSec
  bounce = Math.max(-1, Math.min(0.95, bounce))
  let zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce)
  let omega0Ms = omega0 / 1000
  let velocityMs = -velocity / 1000
  let position: (time: number) => number

  if (zeta < 1) {
    let omegaD = omega0Ms * Math.sqrt(1 - zeta * zeta)
    position = (time) => {
      let envelope = Math.exp(-zeta * omega0Ms * time)
      return (
        1 -
        envelope *
          (((velocityMs + zeta * omega0Ms) / omegaD) * Math.sin(omegaD * time) +
            Math.cos(omegaD * time))
      )
    }
  } else if (zeta > 1) {
    let sqrtTerm = Math.sqrt(zeta * zeta - 1)
    let s1 = omega0Ms * (-zeta + sqrtTerm)
    let s2 = omega0Ms * (-zeta - sqrtTerm)
    let first = (s2 + velocityMs) / (s2 - s1)
    let second = 1 - first
    position = (time) => 1 - first * Math.exp(s1 * time) - second * Math.exp(s2 * time)
  } else {
    position = (time) => 1 - Math.exp(-omega0Ms * time) * (1 + (velocityMs + omega0Ms) * time)
  }

  let velocitySampleMs = 0.5
  function velocityAt(time: number) {
    if (time < velocitySampleMs) {
      return ((position(velocitySampleMs) - position(0)) / velocitySampleMs) * 1000
    }
    return ((position(time) - position(time - velocitySampleMs)) / velocitySampleMs) * 1000
  }

  let settlingTime = maxSettlingTime
  let step = 50
  for (let time = 0; time < maxSettlingTime; time += step) {
    let pos = position(time)
    let vel = Math.abs(velocityAt(time))
    let displacement = Math.abs(1 - pos)
    if (vel <= restSpeed && displacement <= restDelta) {
      settlingTime = time
      break
    }
  }

  let easing = generateEasing(position, settlingTime)
  return { position, settlingTime, easing }
}

function generateEasing(position: (time: number) => number, duration: number) {
  let points = adaptiveSample(position, duration)
  return `linear(${points
    .map((point, index) => {
      let isLast = index === points.length - 1
      let value = isLast ? 1 : Math.round(point.value * 10000) / 10000
      if (index === 0 || isLast) return value === 1 ? '1' : String(value)
      let percent = Math.round((point.time / duration) * 1000) / 10
      return `${value} ${percent}%`
    })
    .join(', ')})`
}

function adaptiveSample(
  resolve: (time: number) => number,
  duration: number,
  tolerance: number = 0.002,
  minSegment: number = 8,
) {
  let points: Array<{ time: number; value: number }> = []

  function addPoint(time: number, value: number) {
    if (points.length === 0 || points[points.length - 1].time < time) {
      points.push({ time, value })
    }
  }

  function subdivide(
    startTime: number,
    startValue: number,
    endTime: number,
    endValue: number,
    depth: number = 0,
  ) {
    if (depth > 12) {
      addPoint(startTime, startValue)
      return
    }
    let midTime = (startTime + endTime) / 2
    let midValue = resolve(midTime)
    let linearValue = (startValue + endValue) / 2
    let error = Math.abs(midValue - linearValue)
    if (error > tolerance && endTime - startTime > minSegment) {
      subdivide(startTime, startValue, midTime, midValue, depth + 1)
      subdivide(midTime, midValue, endTime, endValue, depth + 1)
      return
    }
    addPoint(startTime, startValue)
  }

  subdivide(0, resolve(0), duration, resolve(duration))
  addPoint(duration, resolve(duration))
  return points
}
