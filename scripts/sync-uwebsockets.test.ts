import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

const execFileAsync = promisify(execFile)
const platforms = ['darwin-arm64', 'darwin-x64', 'linux-arm64-gnu', 'linux-x64-gnu', 'win32-x64']
const commit = '0123456789012345678901234567890123456789'

describe('sync-uwebsockets', () => {
  it('extracts a verified cached archive from the cache directory', async () => {
    let fixture = await createFixture()
    try {
      await fs.mkdir(path.dirname(fixture.cache), { recursive: true })
      await fs.copyFile(fixture.archive, fixture.cache)
      await execFileAsync(process.execPath, [fixture.script, 'win32-x64'])
      assert.equal(
        await fs.readFile(
          path.join(fixture.root, 'packages/uwebsockets-js-win32-x64/dist/uws_win32_x64_137.node'),
          'utf8',
        ),
        'native payload win32-x64',
      )
    } finally {
      await fs.rm(fixture.root, { recursive: true, force: true })
    }
  })

  it('keeps the first published archive when simultaneous builds download the same pin', async () => {
    let fixture = await createFixture()
    let builds = platforms.map((platform) => {
      let gate = path.join(fixture.root, platform)
      let completion = execFileAsync(
        process.execPath,
        ['--import', fixture.preload, fixture.script, platform],
        {
          env: { ...process.env, UWS_TEST_ARCHIVE: fixture.archive, UWS_TEST_GATE: gate },
        },
      )
      return { platform, gate, completion }
    })
    try {
      await Promise.all(builds.map((build) => waitForFile(build.gate + '.ready')))
      let [first, ...remaining] = builds
      assert.ok(first)
      await fs.writeFile(first.gate, '')
      await first.completion
      let published = await fs.stat(fixture.cache)
      await Promise.all(remaining.map((build) => fs.writeFile(build.gate, '')))
      await Promise.all(remaining.map((build) => build.completion))
      assert.equal((await fs.stat(fixture.cache)).ino, published.ino)
      assert.equal(
        createHash('sha256')
          .update(await fs.readFile(fixture.cache))
          .digest('hex'),
        fixture.checksum,
      )
      assert.deepEqual(await fs.readdir(path.dirname(fixture.cache)), [commit + '.tar.gz'])
      for (let build of builds) {
        let [platform, arch] = build.platform.split('-')
        let binary = path.join(
          fixture.root,
          `packages/uwebsockets-js-${build.platform}/dist/uws_${platform}_${arch}_137.node`,
        )
        assert.equal(await fs.readFile(binary, 'utf8'), 'native payload ' + build.platform)
      }
    } finally {
      for (let build of builds) build.completion.child.kill()
      await Promise.allSettled(builds.map((build) => build.completion))
      await fs.rm(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects an unverified cached archive before extracting payloads', async () => {
    let fixture = await createFixture()
    try {
      await fs.mkdir(path.dirname(fixture.cache), { recursive: true })
      await fs.writeFile(fixture.cache, 'unverified archive')
      await assert.rejects(
        execFileAsync(process.execPath, [fixture.script, 'win32-x64']),
        /Upstream archive checksum mismatch/,
      )
    } finally {
      await fs.rm(fixture.root, { recursive: true, force: true })
    }
  })
})

async function createFixture() {
  let root = await fs.mkdtemp(path.join(os.tmpdir(), 'uws-sync-'))
  let source = path.join(root, 'source')
  let prefix = `uNetworking-uWebSockets.js-${commit.slice(0, 7)}`
  let upstream = path.join(source, prefix)
  let facade = path.join(root, 'packages/uwebsockets-js')
  await fs.mkdir(upstream, { recursive: true })
  await fs.mkdir(path.join(root, 'scripts'))
  await fs.mkdir(path.join(facade, 'src'), { recursive: true })
  for (let [file, content] of Object.entries({
    source_commit: 'fixture-source',
    LICENSE: 'fixture license',
    'uws.js': 'module.exports = {}',
    'index.d.ts': 'export function App(): void',
    'ESM_wrapper.mjs': 'import uws from "./uws.js"',
  })) {
    await fs.writeFile(path.join(upstream, file), content)
  }
  for (let platform of platforms) {
    let [os, arch] = platform.split('-')
    await fs.writeFile(
      path.join(upstream, `uws_${os}_${arch}_137.node`),
      'native payload ' + platform,
    )
  }
  await execFileAsync('tar', ['-czf', 'download.tar.gz', '-C', 'source', prefix], { cwd: root })
  let archive = path.join(root, 'download.tar.gz')
  let checksum = createHash('sha256')
    .update(await fs.readFile(archive))
    .digest('hex')
  await fs.writeFile(
    path.join(facade, 'upstream.json'),
    JSON.stringify({
      commit,
      sourceCommit: 'fixture-source',
      archiveSha256: checksum,
      nodeAbis: [137],
      version: 'fixture',
    }),
  )
  await fs.writeFile(
    path.join(facade, 'package.json'),
    JSON.stringify({
      optionalDependencies: Object.fromEntries(
        platforms.map((platform) => [`@remix-run/uwebsockets-js-${platform}`, 'workspace:*']),
      ),
    }),
  )
  let script = path.join(root, 'scripts/sync-uwebsockets.ts')
  await fs.copyFile(new URL('./sync-uwebsockets.ts', import.meta.url), script)
  let preload = path.join(root, 'fetch.mjs')
  await fs.writeFile(
    preload,
    `
import * as fs from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
globalThis.fetch = async () => {
  await fs.writeFile(process.env.UWS_TEST_GATE + '.ready', '')
  for (;;) {
    try { await fs.access(process.env.UWS_TEST_GATE); break }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    await setTimeout(10)
  }
  return new Response(await fs.readFile(process.env.UWS_TEST_ARCHIVE))
}
`,
  )
  return {
    root,
    archive,
    checksum,
    script,
    preload,
    cache: path.join(root, '.tmp/uwebsockets', commit + '.tar.gz'),
  }
}

async function waitForFile(file: string): Promise<void> {
  for (let attempt = 0; attempt < 3_000; attempt++) {
    try {
      await fs.access(file)
      return
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    await setTimeout(10)
  }
  throw new Error('Timed out waiting for fixture download: ' + file)
}
