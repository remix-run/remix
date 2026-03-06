import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { navigate, startNavigationListener } from '../lib/navigate.ts'
import { run } from '../lib/run.ts'

describe('navigate', () => {
  let initialHref = ''

  beforeEach(() => {
    initialHref = window.location.href
  })

  afterEach(() => {
    history.replaceState(history.state, '', initialHref)
    vi.unstubAllGlobals()
  })

  it('falls back to window.location.assign when the Navigation API is unavailable', async () => {
    vi.stubGlobal('navigation', undefined)

    let changed = new Promise<void>((resolve) => {
      window.addEventListener(
        'hashchange',
        () => {
          resolve()
        },
        { once: true },
      )
    })

    await navigate('#rmx-fallback')
    await changed

    expect(window.location.hash).toBe('#rmx-fallback')
  })

  it('ignores navigation listener setup when the Navigation API is unavailable', () => {
    vi.stubGlobal('navigation', undefined)

    let controller = new AbortController()

    expect(() => {
      startNavigationListener(controller.signal)
    }).not.toThrow()
  })

  it('boots run() when the Navigation API is unavailable', async () => {
    vi.stubGlobal('navigation', undefined)

    let app = run({
      loadModule() {
        throw new Error('loadModule should not be called during this test')
      },
    })

    await expect(app.ready()).resolves.toBeUndefined()

    app.dispose()
  })
})
