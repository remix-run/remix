import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from '../lib/framework.ts'
import { getRemixTestHelpText, loadConfig } from '../lib/config.ts'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIG_FIXTURE_DIR = path.join(PKG_DIR, '.tmp', 'config')

describe('config', () => {
  it('defaults to the forks pool', async () => {
    let cwd = await createConfigDir('default-pool')
    let config = await loadConfig([], cwd)

    assert.equal(config.pool, 'forks')
  })

  it('reads pool from the config file', async () => {
    let cwd = await createConfigDir('file-pool')
    await fsp.writeFile(path.join(cwd, 'remix-test.config.ts'), `export default { pool: 'threads' }`)

    let config = await loadConfig([], cwd)

    assert.equal(config.pool, 'threads')
  })

  it('prefers the CLI pool over the config file', async () => {
    let cwd = await createConfigDir('cli-pool')
    await fsp.writeFile(path.join(cwd, 'remix-test.config.ts'), `export default { pool: 'threads' }`)

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
