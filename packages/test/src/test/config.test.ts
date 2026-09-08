import * as assert from '@remix-run/assert'
import { resolveConfig } from '../lib/config.ts'
import { describe, it } from '../lib/framework.ts'

describe('resolveConfig', () => {
  it('normalizes comma-separated project and type options', () => {
    let config = resolveConfig({
      project: ['chromium,firefox', 'webkit'],
      type: ['server,browser'],
    })

    assert.deepEqual(config.project, ['chromium', 'firefox', 'webkit'])
    assert.deepEqual(config.type, ['server', 'browser'])
  })

  it('normalizes only patterns', () => {
    let config = resolveConfig({
      // "/a\\/" has an escaped trailing slash, so it is not a complete regex
      // literal and falls back to a plain case-insensitive pattern.
      only: [/server/, /checkout/i, 'browser', '/account$/', '/a\\/'],
    })

    assert.deepEqual(config.only, [
      { source: 'server', flags: '' },
      { source: 'checkout', flags: 'i' },
      { source: 'browser', flags: 'i' },
      { source: 'account$', flags: '' },
      { source: '/a\\/', flags: 'i' },
    ])
  })

  it('rejects invalid only patterns', () => {
    assert.throws(
      () => resolveConfig({ only: '/(/' }),
      (error: unknown) => {
        let message = String(error)
        assert.match(message, /Invalid --only pattern/)
        assert.match(message, /must be valid JavaScript regular expressions/)
        assert.match(message, /Invalid regular expression/)
        return true
      },
    )
  })

  it('defaults to the forks pool', () => {
    let config = resolveConfig()

    assert.equal(config.pool, 'forks')
  })

  it('uses structured invocation options', () => {
    let config = resolveConfig({ concurrency: 1, pool: 'threads', quiet: true })

    assert.equal(config.concurrency, 1)
    assert.equal(config.pool, 'threads')
    assert.equal(config.quiet, true)
  })

  it('rejects unsupported pool values', () => {
    assert.throws(
      // @ts-expect-error Runtime validation protects JavaScript callers.
      () => resolveConfig({ pool: 'workers' }),
      /Unsupported test pool "workers"/,
    )
  })

  it('resolves coverage enablement', () => {
    let enabled = resolveConfig({ coverage: { dir: 'enabled-inline' } })
    let explicitlyEnabled = resolveConfig({ coverage: true })
    let disabled = resolveConfig({ coverage: false })
    let inherited = resolveConfig({ coverage: { dir: 'settings-only', enabled: 'inherit' } })

    assert.equal(enabled.coverage?.dir, 'enabled-inline')
    assert.equal(explicitlyEnabled.coverage?.dir, '.coverage')
    assert.equal(disabled.coverage, undefined)
    assert.equal(inherited.coverage, undefined)
  })

  it('treats null coverage as disabled', () => {
    // @ts-expect-error Runtime validation protects JavaScript callers.
    let config = resolveConfig({ coverage: null })

    assert.equal(config.coverage, undefined)
  })

  it('rejects invalid concurrency values', () => {
    assert.throws(() => resolveConfig({ concurrency: 'abc' }), /Invalid concurrency value "abc"/)
    assert.throws(() => resolveConfig({ concurrency: 0 }), /Invalid concurrency value "0"/)
  })

  it('rejects non-numeric coverage thresholds', () => {
    assert.throws(
      () => resolveConfig({ coverage: { lines: 'ninety' } }),
      /Invalid coverage\.lines value "ninety"/,
    )
  })
})
