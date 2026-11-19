import type { ChildProcess } from 'node:child_process'
import { spawn, spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { after, before, describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'

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

  it('uses cross-env for NODE_ENV scripts on Windows', async () => {
    let packageJson = await scaffoldPackageJson('win32')

    // cross-env-shell normalizes the whole command string as a path on Windows, which rewrites
    // `remix/node-tsx` to `remix\node-tsx`. cross-env leaves arguments untouched.
    assert.equal(
      packageJson.scripts.dev,
      'cross-env NODE_ENV=development node --watch --import remix/node-tsx server.ts',
    )
    assert.equal(packageJson.scripts.hmr, 'cross-env NODE_ENV=development node hmr.ts')
    assert.equal(
      packageJson.scripts.start,
      'cross-env NODE_ENV=production node --import remix/node-tsx server.ts',
    )
    assert.equal(packageJson.scripts.test, 'cross-env NODE_ENV=test remix test')
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

  it('runs server.ts with the generated dev script', { timeout: 30_000 }, async (t) => {
    let output = await runGeneratedScript(t, 'dev')

    assert.match(output, /server\.ts ran with NODE_ENV=development/)
  })

  it('runs server.ts with the generated start script', { timeout: 30_000 }, async (t) => {
    let output = await runGeneratedScript(t, 'start')

    assert.match(output, /server\.ts ran with NODE_ENV=production/)
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

// Scaffolds an app for the current platform, links the workspace `remix` and `cross-env` packages
// in place of `npm install`, and runs `npm run <script>` the way users do. `server.ts` is replaced
// with a stub so the test covers how the scripts launch Node, not the app itself.
async function runGeneratedScript(t: TestContext, script: string): Promise<string> {
  let isWindows = process.platform === 'win32'
  let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-bootstrap-'))
  let child: ChildProcess | undefined
  let closed: Promise<void> | undefined

  // One cleanup callback so the process tree is stopped before its working directory is removed,
  // which Windows otherwise rejects with EBUSY.
  t.after(async () => {
    if (child != null && child.exitCode === null && child.signalCode === null) {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      } else {
        process.kill(-child.pid!, 'SIGTERM')
      }
    }
    await closed
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  let { targetDir } = await bootstrapProject({
    appName: null,
    cwd: tmpDir,
    force: false,
    targetDir: 'my-app',
  })

  let nodeModulesDir = path.join(targetDir, 'node_modules')
  await fs.mkdir(nodeModulesDir)
  await fs.symlink(
    path.join(ROOT_DIR, 'packages/remix'),
    path.join(nodeModulesDir, 'remix'),
    'junction',
  )
  await fs.symlink(
    await fs.realpath(path.join(ROOT_DIR, 'packages/cli/node_modules/cross-env')),
    path.join(nodeModulesDir, 'cross-env'),
    'junction',
  )
  await fs.writeFile(
    path.join(targetDir, 'server.ts'),
    'console.log(`server.ts ran with NODE_ENV=${process.env.NODE_ENV}`)\n',
  )

  let env: NodeJS.ProcessEnv = { ...process.env }
  let pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  env[pathKey] = [path.join(ROOT_DIR, 'packages/cli/node_modules/.bin'), env[pathKey]].join(
    path.delimiter,
  )

  let spawned = spawn(`npm run ${script}`, {
    cwd: targetDir,
    detached: !isWindows,
    env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let spawnedClosed = new Promise<void>((resolve) => spawned.once('close', () => resolve()))
  child = spawned
  closed = spawnedClosed

  let output = ''

  return new Promise<string>((resolve, reject) => {
    function onData(chunk: Buffer) {
      output += chunk.toString()
      if (/server\.ts ran.*\n/.test(output)) resolve(output)
    }

    spawned.stdout.on('data', onData)
    spawned.stderr.on('data', onData)
    spawned.once('error', reject)
    spawnedClosed.then(() =>
      reject(new Error(`npm run ${script} exited without running server.ts:\n${output}`)),
    )
  })
}
