import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getRemixTestHelpText, loadConfig } from '../lib/config.ts'
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

      let config = await loadConfig([], tmp)

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

      let config = await loadConfig([], tmp)

      assert.deepEqual(config.project, ['chromium', 'firefox'])
      assert.deepEqual(config.type, ['server', 'browser'])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })

  it('normalizes repeated comma-separated project and type values from CLI flags', async () => {
    let tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'remix-test-config-'))

    try {
      let config = await loadConfig(
        ['--project', 'chromium,firefox', '--project', 'webkit', '--type', 'server,browser'],
        tmp,
      )

      assert.deepEqual(config.project, ['chromium', 'firefox', 'webkit'])
      assert.deepEqual(config.type, ['server', 'browser'])
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true })
    }
  })
})

describe('config', () => {
  it('defaults to the forks pool', async () => {
    let cwd = await createConfigDir('default-pool')
    let config = await loadConfig([], cwd)

    assert.equal(config.pool, 'forks')
  })

  it('reads pool from the config file', async () => {
    let cwd = await createConfigDir('file-pool')
    await fsp.writeFile(
      path.join(cwd, 'remix-test.config.ts'),
      `export default { pool: 'threads' }`,
    )

    let config = await loadConfig([], cwd)

    assert.equal(config.pool, 'threads')
  })

  it('prefers the CLI pool over the config file', async () => {
    let cwd = await createConfigDir('cli-pool')
    await fsp.writeFile(
      path.join(cwd, 'remix-test.config.ts'),
      `export default { pool: 'threads' }`,
    )

    let config = await loadConfig(['--pool', 'forks'], cwd)

    assert.equal(config.pool, 'forks')
  })

  it('rejects unsupported pool values', async () => {
    let cwd = await createConfigDir('invalid-pool')

    await assert.rejects(
      () => loadConfig(['--pool', 'workers'], cwd),
      /Unsupported test pool "workers"/,
    )
  })

  it('includes the pool flag in help text', () => {
    let help = getRemixTestHelpText()

    assert.match(help, /--pool <value>/)
  })
})

async function createConfigDir(name: string): Promise<string> {
  let dir = path.join(CONFIG_FIXTURE_DIR, name)
  await fsp.rm(dir, { recursive: true, force: true })
  await fsp.mkdir(dir, { recursive: true })
  return dir
}
