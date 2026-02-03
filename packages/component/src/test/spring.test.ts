import { describe, it, expect } from 'vitest'

import { spring } from '../lib/spring.ts'

describe('spring', () => {
  describe('interface', () => {
    it('returns an iterator', () => {
      let s = spring()
      expect(typeof s.next).toBe('function')

      let result = s.next()
      expect(result).toHaveProperty('value')
      expect(result).toHaveProperty('done')
    })

    it('has duration property', () => {
      let s = spring()
      expect(typeof s.duration).toBe('number')
      expect(s.duration).toBeGreaterThan(0)
      expect(s.duration).toBeLessThan(20000)
    })

    it('has easing property', () => {
      let s = spring()
      expect(typeof s.easing).toBe('string')
      expect(s.easing).toMatch(/^linear\(/)
      expect(s.easing).toMatch(/\)$/)
    })

    it('has toString that returns CSS value', () => {
      let s = spring()
      let str = s.toString()
      expect(str).toMatch(/^\d+ms linear\(/)
      expect(str).toMatch(/\)$/)
    })

    it('can be spread for WAAPI', () => {
      let s = spring()
      let spread = { ...s }
      expect(spread).toHaveProperty('duration')
      expect(spread).toHaveProperty('easing')
      expect(typeof spread.duration).toBe('number')
      expect(typeof spread.easing).toBe('string')
    })

    it('works in template literals', () => {
      let s = spring()
      let css = `transform ${s}`
      expect(css).toMatch(/^transform \d+ms linear\(/)
    })
  })

  describe('presets', () => {
    it('accepts bouncy preset', () => {
      let s = spring('bouncy')
      expect(s.duration).toBeGreaterThan(0)
    })

    it('accepts snappy preset', () => {
      let s = spring('snappy')
      expect(s.duration).toBeGreaterThan(0)
    })

    it('accepts smooth preset', () => {
      let s = spring('smooth')
      expect(s.duration).toBeGreaterThan(0)
    })

    it('defaults to snappy when no args', () => {
      let defaultSpring = spring()
      let snappySpring = spring('snappy')
      expect(defaultSpring.duration).toBe(snappySpring.duration)
    })

    it('allows duration override on presets', () => {
      let s = spring('bouncy', { duration: 1000 })
      // Should be longer than default bouncy
      expect(s.duration).toBeGreaterThan(spring('bouncy').duration)
    })

    it('exposes preset defaults via spring.presets', () => {
      expect(spring.presets).toHaveProperty('smooth')
      expect(spring.presets).toHaveProperty('snappy')
      expect(spring.presets).toHaveProperty('bouncy')
      expect(spring.presets.bouncy).toEqual({ duration: 400, bounce: 0.3 })
    })
  })

  describe('custom options', () => {
    it('accepts custom duration', () => {
      let short = spring({ duration: 100 })
      let long = spring({ duration: 500 })
      expect(long.duration).toBeGreaterThan(short.duration)
    })

    it('accepts custom bounce', () => {
      let s = spring({ bounce: 0.5 })
      expect(s.duration).toBeGreaterThan(0)
    })

    it('accepts custom velocity', () => {
      let s = spring({ velocity: 5 })
      expect(s.duration).toBeGreaterThan(0)
    })
  })

  describe('physics invariants', () => {
    it('starts near 0', () => {
      let s = spring()
      let first = s.next().value
      expect(first).toBeCloseTo(0, 1)
    })

    it('ends at 1 when iteration completes', () => {
      let s = spring()
      let last = 0
      for (let value of s) {
        last = value
      }
      expect(last).toBe(1)
    })

    it('underdamped (bounce > 0) overshoots target', () => {
      let s = spring({ bounce: 0.5 })
      let maxValue = 0
      for (let value of s) {
        maxValue = Math.max(maxValue, value)
      }
      expect(maxValue).toBeGreaterThan(1)
    })

    it('critically damped (bounce = 0) never overshoots', () => {
      let s = spring({ bounce: 0 })
      for (let value of s) {
        expect(value).toBeLessThanOrEqual(1.001) // tiny tolerance for float precision
      }
    })

    it('overdamped (bounce < 0) never overshoots', () => {
      let s = spring({ bounce: -0.5 })
      for (let value of s) {
        expect(value).toBeLessThanOrEqual(1.001)
      }
    })

    it('higher bounce means longer settling time', () => {
      let low = spring({ duration: 300, bounce: 0.1 })
      let high = spring({ duration: 300, bounce: 0.7 })
      expect(high.duration).toBeGreaterThan(low.duration)
    })

    it('positive velocity causes faster initial movement', () => {
      let noVelocity = spring({ duration: 300, bounce: 0 })
      let withVelocity = spring({ duration: 300, bounce: 0, velocity: 10 })

      // Get position at early time (second frame)
      noVelocity.next()
      withVelocity.next()
      let posNoVel = noVelocity.next().value
      let posWithVel = withVelocity.next().value

      expect(posWithVel).toBeGreaterThan(posNoVel)
    })
  })

  describe('spring.transition helper', () => {
    it('formats single property', () => {
      let result = spring.transition('transform', 'bouncy')
      expect(result).toMatch(/^transform \d+ms linear\(/)
    })

    it('formats multiple properties', () => {
      let result = spring.transition(['transform', 'opacity'], 'snappy')
      expect(result).toMatch(/^transform \d+ms linear\(.+\), opacity \d+ms linear\(/)
    })

    it('accepts custom options', () => {
      let result = spring.transition('width', { duration: 500, bounce: 0.2 })
      expect(result).toMatch(/^width \d+ms linear\(/)
    })
  })
})
