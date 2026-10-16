import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { prefersReducedMotion } from '../animation.ts'

describe('prefersReducedMotion', () => {
  it('returns true when reduced motion is requested', (t) => {
    let matchMedia = t.mock.method(window, 'matchMedia', () => ({ matches: true }))

    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('reads the current preference on each call', (t) => {
    let matches = false
    t.mock.method(window, 'matchMedia', () => ({ matches }))

    expect(prefersReducedMotion()).toBe(false)
    matches = true
    expect(prefersReducedMotion()).toBe(true)
    matches = false
    expect(prefersReducedMotion()).toBe(false)
  })

  it('returns false when matchMedia is unavailable', (t) => {
    let descriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    t.after(() => {
      if (descriptor) Object.defineProperty(window, 'matchMedia', descriptor)
      else Reflect.deleteProperty(window, 'matchMedia')
    })
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })

    expect(prefersReducedMotion()).toBe(false)
  })
})
