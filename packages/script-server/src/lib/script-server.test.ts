import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createMemoryFileStorage } from '@remix-run/file-storage/memory'
import type { FileStorage } from '@remix-run/file-storage'

import { createScriptServer } from './script-server.ts'

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'script-server-test-'))
}

async function write(dir: string, rel: string, content: string): Promise<string> {
  let fullPath = path.join(dir, rel)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf-8')
  return fullPath
}

function writeJson(dir: string, rel: string, value: unknown): Promise<string> {
  return write(dir, rel, JSON.stringify(value, null, 2))
}

function createTestServer(
  root: string,
  overrides: Partial<Parameters<typeof createScriptServer>[0]> = {},
) {
  return createScriptServer({
    allow: ['app/**', 'app/node_modules/**'],
    entryPoints: ['app/entry.ts', 'app/entry.tsx'],
    routes: [
      { urlPattern: '/scripts/app/*path', filePattern: 'app/*path' },
      { urlPattern: '/scripts/npm/*path', filePattern: 'app/node_modules/*path' },
    ],
    root,
    ...overrides,
  })
}

function get(
  scriptServer: ReturnType<typeof createScriptServer>,
  pathname: string,
  headers?: Record<string, string>,
) {
  return scriptServer.fetch(new Request(`http://localhost${pathname}`, { headers }))
}

function head(scriptServer: ReturnType<typeof createScriptServer>, pathname: string) {
  return scriptServer.fetch(new Request(`http://localhost${pathname}`, { method: 'HEAD' }))
}

function post(scriptServer: ReturnType<typeof createScriptServer>, pathname: string) {
  return scriptServer.fetch(new Request(`http://localhost${pathname}`, { method: 'POST' }))
}

function createRecordingFileStorage() {
  let fileStorage = createMemoryFileStorage()
  let gets: string[] = []
  let sets: string[] = []

  let recordingFileStorage: FileStorage = {
    async get(key) {
      gets.push(key)
      return fileStorage.get(key)
    },
    async has(key) {
      return fileStorage.has(key)
    },
    async list(options) {
      return fileStorage.list(options)
    },
    async put(key, value) {
      sets.push(key)
      return fileStorage.put(key, value)
    },
    async remove(key) {
      return fileStorage.remove(key)
    },
    async set(key, value) {
      sets.push(key)
      return fileStorage.set(key, value)
    },
  }

  return { fileStorage: recordingFileStorage, gets, sets }
}

async function assertInternalServerError(response: Response): Promise<void> {
  assert.equal(response.status, 500)
  assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
  assert.equal(await response.text(), 'Internal Server Error')
}

describe('script-server', () => {
  let dir: string

  before(async () => {
    dir = await makeTmpDir()
  })

  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('handles GET and HEAD requests but ignores POST', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let scriptServer = createTestServer(dir)

    let getResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(getResponse)
    assert.equal(getResponse.status, 200)

    let headResponse = await head(scriptServer, '/scripts/app/entry.ts')
    assert.ok(headResponse)
    assert.equal(headResponse.status, 200)
    assert.equal(await headResponse.text(), '')

    let postResponse = await post(scriptServer, '/scripts/app/entry.ts')
    assert.equal(postResponse, null)
  })

  it('serves entry points with no-cache and ETags', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let scriptServer = createTestServer(dir)

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    assert.ok(response.headers.get('ETag'))

    let notModified = await get(scriptServer, '/scripts/app/entry.ts', {
      'If-None-Match': response.headers.get('ETag')!,
    })
    assert.ok(notModified)
    assert.equal(notModified.status, 304)
  })

  it('serves allow-listed internal modules directly by default with ETags', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let scriptServer = createTestServer(dir)

    let response = await get(scriptServer, '/scripts/app/dep.ts')
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    assert.ok(response.headers.get('ETag'))
  })

  it('supports .mts modules', async () => {
    await write(dir, 'app/entry.mts', 'export const value = 1')
    let scriptServer = createTestServer(dir, {
      entryPoints: ['app/entry.mts'],
    })

    let response = await get(scriptServer, '/scripts/app/entry.mts')
    assert.ok(response)
    assert.equal(response.status, 200)
  })

  it('ignores unsupported direct requests like .json files', async () => {
    await write(dir, 'app/data.json', '{"ok":true}')
    let scriptServer = createTestServer(dir)

    let response = await get(scriptServer, '/scripts/app/data.json')
    assert.equal(response, null)
  })

  it('uses internalModuleCacheControl only for internal modules', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let scriptServer = createTestServer(dir, {
      internalModuleCacheControl: 'public, max-age=60',
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    let depResponse = await get(scriptServer, '/scripts/app/dep.ts')
    assert.ok(entryResponse && depResponse)
    assert.equal(entryResponse.headers.get('Cache-Control'), 'no-cache')
    assert.equal(depResponse.headers.get('Cache-Control'), 'public, max-age=60')
  })

  it('fingerprints internal modules with .@fingerprint URLs and returns 404 on mismatch', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let scriptServer = createTestServer(dir, {
      fingerprintInternalModules: true,
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let body = await entryResponse.text()
    let match = body.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match, `expected fingerprinted dep import, got:\n${body}`)

    let depResponse = await get(scriptServer, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depResponse)
    assert.equal(depResponse.status, 200)
    assert.ok(depResponse.headers.get('ETag'))

    let unhashed = await get(scriptServer, '/scripts/app/dep.ts')
    assert.equal(unhashed, null)

    let mismatch = await get(scriptServer, '/scripts/app/dep.ts.@wronghash')
    assert.ok(mismatch)
    assert.equal(mismatch.status, 404)
  })

  it('does not cascade internal fingerprints to unchanged direct importers', async () => {
    await write(dir, 'app/entry.ts', 'import "./mid.ts"\nexport const entry = true')
    await write(dir, 'app/mid.ts', 'import "./leaf.ts"\nexport const mid = true')
    await write(dir, 'app/leaf.ts', 'export const leaf = 1')

    let scriptServer = createTestServer(dir, {
      fingerprintInternalModules: true,
    })

    let before = await scriptServer.preloads('/scripts/app/entry.ts')
    let beforeMid = before.find((url) => url.includes('/scripts/app/mid.ts.@'))
    let beforeLeaf = before.find((url) => url.includes('/scripts/app/leaf.ts.@'))

    await write(dir, 'app/leaf.ts', 'export const leaf = 2')

    let after = await scriptServer.preloads('/scripts/app/entry.ts')
    let afterMid = after.find((url) => url.includes('/scripts/app/mid.ts.@'))
    let afterLeaf = after.find((url) => url.includes('/scripts/app/leaf.ts.@'))

    assert.equal(afterMid, beforeMid)
    assert.notEqual(afterLeaf, beforeLeaf)
  })

  it('uses version to change internal fingerprints', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')

    let serverA = createTestServer(dir, {
      fingerprintInternalModules: true,
      version: '',
    })
    let serverB = createTestServer(dir, {
      fingerprintInternalModules: true,
      version: 'v2',
    })

    let bodyA = await (await get(serverA, '/scripts/app/entry.ts'))!.text()
    let bodyB = await (await get(serverB, '/scripts/app/entry.ts'))!.text()
    let matchA = bodyA.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    let matchB = bodyB.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)

    assert.ok(matchA && matchB)
    assert.notEqual(matchA[1], matchB[1])
  })

  it('keeps entry-point imports stable even when entry points are also dependencies', async () => {
    await write(dir, 'app/a.ts', 'import "./b.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')
    let scriptServer = createTestServer(dir, {
      entryPoints: ['app/a.ts', 'app/b.ts'],
      fingerprintInternalModules: true,
    })

    let response = await get(scriptServer, '/scripts/app/a.ts')
    assert.ok(response)
    let body = await response.text()
    assert.ok(body.includes('/scripts/app/b.ts'))
    assert.ok(!body.includes('/scripts/app/b.ts.@'))
  })

  it('supports external source maps for entry points and fingerprinted internal modules', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry: number = 1')
    await write(dir, 'app/dep.ts', 'export const dep: number = 2')
    let scriptServer = createTestServer(dir, {
      fingerprintInternalModules: true,
      sourceMaps: 'external',
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let entryBody = await entryResponse.text()
    assert.ok(entryBody.includes('//# sourceMappingURL=/scripts/app/entry.ts.map'))

    let depMatch = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(depMatch)

    let depResponse = await get(scriptServer, `/scripts/app/dep.ts.@${depMatch[1]}`)
    assert.ok(depResponse)
    let depBody = await depResponse.text()
    assert.ok(depBody.includes(`/scripts/app/dep.ts.@${depMatch[1]}.map`))

    let entryMap = await get(scriptServer, '/scripts/app/entry.ts.map')
    let depMap = await get(scriptServer, `/scripts/app/dep.ts.@${depMatch[1]}.map`)
    assert.ok(entryMap && depMap)
    assert.equal(entryMap.status, 200)
    assert.equal(depMap.status, 200)
  })

  it('uses canonical realpaths for module identity when imports go through symlinks', async () => {
    await write(dir, 'app/shared/value.ts', 'export const value = true')
    await fs.mkdir(path.join(dir, 'app/alias'), { recursive: true })
    await fs.rm(path.join(dir, 'app/alias/value.ts'), { force: true })
    await fs.symlink(path.join(dir, 'app/shared/value.ts'), path.join(dir, 'app/alias/value.ts'))
    await write(dir, 'app/entry.ts', 'import { value } from "./alias/value.ts"\nexport { value }')

    let scriptServer = createTestServer(dir, {
      fingerprintInternalModules: true,
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    let body = await response.text()
    assert.ok(body.includes('/scripts/app/shared/value.ts.@'))
    assert.ok(!body.includes('/scripts/app/alias/value.ts.@'))
  })

  it('preloads stays URL-oriented and returns the entry URL first', async () => {
    await write(dir, 'app/entry.ts', 'import "./a.ts"\nimport "./b.ts"\nexport const entry = true')
    await write(dir, 'app/a.ts', 'import "./c.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')
    await write(dir, 'app/c.ts', 'export const c = true')

    let scriptServer = createTestServer(dir, {
      fingerprintInternalModules: true,
    })

    let urls = await scriptServer.preloads('/scripts/app/entry.ts')
    assert.equal(urls[0], '/scripts/app/entry.ts')
    assert.match(urls[1], /\/scripts\/app\/a\.ts\.@/)
    assert.match(urls[2], /\/scripts\/app\/b\.ts\.@/)
    assert.match(urls[3], /\/scripts\/app\/c\.ts\.@/)
  })

  it('preloads uses jsxImportSource inherited through tsconfig extends', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: 'custom-jsx',
        },
      })
      await writeJson(caseDir, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      })
      await write(
        caseDir,
        'app/node_modules/custom-jsx/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("fragment")',
      )
      await write(caseDir, 'app/entry.tsx', 'export let entry = <div />')

      let scriptServer = createTestServer(caseDir, {
        fingerprintInternalModules: true,
      })

      let urls = await scriptServer.preloads('/scripts/app/entry.tsx')
      assert.ok(urls.some((url) => url.includes('custom-jsx/jsx-runtime.ts.@')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('reuses persisted dependency analysis and invalidates it when tsconfig changes', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: 'custom-a',
        },
      })
      await writeJson(caseDir, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      })
      await write(
        caseDir,
        'app/node_modules/custom-a/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("a")',
      )
      await write(
        caseDir,
        'app/node_modules/custom-b/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("b")',
      )
      await write(caseDir, 'app/entry.tsx', 'export let entry = <section />')

      let recordingStorage = createRecordingFileStorage()
      let firstServer = createTestServer(caseDir, {
        fileStorage: recordingStorage.fileStorage,
        fingerprintInternalModules: true,
      })
      let firstUrls = await firstServer.preloads('/scripts/app/entry.tsx')
      assert.ok(firstUrls.some((url) => url.includes('custom-a/jsx-runtime.ts.@')))
      assert.ok(
        recordingStorage.sets.some((key) => key.startsWith('dependency-records/')),
        'expected persisted dependency analysis records',
      )

      let getsBeforeSecondServer = recordingStorage.gets.length
      let secondServer = createTestServer(caseDir, {
        fileStorage: recordingStorage.fileStorage,
        fingerprintInternalModules: true,
      })
      let secondUrls = await secondServer.preloads('/scripts/app/entry.tsx')
      assert.ok(secondUrls.some((url) => url.includes('custom-a/jsx-runtime.ts.@')))
      assert.ok(
        recordingStorage.gets
          .slice(getsBeforeSecondServer)
          .some((key) => key.startsWith('dependency-records/')),
        'expected persisted dependency analysis reads on a fresh server',
      )

      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: 'custom-b',
        },
      })

      let thirdServer = createTestServer(caseDir, {
        fileStorage: recordingStorage.fileStorage,
        fingerprintInternalModules: true,
      })
      let thirdUrls = await thirdServer.preloads('/scripts/app/entry.tsx')
      assert.ok(thirdUrls.some((url) => url.includes('custom-b/jsx-runtime.ts.@')))
      assert.ok(!thirdUrls.some((url) => url.includes('custom-a/jsx-runtime.ts.@')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('supports absolute entry-point patterns', async () => {
    let entryPath = await write(dir, 'app/entry-abs.ts', 'export const abs = true')
    let scriptServer = createTestServer(dir, {
      entryPoints: [entryPath],
    })

    let response = await get(scriptServer, '/scripts/app/entry-abs.ts')
    assert.ok(response)
    assert.equal(response.status, 200)
  })

  it('rejects absolute file patterns', async () => {
    await write(dir, 'app/entry.ts', 'export const abs = true')
    assert.throws(
      () =>
        createScriptServer({
          allow: [path.join(dir, 'app')],
          entryPoints: [path.join(dir, 'app/entry.ts')],
          root: dir,
          routes: [
            {
              urlPattern: '/scripts/app/*path',
              filePattern: `${path.join(dir, 'app')}/*path`,
            },
          ],
        }),
      /must be relative to script-server root/,
    )
  })

  it('supports absolute allow rules and deny overrides', async () => {
    let allowedPath = await write(dir, 'app/allowed.ts', 'export const allowed = true')
    await write(dir, 'app/blocked.ts', 'export const blocked = true')
    await write(dir, 'app/.hidden.ts', 'export const hidden = true')
    let scriptServer = createScriptServer({
      allow: [allowedPath, path.join(dir, 'app')],
      deny: [path.join(dir, 'app/blocked.ts')],
      root: dir,
      routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
    })

    let allowedResponse = await get(scriptServer, '/scripts/app/allowed.ts')
    let blockedResponse = await get(scriptServer, '/scripts/app/blocked.ts')
    let hiddenResponse = await get(scriptServer, '/scripts/app/.hidden.ts')
    assert.ok(allowedResponse)
    assert.equal(allowedResponse.status, 200)
    assert.equal(blockedResponse, null)
    assert.ok(hiddenResponse)
    assert.equal(hiddenResponse.status, 200)
  })

  it('rejects unnamed route wildcards because routes must be reversible', async () => {
    assert.throws(
      () =>
        createScriptServer({
          allow: ['app/**'],
          root: dir,
          routes: [{ urlPattern: '/scripts/app/*', filePattern: 'app/*path' }],
        }),
      /must use named wildcards/,
    )
  })

  it('supports glob-style allow and deny rules', async () => {
    await write(dir, 'app/features/allowed.ts', 'export const allowed = true')
    await write(dir, 'app/features/private/blocked.ts', 'export const blocked = true')
    let scriptServer = createScriptServer({
      allow: ['app/**/*.ts'],
      deny: ['app/**/private/**'],
      root: dir,
      routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
    })

    let allowedResponse = await get(scriptServer, '/scripts/app/features/allowed.ts')
    let blockedResponse = await get(scriptServer, '/scripts/app/features/private/blocked.ts')
    assert.ok(allowedResponse)
    assert.equal(allowedResponse.status, 200)
    assert.equal(blockedResponse, null)
  })

  it('minifies output when requested', async () => {
    await write(
      dir,
      'app/entry.ts',
      'export function greet(name: string) {\n  return "Hello " + name\n}\n',
    )
    let scriptServer = createTestServer(dir, { minify: true })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    let body = await response.text()
    assert.ok(body.length < 60, `expected minified output, got:\n${body}`)
  })

  it('reuses compiled assets through a shared fileStorage backend', async () => {
    await write(dir, 'app/entry.ts', 'export const cached = true')
    let fileStorage = createMemoryFileStorage()
    let firstServer = createTestServer(dir, { fileStorage })
    let secondServer = createTestServer(dir, { fileStorage })

    let firstResponse = await get(firstServer, '/scripts/app/entry.ts')
    let secondResponse = await get(secondServer, '/scripts/app/entry.ts')
    assert.ok(firstResponse && secondResponse)
    assert.equal(await firstResponse.text(), await secondResponse.text())
  })

  it('calls onError for unexpected compilation failures', async () => {
    await write(dir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
    await write(dir, 'app/broken.ts', 'export const nope =')
    let receivedError: unknown
    let scriptServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(receivedError instanceof Error)
  })

  it('calls onError for unsupported imported file types', async () => {
    await write(dir, 'app/entry.ts', 'import "./data.json"\nexport const entry = true')
    await write(dir, 'app/data.json', '{"ok":true}')
    let receivedError: unknown
    let scriptServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(receivedError instanceof Error)
    assert.match(receivedError.message, /not a supported script module/)
  })
})
