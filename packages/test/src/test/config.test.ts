import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadConfig } from '../lib/config.ts'
import { describe, it } from '../lib/framework.ts'
import { fileURLToPath } from 'node:url'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIG_FIXTURE_DIR = path.join(PKG_DIR, '.tmp', 'config')

describe('loadConfig', () => {
  it('loads remix-test.config.ts from cwd', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      await fsp.writeFile(
        path.join(tmp, 'remix-test.config.ts'),
        [
          'export default {',
          "  glob: { test: 'src/**/*.test.ts', browser: 'src/**/*.test.ts' },",
          "  type: ['browser'],",
          '}',
        ].join('\n'),
      )

      let config = await loadConfig({}, undefined, tmp)

      assert.deepEqual(config.glob.test, ['src/**/*.test.ts'])
      assert.deepEqual(config.glob.browser, ['src/**/*.test.ts'])
      assert.deepEqual(config.type, ['browser'])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('normalizes comma-separated project and type values from config files', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      await fsp.writeFile(
        path.join(tmp, 'remix-test.config.ts'),
        [
          'export default {',
          "  project: 'chromium, firefox',",
          "  type: 'server,browser',",
          '}',
        ].join('\n'),
      )

      let config = await loadConfig({}, undefined, tmp)

      assert.deepEqual(config.project, ['chromium', 'firefox'])
      assert.deepEqual(config.type, ['server', 'browser'])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('normalizes comma-separated project and type invocation options', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      let config = await loadConfig(
        { project: ['chromium,firefox', 'webkit'], type: ['server,browser'] },
        undefined,
        tmp,
      )

      assert.deepEqual(config.project, ['chromium', 'firefox', 'webkit'])
      assert.deepEqual(config.type, ['server', 'browser'])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('normalizes repeated only invocation options', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      let config = await loadConfig(
        { only: ['server > matches', '/browser/', '/checkout/i'] },
        undefined,
        tmp,
      )

      assert.deepEqual(config.only, [
        { source: 'server > matches', flags: 'i' },
        { source: 'browser', flags: '' },
        { source: 'checkout', flags: 'i' },
      ])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('normalizes only values from config files', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      await fsp.writeFile(
        path.join(tmp, 'remix-test.config.ts'),
        ['export default {', "  only: [/server/, /checkout/i, 'browser'],", '}'].join('\n'),
      )

      let config = await loadConfig({}, undefined, tmp)

      assert.deepEqual(config.only, [
        { source: 'server', flags: '' },
        { source: 'checkout', flags: 'i' },
        { source: 'browser', flags: 'i' },
      ])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('rejects invalid only patterns', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      await assert.rejects(
        () => loadConfig({ only: '/(/' }, undefined, tmp),
        (error: unknown) => {
          let message = String(error)
          assert.match(message, /Invalid --only pattern/)
          assert.match(message, /must be valid JavaScript regular expressions/)
          assert.match(message, /Invalid regular expression/)
          return true
        },
      )
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })
})

describe('config', () => {
  it('defaults to the forks pool', async () => {
    let cwd = await createConfigDir('default-pool')
    let config = await loadConfig({}, undefined, cwd)

    assert.equal(config.pool, 'forks')
  })

  it('reads pool from the config file', async () => {
    let cwd = await createConfigDir('file-pool')
    await fsp.writeFile(
      path.join(cwd, 'remix-test.config.ts'),
      `export default { pool: 'threads' }`,
    )

    let config = await loadConfig({}, undefined, cwd)

    assert.equal(config.pool, 'threads')
  })

  it('prefers the invocation pool over the config file', async () => {
    let cwd = await createConfigDir('invocation-pool')
    await fsp.writeFile(
      path.join(cwd, 'remix-test.config.ts'),
      `export default { pool: 'threads' }`,
    )

    let config = await loadConfig({ pool: 'forks' }, undefined, cwd)

    assert.equal(config.pool, 'forks')
  })

  it('prefers invocation options over the config file', async () => {
    let cwd = await createConfigDir('invocation-options')
    await fsp.writeFile(path.join(cwd, 'remix-test.config.ts'), `export default { quiet: false }`)

    let config = await loadConfig({ quiet: true }, undefined, cwd)

    assert.equal(config.quiet, true)
  })

  it('rejects unsupported pool values', async () => {
    let cwd = await createConfigDir('invalid-pool')

    await assert.rejects(
      // @ts-expect-error Runtime validation protects JavaScript callers and untyped config files.
      () => loadConfig({ pool: 'workers' }, undefined, cwd),
      /Unsupported test pool "workers"/,
    )
  })

  it('loads an explicit config path before applying invocation options', async () => {
    let cwd = await createConfigDir('explicit-config')
    await fsp.writeFile(
      path.join(cwd, 'custom.config.ts'),
      `export default { concurrency: 2, type: ['browser'] }`,
    )

    let config = await loadConfig({ concurrency: 1 }, 'custom.config.ts', cwd)

    assert.equal(config.concurrency, 1)
    assert.deepEqual(config.type, ['browser'])
  })

  it('preserves coverage enablement while applying invocation coverage settings', async () => {
    let cwd = await createConfigDir('coverage-precedence')
    await fsp.writeFile(
      path.join(cwd, 'remix-test.config.ts'),
      `export default { coverage: { dir: 'from-config' } }`,
    )

    let refined = await loadConfig(
      { coverage: { dir: 'from-invocation', enabled: undefined } },
      undefined,
      cwd,
    )
    let enabled = await loadConfig({ coverage: { dir: 'enabled-inline' } }, undefined, cwd)
    let disabled = await loadConfig({ coverage: false }, undefined, cwd)
    let disabledCwd = await createConfigDir('coverage-settings-only')
    await fsp.writeFile(
      path.join(disabledCwd, 'remix-test.config.ts'),
      `export default { coverage: false }`,
    )
    let settingsOnly = await loadConfig(
      { coverage: { dir: 'settings-only', enabled: undefined } },
      undefined,
      disabledCwd,
    )

    assert.equal(refined.coverage?.dir, 'from-invocation')
    assert.equal(enabled.coverage?.dir, 'enabled-inline')
    assert.equal(disabled.coverage, undefined)
    assert.equal(settingsOnly.coverage, undefined)
  })
})

async function createConfigDir(name: string): Promise<string> {
  let dir = path.join(CONFIG_FIXTURE_DIR, name)
  await fsp.rm(dir, { recursive: true, force: true })
  await fsp.mkdir(dir, { recursive: true })
  return dir
}
