import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { springStep } from './drag-physics.ts'

function simulate(
  settings: Parameters<typeof springStep>[4],
  duration: number,
  initialVelocity = 0,
) {
  let state = { position: 100, velocity: initialVelocity }
  let positions: number[] = []
  let steps = Math.round(duration * 240)
  for (let index = 0; index < steps; index++) {
    state = springStep(state.position, state.velocity, 0, 1 / 240, settings)
    positions.push(state.position)
  }
  return { ...state, positions }
}

describe('Drag return spring', () => {
  it('settles without crossing the target at critical damping from rest', () => {
    let state = simulate({ stiffness: 100, dampingRatio: 1 }, 2)
    assert.ok(state.positions.every((position) => position >= 0))
    assert.ok(state.position < 0.01)
    assert.ok(Math.abs(state.velocity) < 0.1)
  })

  it('retains critical damping when stiffness increases', () => {
    let softer = simulate({ stiffness: 100, dampingRatio: 1 }, 0.2)
    let stiffer = simulate({ stiffness: 400, dampingRatio: 1 }, 0.1)
    assert.ok(stiffer.positions.every((position) => position >= 0))
    assert.ok(Math.abs(softer.position - stiffer.position) < 2)
    // The critical spring's exact position from rest is x(t) = x(0) * (1 + wt) * exp(-wt).
    assert.ok(Math.abs(softer.position - 300 * Math.exp(-2)) < 2)
  })

  it('oscillates below critical damping and settles more gradually above it', () => {
    let bouncy = simulate({ stiffness: 100, dampingRatio: 0.3 }, 0.5)
    let critical = simulate({ stiffness: 100, dampingRatio: 1 }, 0.5)
    let overdamped = simulate({ stiffness: 100, dampingRatio: 2 }, 0.5)
    assert.ok(bouncy.positions.some((position) => position < 0))
    assert.ok(overdamped.positions.every((position) => position >= 0))
    assert.ok(overdamped.position > critical.position)
  })

  it('keeps oscillating when damping is zero', () => {
    let state = simulate({ stiffness: 100, dampingRatio: 0 }, (2 * Math.PI) / 10)
    assert.ok(state.positions.some((position) => position < -95))
    assert.ok(state.position > 95)
  })

  it('preserves incoming velocity even when it carries a critical spring across the target', () => {
    let state = simulate({ stiffness: 100, dampingRatio: 1 }, 0.2, -2000)
    assert.ok(state.positions.some((position) => position < 0))
  })

  it('returns without oscillation with the default spring', () => {
    let state = simulate({}, 0.6)
    let configured = simulate({ stiffness: 158, dampingRatio: 1 }, 0.6)
    assert.deepEqual(state, configured)
    assert.ok(state.positions.every((position) => position >= 0))
    assert.ok(state.position < 1)
  })
})
