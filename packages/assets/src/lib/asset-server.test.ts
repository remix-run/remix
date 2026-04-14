import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as nodeFs from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { RawSourceMap } from 'source-map-js'
import { SourceMapConsumer } from 'source-map-js'
import { isAssetServerCompilationError } from './compilation-error.ts'
import { normalizeWindowsPath } from './paths.ts'
import {
  createAssetServer,
  getInternalAssetServerWatchedDirectories,
  waitForInternalAssetServerWatcher,
} from './asset-server.ts'
import type { AssetServerOptions } from './asset-server.ts'

const watchTestTimeoutMs = 15000
type FingerprintOptions = NonNullable<AssetServerOptions['fingerprint']>

function createAssetServerForTest(
  options: Parameters<typeof createAssetServer>[0],
): ReturnType<typeof createAssetServer> {
  return createAssetServer(options)
}

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'asset-server-test-'))
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

function getLineAndColumn(source: string, search: string): { line: number; column: number } {
  let index = source.indexOf(search)
  assert.notEqual(index, -1, `Expected to find "${search}" in:\n${source}`)
  let before = source.slice(0, index)
  let lines = before.split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length,
  }
}

function createTestServer(root: string, overrides: Partial<AssetServerOptions> = {}) {
  return createAssetServerForTest({
    allow: ['app/**', 'app/node_modules/**'],
    routes: [
      { urlPattern: '/assets/app/*path', filePattern: 'app/*path' },
      { urlPattern: '/assets/npm/*path', filePattern: 'app/node_modules/*path' },
    ],
    root,
    ...overrides,
  })
}

function createWatchedTestServer(root: string, overrides: Partial<AssetServerOptions> = {}) {
  return createTestServer(root, {
    ...overrides,
    watch: overrides.watch ?? true,
  })
}

function get(
  assetServer: ReturnType<typeof createAssetServer>,
  pathname: string,
  headers?: Record<string, string>,
) {
  return assetServer.fetch(new Request(`http://localhost${pathname}`, { headers }))
}

function head(assetServer: ReturnType<typeof createAssetServer>, pathname: string) {
  return assetServer.fetch(new Request(`http://localhost${pathname}`, { method: 'HEAD' }))
}

async function getByFile(
  assetServer: ReturnType<typeof createAssetServer>,
  filePath: string,
  headers?: Record<string, string>,
) {
  return get(assetServer, await assetServer.getHref(filePath), headers)
}

async function headByFile(assetServer: ReturnType<typeof createAssetServer>, filePath: string) {
  return head(assetServer, await assetServer.getHref(filePath))
}

function post(assetServer: ReturnType<typeof createAssetServer>, pathname: string) {
  return assetServer.fetch(new Request(`http://localhost${pathname}`, { method: 'POST' }))
}

async function getCompiledCodeAndSourceMap(
  assetServer: ReturnType<typeof createAssetServer>,
  filePath: string,
): Promise<{ compiledCode: string; sourceMap: RawSourceMap }> {
  let entryResponse = await getByFile(assetServer, filePath)
  assert.ok(entryResponse)
  let compiledCode = await entryResponse.text()

  let sourceMapResponse = await get(assetServer, `${await assetServer.getHref(filePath)}.map`)
  assert.ok(sourceMapResponse)

  return {
    compiledCode,
    sourceMap: JSON.parse(await sourceMapResponse.text()) as RawSourceMap,
  }
}

async function assertCharacterAccurateImportRewriteSourceMap(
  root: string,
  sourceText = 'import { dep } from "./dep.ts"\nexport function value() {\n  return dep + 1\n}\n',
) {
  await write(root, 'app/dep.ts', 'export const dep = 1')
  await write(root, 'app/entry.ts', sourceText)

  let assetServer = createTestServer(root, {
    fingerprint: { buildId: 'build' },
    scripts: {
      minify: true,
      sourceMaps: 'external',
    },
  })
  try {
    let { compiledCode, sourceMap } = await getCompiledCodeAndSourceMap(assetServer, 'app/entry.ts')
    let consumer = new SourceMapConsumer(sourceMap)

    let rewrittenImport = getLineAndColumn(compiledCode, '/assets/app/dep.@')
    let originalImport = consumer.originalPositionFor(rewrittenImport)
    let expectedImport = getLineAndColumn(sourceText, '"./dep.ts"')
    assert.equal(originalImport.line, expectedImport.line)
    assert.equal(originalImport.column, expectedImport.column)

    let generatedReturn = getLineAndColumn(compiledCode, 'return')
    let originalReturn = consumer.originalPositionFor(generatedReturn)
    let expectedReturn = getLineAndColumn(sourceText, 'return')
    assert.equal(originalReturn.line, expectedReturn.line)
    assert.equal(originalReturn.column, expectedReturn.column)
  } finally {
    await assetServer.close()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor<T>(
  callback: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  let start = Date.now()

  while (true) {
    let value = await callback()
    if (predicate(value)) return value
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`)
    }
    await sleep(25)
  }
}

async function waitForWatchedTestServerReady(
  assetServer: ReturnType<typeof createAssetServer>,
  root: string,
): Promise<void> {
  await waitForInternalAssetServerWatcher(assetServer)

  let watchedRoot = normalizeWindowsPath(nodeFs.realpathSync(path.join(root, 'app')))
  await waitFor(
    async () => getInternalAssetServerWatchedDirectories(assetServer).map(normalizeWindowsPath),
    (watchedDirectories) => watchedDirectories.includes(watchedRoot),
    watchTestTimeoutMs,
  )
}

async function assertInternalServerError(response: Response): Promise<void> {
  assert.equal(response.status, 500)
  assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
  assert.equal(await response.text(), 'Internal Server Error')
}

async function withTsconfigTransformCase(
  files: Record<string, unknown>,
  callback: (context: {
    caseDir: string
    assetServer: ReturnType<typeof createAssetServer>
  }) => Promise<void>,
  serverOverrides: Partial<AssetServerOptions> = {},
): Promise<void> {
  let caseDir = await makeTmpDir()
  let assetServer: ReturnType<typeof createAssetServer> | null = null

  try {
    for (let [rel, value] of Object.entries(files)) {
      if (typeof value === 'string') {
        await write(caseDir, rel, value)
      } else {
        await writeJson(caseDir, rel, value)
      }
    }

    assetServer = createTestServer(caseDir, serverOverrides)
    await callback({ caseDir, assetServer })
  } finally {
    if (assetServer) {
      await assetServer.close()
    }

    await fs.rm(caseDir, { recursive: true, force: true })
  }
}

describe('asset-server', () => {
  let dir: string

  before(async () => {
    dir = await makeTmpDir()
  })

  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('handles GET and HEAD requests but ignores POST', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let assetServer = createTestServer(dir)

    let getResponse = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(getResponse)
    assert.equal(getResponse.status, 200)

    let headResponse = await head(assetServer, '/assets/app/entry.ts')
    assert.ok(headResponse)
    assert.equal(headResponse.status, 200)
    assert.equal(await headResponse.text(), '')

    let postResponse = await post(assetServer, '/assets/app/entry.ts')
    assert.equal(postResponse, null)
  })

  it('serves entry points with no-cache and ETags', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    assert.ok(response.headers.get('ETag'))

    let notModified = await get(assetServer, '/assets/app/entry.ts', {
      'If-None-Match': response.headers.get('ETag')!,
    })
    assert.ok(notModified)
    assert.equal(notModified.status, 304)
  })

  it('does not match a stripped weak ETag prefix in If-None-Match', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)

    let notModified = await get(assetServer, '/assets/app/entry.ts', {
      'If-None-Match': response.headers.get('ETag')!.replace(/^W\//, ''),
    })
    assert.ok(notModified)
    assert.equal(notModified.status, 200)
  })

  it('serves allow-listed internal modules directly by default with ETags', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/dep.ts')
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    assert.ok(response.headers.get('ETag'))
  })

  it('supports .mts modules', async () => {
    await write(dir, 'app/entry.mts', 'export const value = 1')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.mts')
    assert.ok(response)
    assert.equal(response.status, 200)
  })

  it('resolves explicit .js imports to TypeScript files when needed', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = "ts"')
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    assert.match(await response.text(), /\/assets\/app\/dep\.ts/)
  })

  it('resolves explicit .js imports to directory indexes when needed', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')
      await write(caseDir, 'app/dep.js/index.js', 'export const dep = "dir"')
      let assetServer = createTestServer(caseDir)

      let response = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(response)
      assert.match(await response.text(), /\/assets\/app\/dep\.js\/index\.js/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('resolves explicit .jsx imports to TSX files when needed', async () => {
    await write(dir, 'app/entry.tsx', 'import "./dep.jsx"\nexport const entry = <div />')
    await write(dir, 'app/dep.tsx', 'export const dep = <div />')
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/entry.tsx')
    assert.ok(response)
    assert.match(await response.text(), /\/assets\/app\/dep\.tsx/)
  })

  it('resolves explicit .mjs imports to .mts files when needed', async () => {
    await write(dir, 'app/entry.mts', 'import "./dep.mjs"\nexport const entry = true')
    await write(dir, 'app/dep.mts', 'export const dep = "mts"')
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/entry.mts')
    assert.ok(response)
    assert.match(await response.text(), /\/assets\/app\/dep\.mts/)
  })

  it('ignores unsupported direct requests for non-script files', async () => {
    await write(dir, 'app/data.json', '{"ok":true}')
    await write(dir, 'app/styles.css', 'body { color: red; }')
    await write(dir, 'app/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    await write(dir, 'app/.env', 'SECRET=123')
    let assetServer = createTestServer(dir)

    assert.equal(await get(assetServer, '/assets/app/data.json'), null)
    assert.equal(await get(assetServer, '/assets/app/styles.css'), null)
    assert.equal(await get(assetServer, '/assets/app/logo.svg'), null)
    assert.equal(await get(assetServer, '/assets/app/.env'), null)
  })

  it('uses immutable caching for fingerprinted module requests', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let entryResponse = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(entryResponse)
    let entryBody = await entryResponse.text()
    let depMatch = entryBody.match(/\/assets\/app\/dep\.@([A-Za-z0-9_-]+)\.ts/)
    assert.ok(depMatch)

    let depResponse = await get(assetServer, `/assets/app/dep.@${depMatch[1]}.ts`)
    assert.ok(depResponse)
    assert.equal(entryResponse.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
    assert.equal(depResponse.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
  })

  it('fingerprints all modules with filename.@fingerprint.ext urls and returns null on mismatch', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let entryHref = await assetServer.getHref('app/entry.ts')
    let entryResponse = await get(assetServer, entryHref)
    assert.ok(entryResponse)
    let body = await entryResponse.text()
    let match = body.match(/\/assets\/app\/dep\.@([A-Za-z0-9_-]+)\.ts/)
    assert.ok(match, `expected fingerprinted dep import, got:\n${body}`)
    assert.match(entryHref, /\/assets\/app\/entry\.@[A-Za-z0-9_-]+\.ts/)

    let depResponse = await get(assetServer, `/assets/app/dep.@${match[1]}.ts`)
    assert.ok(depResponse)
    assert.equal(depResponse.status, 200)
    assert.ok(depResponse.headers.get('ETag'))

    let nonFingerprinted = await get(assetServer, '/assets/app/dep.ts')
    assert.equal(nonFingerprinted, null)

    let mismatch = await get(assetServer, '/assets/app/dep.@wronghash.ts')
    assert.equal(mismatch, null)
  })

  it('keeps fingerprinted module graphs stable within a build', async () => {
    await write(dir, 'app/entry.ts', 'import "./mid.ts"\nexport const entry = true')
    await write(dir, 'app/mid.ts', 'import "./leaf.ts"\nexport const mid = true')
    await write(dir, 'app/leaf.ts', 'export const leaf = 1')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let before = await assetServer.getPreloads('app/entry.ts')
    let beforeMid = before.find((url) => url.includes('/assets/app/mid.@'))
    let beforeLeaf = before.find((url) => url.includes('/assets/app/leaf.@'))

    await write(dir, 'app/leaf.ts', 'export const leaf = 2')

    let after = await assetServer.getPreloads('app/entry.ts')
    let afterMid = after.find((url) => url.includes('/assets/app/mid.@'))
    let afterLeaf = after.find((url) => url.includes('/assets/app/leaf.@'))

    assert.equal(afterMid, beforeMid)
    assert.equal(afterLeaf, beforeLeaf)
  })

  it('uses buildId to change internal fingerprints', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')

    let serverA = createTestServer(dir, { fingerprint: { buildId: 'build-a' } })
    let serverB = createTestServer(dir, { fingerprint: { buildId: 'build-b' } })

    let bodyA = await (await getByFile(serverA, 'app/entry.ts'))!.text()
    let bodyB = await (await getByFile(serverB, 'app/entry.ts'))!.text()
    let matchA = bodyA.match(/\/assets\/app\/dep\.@([A-Za-z0-9_-]+)\.ts/)
    let matchB = bodyB.match(/\/assets\/app\/dep\.@([A-Za-z0-9_-]+)\.ts/)

    assert.ok(matchA && matchB)
    assert.notEqual(matchA[1], matchB[1])
  })

  it('keeps cached source output stable until the server restarts', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let firstServer = createTestServer(dir)

    let firstResponse = await get(firstServer, '/assets/app/entry.ts')
    assert.ok(firstResponse)
    assert.match(await firstResponse.text(), /value = 1/)

    await write(dir, 'app/entry.ts', 'export const value = 2')

    let sameServer = await get(firstServer, '/assets/app/entry.ts')
    assert.ok(sameServer)
    assert.match(await sameServer.text(), /value = 1/)

    let secondServer = createTestServer(dir)
    let afterRestart = await get(secondServer, '/assets/app/entry.ts')
    assert.ok(afterRestart)
    assert.match(await afterRestart.text(), /value = 2/)
  })

  it('keeps cached importer output stable when dependency contents change', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let assetServer = createTestServer(dir)

    let firstResponse = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(firstResponse)
    let firstBody = await firstResponse.text()
    let firstEtag = firstResponse.headers.get('ETag')
    assert.ok(firstEtag)

    await write(dir, 'app/dep.ts', 'export const dep = 2')

    let secondResponse = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(secondResponse)
    let secondBody = await secondResponse.text()
    let secondEtag = secondResponse.headers.get('ETag')

    assert.equal(secondBody, firstBody)
    assert.equal(secondEtag, firstEtag)
  })

  it('fingerprints rewritten imports even when those modules can also be fetched directly', async () => {
    await write(dir, 'app/a.ts', 'import "./b.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/a.ts')
    assert.ok(response)
    let body = await response.text()
    assert.ok(body.includes('/assets/app/b.@'))
  })

  it('supports external source maps for fingerprinted request URLs', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry: number = 1')
    await write(dir, 'app/dep.ts', 'export const dep: number = 2')
    let assetServer = createTestServer(dir, {
      fingerprint: { buildId: 'build' },
      scripts: {
        sourceMaps: 'external',
      },
    })

    let entryResponse = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(entryResponse)
    let entryBody = await entryResponse.text()
    let entryMapMatch = entryBody.match(/\/assets\/app\/entry\.@([A-Za-z0-9_-]+)\.ts\.map/)
    assert.ok(entryMapMatch)

    let depMatch = entryBody.match(/\/assets\/app\/dep\.@([A-Za-z0-9_-]+)\.ts/)
    assert.ok(depMatch)

    let depResponse = await get(assetServer, `/assets/app/dep.@${depMatch[1]}.ts`)
    assert.ok(depResponse)
    let depBody = await depResponse.text()
    assert.ok(depBody.includes(`/assets/app/dep.@${depMatch[1]}.ts.map`))

    let entryMap = await get(assetServer, `/assets/app/entry.@${entryMapMatch[1]}.ts.map`)
    let depMap = await get(assetServer, `/assets/app/dep.@${depMatch[1]}.ts.map`)
    assert.ok(entryMap && depMap)
    assert.equal(entryMap.status, 200)
    assert.equal(depMap.status, 200)
  })

  it('supports inline source maps with absolute source paths', async () => {
    let entryPath = await write(dir, 'app/entry.ts', 'export const entry: number = 1')
    let assetServer = createTestServer(dir, {
      scripts: {
        sourceMaps: 'inline',
        sourceMapSourcePaths: 'absolute',
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    let body = await response.text()
    let sourceMapMatch = body.match(
      /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/,
    )
    assert.ok(sourceMapMatch)

    let sourceMap = JSON.parse(Buffer.from(sourceMapMatch[1], 'base64').toString('utf-8')) as {
      sources: string[]
    }
    let expectedSource = nodeFs
      .realpathSync(entryPath)
      .replace(/\\/g, '/')
      .replace(/^\/([A-Za-z]:\/)/, '$1')
    assert.deepEqual(sourceMap.sources, [expectedSource])
  })

  it('updates source map mappings after import rewriting', async () => {
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    await write(dir, 'app/entry.ts', 'import "./dep.ts"; console.log(1)')
    let assetServer = createTestServer(dir, {
      fingerprint: { buildId: 'build' },
      scripts: {
        sourceMaps: 'external',
        minify: true,
      },
    })

    let entryResponse = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(entryResponse)
    let compiledCode = await entryResponse.text()

    let sourceMapResponse = await get(
      assetServer,
      `${await assetServer.getHref('app/entry.ts')}.map`,
    )
    assert.ok(sourceMapResponse)
    let sourceMap = JSON.parse(await sourceMapResponse.text()) as RawSourceMap
    let consumer = new SourceMapConsumer(sourceMap)
    let generated = getLineAndColumn(compiledCode, 'console')
    let original = consumer.originalPositionFor(generated)

    assert.equal(original.line, 1)
    assert.equal(original.column, 19)
  })

  it('preserves quoted dynamic import specifiers when rewriting URLs', async () => {
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    await write(
      dir,
      'app/entry.ts',
      'export let load = () => import("./dep.ts").then((mod) => mod.dep)',
    )
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\("\/assets\/app\/dep\.@[A-Za-z0-9_-]+\.ts"\)/)
  })

  it('rewrites static template-literal dynamic imports', async () => {
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    await write(
      dir,
      'app/entry.ts',
      'export let load = () => import(`./dep.ts`).then((mod) => mod.dep)',
    )
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\((["`])\/assets\/app\/dep\.@[A-Za-z0-9_-]+\.ts\1\)/)
  })

  it('rewrites re-exported package specifiers', async () => {
    await writeJson(dir, 'app/node_modules/example/package.json', {
      name: 'example',
      type: 'module',
      exports: './index.ts',
    })
    await write(dir, 'app/node_modules/example/index.ts', 'export const value = 1')
    await write(dir, 'app/bridge.ts', 'export * from "example"')
    let assetServer = createTestServer(dir)

    let response = await getByFile(assetServer, 'app/bridge.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /export \* from "\/assets\/app\/node_modules\/example\/index\.ts"/)
  })

  it('leaves variable dynamic imports unchanged', async () => {
    await write(dir, 'app/entry.ts', 'export let load = (specifier) => import(specifier)')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\(specifier\)/)
  })

  it('leaves interpolated template-literal dynamic imports unchanged', async () => {
    await write(
      dir,
      'app/entry.ts',
      'export let load = (name) => import(`./${name}.ts`).then((mod) => mod.value)',
    )
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\(`\.\/\$\{name\}\.ts`\)/)
  })

  it('leaves concatenated dynamic imports unchanged', async () => {
    await write(
      dir,
      'app/entry.ts',
      'export let load = (fileName) => import("./" + fileName).then((mod) => mod.value)',
    )
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\("\.\/" \+ fileName\)/)
  })

  it('updates source map mappings for rewritten dynamic imports', async () => {
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    await write(
      dir,
      'app/entry.ts',
      'export let load = () => import("./dep.ts").then((mod) => mod.dep)',
    )
    let assetServer = createTestServer(dir, {
      fingerprint: { buildId: 'build' },
      scripts: {
        sourceMaps: 'external',
      },
    })

    let entryResponse = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(entryResponse)
    let compiledCode = await entryResponse.text()

    let sourceMapResponse = await get(
      assetServer,
      `${await assetServer.getHref('app/entry.ts')}.map`,
    )
    assert.ok(sourceMapResponse)
    let sourceMap = JSON.parse(await sourceMapResponse.text()) as RawSourceMap
    let consumer = new SourceMapConsumer(sourceMap)

    let rewrittenImport = getLineAndColumn(compiledCode, '/assets/app/dep.@')
    let originalImport = consumer.originalPositionFor(rewrittenImport)
    assert.equal(originalImport.line, 1)
    assert.equal(originalImport.column, 31)

    let generatedThen = getLineAndColumn(compiledCode, 'then')
    let originalThen = consumer.originalPositionFor(generatedThen)
    assert.equal(originalThen.line, 1)
    assert.equal(originalThen.column, 43)
  })

  it('keeps source map mappings character-accurate with minify enabled', async () => {
    await assertCharacterAccurateImportRewriteSourceMap(dir)
  })

  it('supports HEAD requests for source map URLs', async () => {
    await write(dir, 'app/entry.ts', 'export const entry: number = 1')
    let assetServer = createTestServer(dir, {
      scripts: {
        sourceMaps: 'external',
      },
    })

    let response = await head(assetServer, '/assets/app/entry.ts.map')
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), '')
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8')
  })

  it('leaves configured external imports unchanged', async () => {
    await write(
      dir,
      'app/entry.ts',
      'import { css } from "@remix-run/component"\nexport const button = css({ color: "red" })',
    )
    let assetServer = createTestServer(dir, {
      scripts: {
        external: ['@remix-run/component'],
      },
    })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()
    assert.match(body, /from "@remix-run\/component"/)
  })

  it('leaves data and http(s) URL imports unchanged', async () => {
    await write(
      dir,
      'app/entry.ts',
      [
        'import "data:text/javascript,export default 1"',
        'import "http://example.com/script.js"',
        'import "https://example.com/script.js"',
        'export const entry = true',
      ].join('\n'),
    )
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import "data:text\/javascript,export default 1"/)
    assert.match(body, /import "http:\/\/example\.com\/script\.js"/)
    assert.match(body, /import "https:\/\/example\.com\/script\.js"/)
  })

  it('uses canonical realpaths for module identity when imports go through symlinks', async () => {
    await write(dir, 'app/shared/value.ts', 'export const value = true')
    await fs.mkdir(path.join(dir, 'app/alias'), { recursive: true })
    await fs.rm(path.join(dir, 'app/alias/value.ts'), { force: true })
    await fs.symlink(path.join(dir, 'app/shared/value.ts'), path.join(dir, 'app/alias/value.ts'))
    await write(dir, 'app/entry.ts', 'import { value } from "./alias/value.ts"\nexport { value }')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await getByFile(assetServer, 'app/entry.ts')
    assert.ok(response)
    let body = await response.text()
    assert.ok(body.includes('/assets/app/shared/value.@'))
    assert.ok(!body.includes('/assets/app/alias/value.@'))
  })

  it('getHref returns fingerprinted URLs for served module files when fingerprinting is enabled', async () => {
    await write(dir, 'app/entry.ts', 'export const entry = true')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    assert.match(
      await assetServer.getHref('app/entry.ts'),
      /\/assets\/app\/entry\.@[A-Za-z0-9_-]+\.ts/,
    )
    assert.match(
      await assetServer.getHref(path.join(dir, 'app/entry.ts')),
      /\/assets\/app\/entry\.@[A-Za-z0-9_-]+\.ts/,
    )
    assert.match(
      await assetServer.getHref(new URL(`file://${path.join(dir, 'app/entry.ts')}`).href),
      /\/assets\/app\/entry\.@[A-Za-z0-9_-]+\.ts/,
    )
  })

  it('getPreloads is file-oriented and returns the fingerprinted root href first', async () => {
    await write(dir, 'app/entry.ts', 'import "./a.ts"\nimport "./b.ts"\nexport const entry = true')
    await write(dir, 'app/a.ts', 'import "./c.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')
    await write(dir, 'app/c.ts', 'export const c = true')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let urls = await assetServer.getPreloads('app/entry.ts')
    assert.match(urls[0] ?? '', /\/assets\/app\/entry\.@[A-Za-z0-9_-]+\.ts/)
    assert.match(urls[1], /\/assets\/app\/a\.@[A-Za-z0-9_-]+\.ts/)
    assert.match(urls[2], /\/assets\/app\/b\.@[A-Za-z0-9_-]+\.ts/)
    assert.match(urls[3], /\/assets\/app\/c\.@[A-Za-z0-9_-]+\.ts/)
  })

  it('getPreloads accepts arbitrary file roots', async () => {
    await write(dir, 'app/entry.ts', 'import "./a.ts"\nexport const entry = true')
    await write(dir, 'app/a.ts', 'import "./b.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let urls = await assetServer.getPreloads('app/a.ts')
    assert.match(urls[0] ?? '', /\/assets\/app\/a\.@[A-Za-z0-9_-]+\.ts/)
    assert.match(urls[1], /\/assets\/app\/b\.@[A-Za-z0-9_-]+\.ts/)
  })

  it('getPreloads accepts multiple file paths and dedupes shared dependencies', async () => {
    await write(dir, 'app/a.ts', 'import "./shared.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'import "./shared.ts"\nexport const b = true')
    await write(dir, 'app/shared.ts', 'export const shared = true')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let urls = await assetServer.getPreloads(['app/a.ts', 'app/b.ts'])
    assert.match(urls[0] ?? '', /\/assets\/app\/a\.@[A-Za-z0-9_-]+\.ts/)
    assert.match(urls[1] ?? '', /\/assets\/app\/b\.@[A-Za-z0-9_-]+\.ts/)
    assert.equal(
      urls.filter((url) => /\/assets\/app\/shared\.@[A-Za-z0-9_-]+\.ts/.test(url)).length,
      1,
    )
    assert.match(urls[2] ?? '', /\/assets\/app\/shared\.@[A-Za-z0-9_-]+\.ts/)
  })

  it('getPreloads stays shallowest-first across multiple roots', async () => {
    await write(dir, 'app/a.ts', 'import "./a-1.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'import "./b-1.ts"\nexport const b = true')
    await write(dir, 'app/c.ts', 'import "./c-1.ts"\nexport const c = true')
    await write(dir, 'app/a-1.ts', 'import "./a-2.ts"\nexport const a1 = true')
    await write(dir, 'app/b-1.ts', 'import "./b-2.ts"\nexport const b1 = true')
    await write(dir, 'app/c-1.ts', 'import "./c-2.ts"\nexport const c1 = true')
    await write(dir, 'app/a-2.ts', 'export const a2 = true')
    await write(dir, 'app/b-2.ts', 'export const b2 = true')
    await write(dir, 'app/c-2.ts', 'export const c2 = true')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let urls = await assetServer.getPreloads(['app/a.ts', 'app/b.ts', 'app/c.ts'])

    assert.deepEqual(
      urls.map((url) => url.replace(/\.@[A-Za-z0-9_-]+(?=\.)/, '')),
      [
        '/assets/app/a.ts',
        '/assets/app/b.ts',
        '/assets/app/c.ts',
        '/assets/app/a-1.ts',
        '/assets/app/b-1.ts',
        '/assets/app/c-1.ts',
        '/assets/app/a-2.ts',
        '/assets/app/b-2.ts',
        '/assets/app/c-2.ts',
      ],
    )
  })

  it('getPreloads rejects module request URLs', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    await assert.rejects(
      () => assetServer.getPreloads('/assets/app/dep.@abc123.ts'),
      /Module not found:/,
    )
  })

  it('getPreloads rejects module request URLs in arrays', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')

    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    await assert.rejects(
      () => assetServer.getPreloads(['app/entry.ts', '/assets/app/dep.@abc123.ts']),
      /Module not found:/,
    )
  })

  it('getHref rejects modules outside configured routes', async () => {
    await write(dir, 'other.ts', 'export const value = 1')
    let assetServer = createTestServer(dir)

    await assert.rejects(() => assetServer.getHref('other.ts'), /Module is not allowed:/)
  })

  it('getPreloads rejects denied modules', async () => {
    await write(dir, 'app/entry.ts', 'export const entry = true')
    let assetServer = createAssetServerForTest({
      allow: ['app/**'],
      deny: ['app/entry.ts'],
      root: dir,
      routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
    })

    await assert.rejects(
      () => assetServer.getPreloads('app/entry.ts'),
      (error: unknown) => {
        assert.ok(isAssetServerCompilationError(error))
        assert.equal(error.code, 'MODULE_NOT_ALLOWED')
        assert.match(error.message, /Module is not allowed/)
        return true
      },
    )
  })

  it('getPreloads uses jsxImportSource inherited through tsconfig extends', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component',
        },
      })
      await writeJson(caseDir, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      })
      await write(
        caseDir,
        'app/node_modules/@remix-run/component/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("fragment")',
      )
      await write(caseDir, 'app/entry.tsx', 'export let entry = <div />')

      let assetServer = createTestServer(caseDir, {
        fingerprint: { buildId: 'build' },
      })

      let urls = await assetServer.getPreloads('app/entry.tsx')
      assert.ok(urls.some((url) => url.includes('@remix-run/component/jsx-runtime.@')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps cached tsconfig-driven transforms until the server restarts', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-a',
        },
      })
      await writeJson(caseDir, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      })
      await write(
        caseDir,
        'app/node_modules/@remix-run/component-a/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("a")',
      )
      await write(
        caseDir,
        'app/node_modules/@remix-run/component-b/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("b")',
      )
      await write(caseDir, 'app/entry.tsx', 'export let entry = <section />')

      let firstServer = createTestServer(caseDir)

      let before = await firstServer.getPreloads('app/entry.tsx')
      assert.ok(before.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
      assert.ok(!before.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))

      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-b',
        },
      })

      let sameServer = await firstServer.getPreloads('app/entry.tsx')
      assert.ok(sameServer.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
      assert.ok(!sameServer.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))

      let secondServer = createTestServer(caseDir)
      let afterRestart = await secondServer.getPreloads('app/entry.tsx')
      assert.ok(afterRestart.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))
      assert.ok(!afterRestart.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps tsconfig-driven imports stable within a fingerprinted build', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-a',
        },
      })
      await writeJson(caseDir, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      })
      await write(
        caseDir,
        'app/node_modules/@remix-run/component-a/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("a")',
      )
      await write(
        caseDir,
        'app/node_modules/@remix-run/component-b/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("b")',
      )
      await write(caseDir, 'app/entry.tsx', 'export let entry = <section />')

      let assetServer = createTestServer(caseDir, {
        fingerprint: { buildId: 'build' },
      })

      let before = await assetServer.getPreloads('app/entry.tsx')
      assert.ok(before.some((url) => url.includes('@remix-run/component-a/jsx-runtime.@')))
      assert.ok(!before.some((url) => url.includes('@remix-run/component-b/jsx-runtime.@')))

      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-b',
        },
      })

      let after = await assetServer.getPreloads('app/entry.tsx')
      assert.ok(after.some((url) => url.includes('@remix-run/component-a/jsx-runtime.@')))
      assert.ok(!after.some((url) => url.includes('@remix-run/component-b/jsx-runtime.@')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up extensionless import resolution changes after restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await fs.mkdir(path.join(caseDir, 'app/dep'), { recursive: true })
      await write(caseDir, 'app/dep/index.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let firstServer = createTestServer(caseDir)

      let before = await get(firstServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\/index\.js/)

      await fs.rm(path.join(caseDir, 'app/dep/index.js'))
      await write(caseDir, 'app/dep/index.ts', 'export const dep = "ts"')

      let secondServer = createTestServer(caseDir)
      let afterRestart = await get(secondServer, '/assets/app/entry.ts')
      assert.ok(afterRestart)
      let afterRestartBody = await afterRestart.text()
      assert.doesNotMatch(afterRestartBody, /\/assets\/app\/dep\/index\.js/)
      assert.match(afterRestartBody, /\/assets\/app\/dep\/index\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps cached extensionless import resolution stable until restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await fs.mkdir(path.join(caseDir, 'app/dep'), { recursive: true })
      await write(caseDir, 'app/dep/index.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let assetServer = createTestServer(caseDir)

      let before = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\/index\.js/)

      await fs.rm(path.join(caseDir, 'app/dep/index.js'))
      await write(caseDir, 'app/dep/index.ts', 'export const dep = "ts"')
      let after = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/assets\/app\/dep\/index\.js/)
      assert.doesNotMatch(afterBody, /\/assets\/app\/dep\/index\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up source changes in watch mode without restarting', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/entry.ts', 'export const value = 1')
      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let firstResponse = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(firstResponse)
        assert.match(await firstResponse.text(), /value = 1/)

        await write(caseDir, 'app/entry.ts', 'export const value = 2')

        let secondBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /value = 2/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(secondBody, /value = 2/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('recovers in watch mode when a previously missing import is created', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/entry.ts', 'import "./missing.ts"\nexport const entry = true')
      let assetServer = createWatchedTestServer(caseDir, {
        onError() {
          return
        },
      })

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        await assertInternalServerError(before)

        await write(caseDir, 'app/missing.ts', 'export const value = "ready"')

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            if (response.status !== 200) return await response.text()
            return response.text()
          },
          (body) => /\/assets\/app\/missing\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/missing\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('recovers in watch mode when a previously broken transform is fixed', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
      await write(caseDir, 'app/broken.ts', 'export const nope =')
      let errorCodes: string[] = []
      let assetServer = createWatchedTestServer(caseDir, {
        onError(error) {
          if (isAssetServerCompilationError(error)) {
            errorCodes.push(error.code)
          }
        },
      })

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        await assertInternalServerError(before)
        assert.equal(errorCodes.at(-1), 'MODULE_TRANSFORM_FAILED')

        await write(caseDir, 'app/broken.ts', 'export const nope = 1')

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/broken\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/broken\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps serving healthy modules while another module fails and recovers through multiple watch-mode errors', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
      await write(caseDir, 'app/healthy.ts', 'export const healthy = true')
      await write(caseDir, 'app/broken.ts', 'export const nope =')
      let errorCodes: string[] = []
      let assetServer = createWatchedTestServer(caseDir, {
        onError(error) {
          if (isAssetServerCompilationError(error)) {
            errorCodes.push(error.code)
          }
        },
      })

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let firstFailure = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(firstFailure)
        await assertInternalServerError(firstFailure)
        assert.equal(errorCodes.at(-1), 'MODULE_TRANSFORM_FAILED')

        let repeatedFailure = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(repeatedFailure)
        await assertInternalServerError(repeatedFailure)
        assert.equal(errorCodes.at(-1), 'MODULE_TRANSFORM_FAILED')

        let healthyResponse = await get(assetServer, '/assets/app/healthy.ts')
        assert.ok(healthyResponse)
        assert.equal(healthyResponse.status, 200)
        assert.match(await healthyResponse.text(), /healthy = true/)

        await write(caseDir, 'app/broken.ts', 'import "./missing.ts"\nexport const nope = true')

        await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            let body = await response.text()
            return {
              body,
              code: errorCodes.at(-1),
              status: response.status,
            }
          },
          (result) => result.status === 500 && result.code === 'IMPORT_RESOLUTION_FAILED',
          watchTestTimeoutMs,
        )

        await write(caseDir, 'app/missing.ts', 'export const missing = true')

        let recoveredBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/broken\.ts/.test(body) && /entry = true/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(recoveredBody, /\/assets\/app\/broken\.ts/)
        assert.ok(errorCodes.includes('MODULE_TRANSFORM_FAILED'))
        assert.ok(errorCodes.includes('IMPORT_RESOLUTION_FAILED'))
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up tsconfig-driven transform changes in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-a',
        },
      })
      await writeJson(caseDir, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      })
      await write(
        caseDir,
        'app/node_modules/@remix-run/component-a/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("a")',
      )
      await write(
        caseDir,
        'app/node_modules/@remix-run/component-b/jsx-runtime.ts',
        'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("b")',
      )
      await write(caseDir, 'app/entry.tsx', 'export let entry = <section />')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await assetServer.getPreloads('app/entry.tsx')
        assert.ok(before.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))

        await writeJson(caseDir, 'tsconfig.base.json', {
          compilerOptions: {
            jsx: 'react-jsx',
            jsxImportSource: '@remix-run/component-b',
          },
        })

        let after = await waitFor(
          async () => assetServer.getPreloads('app/entry.tsx'),
          (urls) => urls.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')),
          watchTestTimeoutMs,
        )

        assert.ok(after.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))
        assert.ok(!after.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up tsconfig paths resolution changes in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'tsconfig.json', {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '#dep': ['./app/dep-a.ts'],
          },
        },
      })
      await write(caseDir, 'app/dep-a.ts', 'export const dep = "a"')
      await write(caseDir, 'app/dep-b.ts', 'export const dep = "b"')
      await write(caseDir, 'app/entry.ts', 'import { dep } from "#dep"\nexport { dep }')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/dep-a\.ts/)

        await writeJson(caseDir, 'tsconfig.json', {
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '#dep': ['./app/dep-b.ts'],
            },
          },
        })

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/dep-b\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/dep-b\.ts/)
        assert.doesNotMatch(afterBody, /\/assets\/app\/dep-a\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up package resolution changes in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await writeJson(caseDir, 'app/node_modules/example/package.json', {
        exports: {
          '.': './a.ts',
        },
        name: 'example',
      })
      await write(caseDir, 'app/node_modules/example/a.ts', 'export const value = "a"')
      await write(caseDir, 'app/node_modules/example/b.ts', 'export const value = "b"')
      await write(caseDir, 'app/entry.ts', 'import { value } from "example"\nexport { value }')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let firstResponse = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(firstResponse)
        assert.match(await firstResponse.text(), /example\/a\.ts/)

        await writeJson(caseDir, 'app/node_modules/example/package.json', {
          exports: {
            '.': './b.ts',
          },
          name: 'example',
        })

        let secondBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /example\/b\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(secondBody, /example\/b\.ts/)
        assert.doesNotMatch(secondBody, /example\/a\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('switches extensionless imports to a higher-priority file in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/dep\.js/)

        await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/dep\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/dep\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('falls back to the next valid extensionless candidate in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.js', 'export const dep = "js"')
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/dep\.ts/)

        await fs.rm(path.join(caseDir, 'app/dep.ts'))

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/dep\.js/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/dep\.js/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('stops invalidating caches after close is called in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/entry.ts', 'export const value = 1')
      let assetServer = createWatchedTestServer(caseDir)

      await waitForWatchedTestServerReady(assetServer, caseDir)

      let firstResponse = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(firstResponse)
      assert.match(await firstResponse.text(), /value = 1/)

      await assetServer.close()
      await write(caseDir, 'app/entry.ts', 'export const value = 2')
      await sleep(100)

      let secondResponse = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(secondResponse)
      assert.match(await secondResponse.text(), /value = 1/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps extensionless import resolution stable within a fingerprinted build', async () => {
    let caseDir = await makeTmpDir()
    try {
      await fs.mkdir(path.join(caseDir, 'app/dep'), { recursive: true })
      await write(caseDir, 'app/dep/index.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let assetServer = createTestServer(caseDir, {
        fingerprint: { buildId: 'build' },
      })

      let before = await getByFile(assetServer, 'app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\/index\.@[A-Za-z0-9_-]+\.js/)

      await fs.rm(path.join(caseDir, 'app/dep/index.js'))
      await write(caseDir, 'app/dep/index.ts', 'export const dep = "ts"')

      let after = await getByFile(assetServer, 'app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/assets\/app\/dep\/index\.@[A-Za-z0-9_-]+\.js/)
      assert.doesNotMatch(afterBody, /\/assets\/app\/dep\/index\.@[A-Za-z0-9_-]+\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up dotted extensionless import resolution changes after restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/styles.css.js', 'export const styles = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./styles.css"\nexport const entry = true')

      let firstServer = createTestServer(caseDir)

      let before = await get(firstServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/styles\.css\.js/)

      await fs.rm(path.join(caseDir, 'app/styles.css.js'))
      await write(caseDir, 'app/styles.css.ts', 'export const styles = "ts"')

      let secondServer = createTestServer(caseDir)
      let afterRestart = await get(secondServer, '/assets/app/entry.ts')
      assert.ok(afterRestart)
      let afterRestartBody = await afterRestart.text()
      assert.doesNotMatch(afterRestartBody, /\/assets\/app\/styles\.css\.js/)
      assert.match(afterRestartBody, /\/assets\/app\/styles\.css\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps cached dotted extensionless import resolution stable until restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/styles.css.js', 'export const styles = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./styles.css"\nexport const entry = true')

      let assetServer = createTestServer(caseDir)

      let before = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/styles\.css\.js/)

      await fs.rm(path.join(caseDir, 'app/styles.css.js'))
      await write(caseDir, 'app/styles.css.ts', 'export const styles = "ts"')

      let after = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/assets\/app\/styles\.css\.js/)
      assert.doesNotMatch(afterBody, /\/assets\/app\/styles\.css\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('switches dotted extensionless imports to a higher-priority file in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/styles.css.js', 'export const styles = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./styles.css"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/styles\.css\.js/)

        await write(caseDir, 'app/styles.css.ts', 'export const styles = "ts"')

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/styles\.css\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/styles\.css\.ts/)
        assert.doesNotMatch(afterBody, /\/assets\/app\/styles\.css\.js/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('falls back to the next valid dotted extensionless candidate in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/styles.css.js', 'export const styles = "js"')
      await write(caseDir, 'app/styles.css.ts', 'export const styles = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./styles.css"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/styles\.css\.ts/)

        await fs.rm(path.join(caseDir, 'app/styles.css.ts'))

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/styles\.css\.js/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/styles\.css\.js/)
        assert.doesNotMatch(afterBody, /\/assets\/app\/styles\.css\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps dotted extensionless import resolution stable within a fingerprinted build', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/styles.css.js', 'export const styles = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./styles.css"\nexport const entry = true')

      let assetServer = createTestServer(caseDir, {
        fingerprint: { buildId: 'build' },
      })

      let before = await getByFile(assetServer, 'app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/styles\.css\.@[A-Za-z0-9_-]+\.js/)

      await fs.rm(path.join(caseDir, 'app/styles.css.js'))
      await write(caseDir, 'app/styles.css.ts', 'export const styles = "ts"')

      let after = await getByFile(assetServer, 'app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/assets\/app\/styles\.css\.@[A-Za-z0-9_-]+\.js/)
      assert.doesNotMatch(afterBody, /\/assets\/app\/styles\.css\.@[A-Za-z0-9_-]+\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up aliased import resolution changes after restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let firstServer = createTestServer(caseDir)

      let before = await get(firstServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\.ts/)

      await write(caseDir, 'app/dep.js', 'export const dep = "js"')

      let secondServer = createTestServer(caseDir)
      let afterRestart = await get(secondServer, '/assets/app/entry.ts')
      assert.ok(afterRestart)
      let afterRestartBody = await afterRestart.text()
      assert.doesNotMatch(afterRestartBody, /\/assets\/app\/dep\.ts/)
      assert.match(afterRestartBody, /\/assets\/app\/dep\.js/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up aliased directory resolution changes after restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let firstServer = createTestServer(caseDir)

      let before = await get(firstServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\.ts/)

      await fs.rm(path.join(caseDir, 'app/dep.ts'))
      await write(caseDir, 'app/dep.js/index.js', 'export const dep = "dir"')

      let secondServer = createTestServer(caseDir)
      let afterRestart = await get(secondServer, '/assets/app/entry.ts')
      assert.ok(afterRestart)
      let afterRestartBody = await afterRestart.text()
      assert.doesNotMatch(afterRestartBody, /\/assets\/app\/dep\.ts/)
      assert.match(afterRestartBody, /\/assets\/app\/dep\.js\/index\.js/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps cached aliased import resolution stable until restart', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let assetServer = createTestServer(caseDir)

      let before = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\.ts/)

      await write(caseDir, 'app/dep.js', 'export const dep = "js"')

      let after = await get(assetServer, '/assets/app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/assets\/app\/dep\.ts/)
      assert.doesNotMatch(afterBody, /\/assets\/app\/dep\.js/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('switches aliased imports to an exact-match file in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/dep\.ts/)

        await write(caseDir, 'app/dep.js', 'export const dep = "js"')

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/dep\.js/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/dep\.js/)
        assert.doesNotMatch(afterBody, /\/assets\/app\/dep\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('falls back to the next valid aliased candidate in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/dep.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/dep\.js/)

        await fs.rm(path.join(caseDir, 'app/dep.js'))

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/dep\.ts/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/dep\.ts/)
        assert.doesNotMatch(afterBody, /\/assets\/app\/dep\.js/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('falls back to an aliased directory candidate in watch mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let assetServer = createWatchedTestServer(caseDir)

      try {
        await waitForWatchedTestServerReady(assetServer, caseDir)

        let before = await get(assetServer, '/assets/app/entry.ts')
        assert.ok(before)
        assert.match(await before.text(), /\/assets\/app\/dep\.ts/)

        await fs.rm(path.join(caseDir, 'app/dep.ts'))
        await write(caseDir, 'app/dep.js/index.js', 'export const dep = "dir"')

        let afterBody = await waitFor(
          async () => {
            let response = await get(assetServer, '/assets/app/entry.ts')
            assert.ok(response)
            return response.text()
          },
          (body) => /\/assets\/app\/dep\.js\/index\.js/.test(body),
          watchTestTimeoutMs,
        )

        assert.match(afterBody, /\/assets\/app\/dep\.js\/index\.js/)
        assert.doesNotMatch(afterBody, /\/assets\/app\/dep\.ts/)
      } finally {
        await assetServer.close()
      }
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps aliased import resolution stable within a fingerprinted build', async () => {
    let caseDir = await makeTmpDir()
    try {
      await write(caseDir, 'app/dep.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep.js"\nexport const entry = true')

      let assetServer = createTestServer(caseDir, {
        fingerprint: { buildId: 'build' },
      })

      let before = await getByFile(assetServer, 'app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/assets\/app\/dep\.@[A-Za-z0-9_-]+\.ts/)

      await write(caseDir, 'app/dep.js', 'export const dep = "js"')

      let after = await getByFile(assetServer, 'app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/assets\/app\/dep\.@[A-Za-z0-9_-]+\.ts/)
      assert.doesNotMatch(afterBody, /\/assets\/app\/dep\.@[A-Za-z0-9_-]+\.js/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('supports absolute entry-point patterns', async () => {
    let entryPath = await write(dir, 'app/entry-abs.ts', 'export const abs = true')
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })

    let response = await get(assetServer, await assetServer.getHref(entryPath))
    assert.ok(response)
    assert.equal(response.status, 200)
  })

  it('does not require separate entry-point configuration when fingerprinting', async () => {
    let assetServer = createTestServer(dir, { fingerprint: { buildId: 'build' } })
    assert.ok(assetServer)
  })

  it('rethrows unexpected realpath errors for exact file matchers', async () => {
    assert.throws(
      () =>
        createAssetServerForTest({
          allow: ['app/\0allowed-realpath.ts'],
          root: dir,
          routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
        }),
      { code: 'ERR_INVALID_ARG_VALUE' },
    )
  })

  it('rejects absolute file patterns', async () => {
    await write(dir, 'app/entry.ts', 'export const abs = true')
    assert.throws(
      () =>
        createAssetServerForTest({
          allow: [path.join(dir, 'app')],
          root: dir,
          routes: [
            {
              urlPattern: '/assets/app/*path',
              filePattern: `${path.join(dir, 'app')}/*path`,
            },
          ],
          fingerprint: { buildId: 'build' },
        }),
      /must be relative to the asset server root/,
    )
  })

  it('supports absolute allow rules and deny overrides', async () => {
    let allowedPath = await write(dir, 'app/allowed.ts', 'export const allowed = true')
    await write(dir, 'app/blocked.ts', 'export const blocked = true')
    await write(dir, 'app/.hidden.ts', 'export const hidden = true')
    let assetServer = createAssetServerForTest({
      allow: [allowedPath, path.join(dir, 'app')],
      deny: [path.join(dir, 'app/blocked.ts')],
      root: dir,
      routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
    })

    let allowedResponse = await get(assetServer, '/assets/app/allowed.ts')
    let blockedResponse = await get(assetServer, '/assets/app/blocked.ts')
    let hiddenResponse = await get(assetServer, '/assets/app/.hidden.ts')
    assert.ok(allowedResponse)
    assert.equal(allowedResponse.status, 200)
    assert.equal(blockedResponse, null)
    assert.ok(hiddenResponse)
    assert.equal(hiddenResponse.status, 200)
  })

  it('rejects unnamed route wildcards because routes must be reversible', async () => {
    assert.throws(
      () =>
        createAssetServerForTest({
          allow: ['app/**'],
          root: dir,
          routes: [{ urlPattern: '/assets/app/*', filePattern: 'app/*path' }],
        }),
      /must use named wildcards/,
    )
  })

  it('supports glob-style allow and deny rules', async () => {
    await write(dir, 'app/features/allowed.ts', 'export const allowed = true')
    await write(dir, 'app/features/private/blocked.ts', 'export const blocked = true')
    let assetServer = createAssetServerForTest({
      allow: ['app/**/*.ts'],
      deny: ['app/**/private/**'],
      root: dir,
      routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
    })

    let allowedResponse = await get(assetServer, '/assets/app/features/allowed.ts')
    let blockedResponse = await get(assetServer, '/assets/app/features/private/blocked.ts')
    assert.ok(allowedResponse)
    assert.equal(allowedResponse.status, 200)
    assert.equal(blockedResponse, null)
  })

  it('does not call onError for denied direct requests', async () => {
    await write(dir, 'app/blocked.ts', 'export const blocked = true')
    let receivedError: unknown
    let assetServer = createAssetServerForTest({
      allow: ['app/**'],
      deny: ['app/blocked.ts'],
      root: dir,
      routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/blocked.ts')
    assert.equal(response, null)
    assert.equal(receivedError, undefined)
  })

  it('minifies output when requested', async () => {
    await write(
      dir,
      'app/entry.ts',
      'export function greet(name: string) {\n  return "Hello " + name\n}\n',
    )
    let assetServer = createTestServer(dir, { scripts: { minify: true } })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    let body = await response.text()
    assert.ok(body.length < 60, `expected minified output, got:\n${body}`)
  })

  it('lowers syntax to the configured ECMAScript target', async () => {
    await write(
      dir,
      'app/entry.ts',
      'const data: { nested?: number } | null = { nested: 1 }\nexport let value = data?.nested ?? 0\n',
    )
    let assetServer = createTestServer(dir, {
      scripts: {
        minify: true,
        target: 'es2019',
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    // ?? and ?. are not supported by the specified target
    assert.doesNotMatch(body, /\?\?|\?\./)
    assert.match(body, /void 0/)
  })

  it('does not inherit target from tsconfig', async () => {
    await writeJson(dir, 'app/tsconfig.json', {
      compilerOptions: {
        target: 'es2019',
      },
    })
    await write(
      dir,
      'app/entry.ts',
      'const data: { nested?: number } | null = { nested: 1 }\nexport let value = data?.nested ?? 0\n',
    )
    let assetServer = createTestServer(dir)

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /\?\?/)
    assert.match(body, /\?\./)
  })

  describe('tsconfig transform support', () => {
    it('supports jsxImportSource with the automatic JSX runtime', async () => {
      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              jsx: 'react-jsx',
              jsxImportSource: '@remix-run/component',
            },
          },
          'app/node_modules/@remix-run/component/jsx-runtime.ts':
            'export function jsx() {}\nexport const jsxs = jsx\nexport const Fragment = Symbol.for("fragment")',
          'app/entry.tsx': 'export let entry = <div />',
        },
        async ({ assetServer }) => {
          let urls = await assetServer.getPreloads('app/entry.tsx')
          assert.ok(urls.some((url) => url.includes('@remix-run/component/jsx-runtime.ts')))
        },
      )
    })

    it('supports the react-jsxdev runtime', async () => {
      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              jsx: 'react-jsxdev',
            },
          },
          'app/node_modules/react/jsx-dev-runtime.ts':
            'export function jsxDEV() {}\nexport const Fragment = Symbol.for("fragment")',
          'app/entry.tsx': 'export let entry = <div />',
        },
        async ({ assetServer }) => {
          let urls = await assetServer.getPreloads('app/entry.tsx')
          assert.ok(urls.some((url) => url.includes('react/jsx-dev-runtime.ts')))
        },
      )
    })

    it('supports classic JSX pragma options', async () => {
      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              jsxFactory: 'h',
              jsxFragmentFactory: 'Fragment',
            },
          },
          'app/entry.tsx': 'export let entry = <><span /></>',
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.tsx')
          assert.ok(response)
          assert.equal(response.status, 200)

          let body = await response.text()
          assert.match(body, /\bh\(/)
          assert.match(body, /\bFragment\b/)
          assert.doesNotMatch(body, /jsx-runtime/)
        },
      )
    })

    it('rejects unsupported JSX preserve mode', async () => {
      let receivedError: unknown

      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              jsx: 'preserve',
            },
          },
          'app/entry.tsx': 'export let entry = <div />',
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.tsx')
          assert.ok(response)
          await assertInternalServerError(response)
        },
        {
          onError(error) {
            receivedError = error
          },
        },
      )

      assert.ok(isAssetServerCompilationError(receivedError))
      assert.equal(receivedError.code, 'MODULE_TRANSFORM_FAILED')
      assert.match(receivedError.message, /compilerOptions\.jsx = "preserve"/)
    })

    it('supports namespaces and respects allowNamespaces when it is disabled', async () => {
      let source = 'namespace Example { export const value = 1 }\nexport let result = Example.value'
      let receivedError: unknown

      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              allowNamespaces: false,
            },
          },
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          await assertInternalServerError(response)
        },
        {
          onError(error) {
            receivedError = error
          },
        },
      )

      assert.ok(isAssetServerCompilationError(receivedError))
      assert.equal(receivedError.code, 'MODULE_TRANSFORM_FAILED')

      await withTsconfigTransformCase(
        {
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)
          assert.match(await response.text(), /Example/)
        },
      )
    })

    it('passes experimentalDecorators through to Oxc', async () => {
      let source =
        'function applyExampleDecorator(value) { return value }\n' +
        '@applyExampleDecorator\n' +
        'export class Example {}'
      let withoutDecoratorsBody = ''
      let decorateHelperSpecifier = '@oxc-project/runtime/helpers/decorate'

      await withTsconfigTransformCase(
        {
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)
          withoutDecoratorsBody = await response.text()
          assert.match(withoutDecoratorsBody, /@applyExampleDecorator/)
        },
        {
          scripts: {
            external: [decorateHelperSpecifier],
          },
        },
      )

      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              experimentalDecorators: true,
            },
          },
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)

          let body = await response.text()
          assert.doesNotMatch(body, /@applyExampleDecorator/)
          assert.match(body, /applyExampleDecorator/)
        },
        {
          scripts: {
            external: [decorateHelperSpecifier],
          },
        },
      )
    })

    it('emits decorator metadata only when tsconfig enables it', async () => {
      let source = [
        'function dec(value) { return value }',
        'function meta(...args) { return args }',
        '@dec',
        'export class Example {',
        '  @meta',
        '  method(value) { return value }',
        '}',
      ].join('\n')
      let withoutMetadataBody = ''
      let withMetadataBody = ''
      let decorateHelperSpecifier = '@oxc-project/runtime/helpers/decorate'
      let decorateMetadataHelperSpecifier = '@oxc-project/runtime/helpers/decorateMetadata'

      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              experimentalDecorators: true,
            },
          },
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)
          withoutMetadataBody = await response.text()
        },
        {
          scripts: {
            external: [decorateHelperSpecifier, decorateMetadataHelperSpecifier],
          },
        },
      )

      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              emitDecoratorMetadata: true,
              experimentalDecorators: true,
            },
          },
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)
          withMetadataBody = await response.text()
        },
        {
          scripts: {
            external: [decorateHelperSpecifier, decorateMetadataHelperSpecifier],
          },
        },
      )

      assert.doesNotMatch(withoutMetadataBody, /design:type/)
      assert.doesNotMatch(withoutMetadataBody, /design:paramtypes/)
      assert.doesNotMatch(withoutMetadataBody, /design:returntype/)
      assert.match(withMetadataBody, /design:type/)
      assert.match(withMetadataBody, /design:paramtypes/)
      assert.match(withMetadataBody, /design:returntype/)
    })

    it('supports useDefineForClassFields false when lowering class fields', async () => {
      let source = [
        'class Base {',
        '  set value(next) {',
        '    globalThis.setterCalls = (globalThis.setterCalls ?? 0) + next',
        '  }',
        '}',
        'export class Derived extends Base {',
        '  value = 1',
        '  declared: number',
        '}',
      ].join('\n')
      let defaultBody = ''
      let assignBody = ''
      let definePropertyHelperSpecifier = '@oxc-project/runtime/helpers/defineProperty'

      await withTsconfigTransformCase(
        {
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)
          defaultBody = await response.text()
        },
        {
          scripts: {
            external: [definePropertyHelperSpecifier],
            target: 'es2015',
          },
        },
      )

      await withTsconfigTransformCase(
        {
          'tsconfig.json': {
            compilerOptions: {
              useDefineForClassFields: false,
            },
          },
          'app/entry.ts': source,
        },
        async ({ assetServer }) => {
          let response = await get(assetServer, '/assets/app/entry.ts')
          assert.ok(response)
          assert.equal(response.status, 200)
          assignBody = await response.text()
        },
        {
          scripts: {
            external: [definePropertyHelperSpecifier],
            target: 'es2015',
          },
        },
      )

      assert.doesNotMatch(defaultBody, /this\.value = 1/)
      assert.match(defaultBody, /["']value["']/)
      assert.match(defaultBody, /["']declared["']/)
      assert.match(assignBody, /this\.value = 1/)
      assert.doesNotMatch(assignBody, /declared/)
    })
  })

  it('rejects fingerprinting without a buildId string', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          fingerprint: {
            buildId: 123,
          } as unknown as FingerprintOptions,
        }),
      /fingerprint\.buildId must be a string/,
    )
  })

  it('rejects fingerprinting without a non-empty buildId', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          fingerprint: { buildId: '' },
        }),
      /fingerprint\.buildId must be a non-empty string/,
    )
  })

  it('rejects fingerprinting in watch mode', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createWatchedTestServer(dir, {
          fingerprint: { buildId: 'build' },
        }),
      /fingerprint cannot be used with watch mode/,
    )
  })

  it('calls onError for unexpected compilation failures', async () => {
    await write(dir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
    await write(dir, 'app/broken.ts', 'export const nope =')
    let receivedError: unknown
    let assetServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isAssetServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'MODULE_TRANSFORM_FAILED')
    assert.match(
      normalizeWindowsPath(receivedError.message),
      /Failed to transform module .*app\/broken\.ts/,
    )
  })

  it('calls onError for unsupported imported file types', async () => {
    await write(dir, 'app/entry.ts', 'import "./data.json"\nexport const entry = true')
    await write(dir, 'app/data.json', '{"ok":true}')
    let receivedError: unknown
    let assetServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isAssetServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_NOT_SUPPORTED')
    assert.match(receivedError.message, /not a supported script module/)
    assert.match(receivedError.message, /"\.\/data\.json"/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/entry\.ts/)
  })

  it('calls onError for import resolution failures', async () => {
    await write(dir, 'app/entry.ts', 'import "./missing.ts"\nexport const entry = true')
    let receivedError: unknown
    let assetServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isAssetServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_RESOLUTION_FAILED')
    assert.match(receivedError.message, /Failed to resolve import/)
    assert.match(receivedError.message, /"\.\/missing\.ts"/)
  })

  it('calls onError for CommonJS modules', async () => {
    await write(dir, 'app/entry.ts', 'import "./legacy.js"\nexport const entry = true')
    await write(dir, 'app/dep.js', 'export const dep = true')
    await write(dir, 'app/legacy.js', 'let x = require("./dep.js")\nexport { x }')
    let receivedError: unknown
    let assetServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isAssetServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'MODULE_COMMONJS_NOT_SUPPORTED')
    assert.match(receivedError.message, /CommonJS module detected/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/legacy\.js/)
  })

  it('calls onError for disallowed imported modules', async () => {
    await write(dir, 'app/entry.ts', 'import "../secret.ts"\nexport const entry = true')
    await write(dir, 'secret.ts', 'export const secret = true')
    let receivedError: unknown
    let assetServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isAssetServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_NOT_ALLOWED')
    assert.match(receivedError.message, /not allowed by the asset server allow\/deny configuration/)
    assert.match(receivedError.message, /"\.\.\/secret\.ts"/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/entry\.ts/)
  })

  it('calls onError when an imported module is allowed but not routed', async () => {
    await write(dir, 'app/entry.ts', 'import "../shared/util.ts"\nexport const entry = util')
    await write(dir, 'shared/util.ts', 'export const util = true')
    let receivedError: unknown
    let assetServer = createTestServer(dir, {
      allow: ['app/**', 'shared/**'],
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isAssetServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_NOT_ROUTED')
    assert.match(receivedError.message, /not covered by any configured asset server route/)
    assert.match(receivedError.message, /"\.\.\/shared\/util\.ts"/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/entry\.ts/)
  })

  it('uses a custom response returned from onError', async () => {
    await write(dir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
    await write(dir, 'app/broken.ts', 'export const nope =')
    let assetServer = createTestServer(dir, {
      onError() {
        return new Response('Custom build error', { status: 418 })
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    assert.equal(response.status, 418)
    assert.equal(await response.text(), 'Custom build error')
  })

  it('falls back to the default 500 when onError throws', async () => {
    await write(dir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
    await write(dir, 'app/broken.ts', 'export const nope =')
    let assetServer = createTestServer(dir, {
      onError() {
        throw new Error('error handler failed')
      },
    })

    let response = await get(assetServer, '/assets/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
  })
})
