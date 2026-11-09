import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { after, before, describe, it } from '@remix-run/test'

import { cleanCliTemplate, syncCliTemplate } from '../../../../scripts/utils/cli-template.ts'
import { bootstrapProject } from './bootstrap-project.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('bootstrapProject', () => {
  before(async () => {
    await syncCliTemplate(ROOT_DIR)
  })

  after(async () => {
    await cleanCliTemplate(ROOT_DIR)
  })

  it('uses cross-env-shell for NODE_ENV scripts on Windows', async () => {
    let packageJson = await scaffoldPackageJson('win32')

    assert.equal(
      packageJson.scripts.dev,
      'cross-env-shell NODE_ENV=development "node --watch --import remix/node-tsx server.ts"',
    )
    assert.equal(packageJson.scripts.hmr, 'cross-env-shell NODE_ENV=development "node hmr.ts"')
    assert.equal(
      packageJson.scripts.start,
      'cross-env-shell NODE_ENV=production "node --import remix/node-tsx server.ts"',
    )
    assert.equal(packageJson.scripts.test, 'cross-env-shell NODE_ENV=test "remix test"')
    assert.equal(packageJson.dependencies['cross-env'], '^10.1.0')
  })

  it('does not add cross-env on non-Windows platforms', async () => {
    let packageJson = await scaffoldPackageJson('darwin')

    assert.equal(
      packageJson.scripts.dev,
      'NODE_ENV=development node --watch --import remix/node-tsx server.ts',
    )
    assert.equal(packageJson.dependencies['cross-env'], undefined)
  })
})

interface ScaffoldPackageJson {
  dependencies: Record<string, string | undefined>
  scripts: Record<string, string>
}

async function scaffoldPackageJson(platform: NodeJS.Platform): Promise<ScaffoldPackageJson> {
  let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-bootstrap-'))

  try {
    let { targetDir } = await bootstrapProject({
      appName: null,
      cwd: tmpDir,
      force: false,
      platform,
      remixVersion: '4.5.6',
      targetDir: 'my-app',
    })

    return JSON.parse(await fs.readFile(path.join(targetDir, 'package.json'), 'utf8'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}
