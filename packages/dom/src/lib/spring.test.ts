import { describe, expect, it } from 'vitest'
import { spring } from './spring.ts'

describe('spring', () => {
  it('returns an iterable with CSS-friendly fields', () => {
    let value = spring()
    expect(typeof value.next).toBe('function')
    expect(typeof value.duration).toBe('number')
    expect(typeof value.easing).toBe('string')
    expect(`${value}`).toMatch(/^\d+ms linear\(/)
  })

  it('supports presets and option overrides', () => {
    let snappy = spring('snappy')
    let bouncy = spring('bouncy')
    let smooth = spring('smooth')
    expect(snappy.duration).toBeGreaterThan(0)
    expect(bouncy.duration).toBeGreaterThan(0)
    expect(smooth.duration).toBeGreaterThan(0)
    let custom = spring('bouncy', { duration: 900 })
    expect(custom.duration).toBeGreaterThan(bouncy.duration)
  })

  it('provides transition helper output', () => {
    let value = spring.transition(['transform', 'opacity'], { duration: 300, bounce: 0.2 })
    expect(value).toContain('transform ')
    expect(value).toContain('opacity ')
    expect(value).toContain('linear(')
  })
})
