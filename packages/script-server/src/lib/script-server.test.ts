import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as nodeFs from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { RawSourceMap } from 'source-map-js'
import { SourceMapConsumer } from 'source-map-js'
import { isScriptServerCompilationError } from './compilation-error.ts'
import { normalizeWindowsPath } from './paths.ts'
import type { CacheStrategyOptions } from './script-server.ts'

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

function createTestServer(
  root: string,
  overrides: Partial<Parameters<typeof createScriptServer>[0]> = {},
) {
  return createScriptServer({
    allow: ['app/**', 'app/node_modules/**'],
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

function sourceCacheStrategy(
  buildId = 'build',
  entryPoints: readonly string[] | undefined = ['app/entry.ts'],
): CacheStrategyOptions {
  return {
    fingerprint: 'source',
    buildId,
    entryPoints,
  }
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

  it('does not match a stripped weak ETag prefix in If-None-Match', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let scriptServer = createTestServer(dir)

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)

    let notModified = await get(scriptServer, '/scripts/app/entry.ts', {
      'If-None-Match': response.headers.get('ETag')!.replace(/^W\//, ''),
    })
    assert.ok(notModified)
    assert.equal(notModified.status, 200)
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
      cacheStrategy: sourceCacheStrategy('build', ['app/entry.mts']),
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

  it('uses immutable caching for fingerprinted modules only', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let entryBody = await entryResponse.text()
    let depMatch = entryBody.match(/\/scripts\/app\/dep\.ts\.@([A-Za-z0-9_-]+)/)
    assert.ok(depMatch)

    let depResponse = await get(scriptServer, `/scripts/app/dep.ts.@${depMatch[1]}`)
    assert.ok(depResponse)
    assert.equal(entryResponse.headers.get('Cache-Control'), 'no-cache')
    assert.equal(depResponse.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
  })

  it('fingerprints internal modules with .@fingerprint URLs and returns null on mismatch', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let body = await entryResponse.text()
    let match = body.match(/\/scripts\/app\/dep\.ts\.@([A-Za-z0-9_-]+)/)
    assert.ok(match, `expected fingerprinted dep import, got:\n${body}`)

    let depResponse = await get(scriptServer, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depResponse)
    assert.equal(depResponse.status, 200)
    assert.ok(depResponse.headers.get('ETag'))

    let nonFingerprinted = await get(scriptServer, '/scripts/app/dep.ts')
    assert.equal(nonFingerprinted, null)

    let mismatch = await get(scriptServer, '/scripts/app/dep.ts.@wronghash')
    assert.equal(mismatch, null)
  })

  it('keeps fingerprinted module graphs stable within a build', async () => {
    await write(dir, 'app/entry.ts', 'import "./mid.ts"\nexport const entry = true')
    await write(dir, 'app/mid.ts', 'import "./leaf.ts"\nexport const mid = true')
    await write(dir, 'app/leaf.ts', 'export const leaf = 1')

    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let before = await scriptServer.preloads('/scripts/app/entry.ts')
    let beforeMid = before.find((url) => url.includes('/scripts/app/mid.ts.@'))
    let beforeLeaf = before.find((url) => url.includes('/scripts/app/leaf.ts.@'))

    await write(dir, 'app/leaf.ts', 'export const leaf = 2')

    let after = await scriptServer.preloads('/scripts/app/entry.ts')
    let afterMid = after.find((url) => url.includes('/scripts/app/mid.ts.@'))
    let afterLeaf = after.find((url) => url.includes('/scripts/app/leaf.ts.@'))

    assert.equal(afterMid, beforeMid)
    assert.equal(afterLeaf, beforeLeaf)
  })

  it('uses buildId to change internal fingerprints', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')

    let serverA = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy('build-a'),
    })
    let serverB = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy('build-b'),
    })

    let bodyA = await (await get(serverA, '/scripts/app/entry.ts'))!.text()
    let bodyB = await (await get(serverB, '/scripts/app/entry.ts'))!.text()
    let matchA = bodyA.match(/\/scripts\/app\/dep\.ts\.@([A-Za-z0-9_-]+)/)
    let matchB = bodyB.match(/\/scripts\/app\/dep\.ts\.@([A-Za-z0-9_-]+)/)

    assert.ok(matchA && matchB)
    assert.notEqual(matchA[1], matchB[1])
  })

  it('picks up source changes from disk when buildId is omitted', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    let scriptServer = createTestServer(dir)

    let firstResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(firstResponse)
    assert.match(await firstResponse.text(), /value = 1/)

    await write(dir, 'app/entry.ts', 'export const value = 2')

    let secondResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(secondResponse)
    assert.match(await secondResponse.text(), /value = 2/)
  })

  it('keeps live importer output stable when dependency contents change without changing resolution', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    let scriptServer = createTestServer(dir)

    let firstResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(firstResponse)
    let firstBody = await firstResponse.text()
    let firstEtag = firstResponse.headers.get('ETag')
    assert.ok(firstEtag)

    await write(dir, 'app/dep.ts', 'export const dep = 2')

    let secondResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(secondResponse)
    let secondBody = await secondResponse.text()
    let secondEtag = secondResponse.headers.get('ETag')

    assert.equal(secondBody, firstBody)
    assert.equal(secondEtag, firstEtag)
  })

  it('keeps entry-point imports stable even when entry points are also dependencies', async () => {
    await write(dir, 'app/a.ts', 'import "./b.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy('build', ['app/a.ts', 'app/b.ts']),
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
      cacheStrategy: sourceCacheStrategy(),
      sourceMaps: 'external',
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let entryBody = await entryResponse.text()
    assert.ok(entryBody.includes('//# sourceMappingURL=/scripts/app/entry.ts.map'))

    let depMatch = entryBody.match(/\/scripts\/app\/dep\.ts\.@([A-Za-z0-9_-]+)/)
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

  it('supports inline source maps with absolute source paths', async () => {
    let entryPath = await write(dir, 'app/entry.ts', 'export const entry: number = 1')
    let scriptServer = createTestServer(dir, {
      sourceMaps: 'inline',
      sourceMapSourcePaths: 'absolute',
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
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
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
      sourceMaps: 'external',
      minify: true,
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let compiledCode = await entryResponse.text()

    let sourceMapResponse = await get(scriptServer, '/scripts/app/entry.ts.map')
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
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\("\/scripts\/app\/dep\.ts\.@[A-Za-z0-9_-]+"\)/)
  })

  it('rewrites static template-literal dynamic imports', async () => {
    await write(dir, 'app/dep.ts', 'export const dep = 1')
    await write(
      dir,
      'app/entry.ts',
      'export let load = () => import(`./dep.ts`).then((mod) => mod.dep)',
    )
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    let body = await response.text()

    assert.match(body, /import\("\/scripts\/app\/dep\.ts\.@[A-Za-z0-9_-]+"\)/)
  })

  it('leaves variable dynamic imports unchanged', async () => {
    await write(dir, 'app/entry.ts', 'export let load = (specifier) => import(specifier)')
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
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
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
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
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
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
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
      sourceMaps: 'external',
    })

    let entryResponse = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(entryResponse)
    let compiledCode = await entryResponse.text()

    let sourceMapResponse = await get(scriptServer, '/scripts/app/entry.ts.map')
    assert.ok(sourceMapResponse)
    let sourceMap = JSON.parse(await sourceMapResponse.text()) as RawSourceMap
    let consumer = new SourceMapConsumer(sourceMap)

    let rewrittenImport = getLineAndColumn(compiledCode, '/scripts/app/dep.ts.@')
    let originalImport = consumer.originalPositionFor(rewrittenImport)
    assert.equal(originalImport.line, 1)
    assert.equal(originalImport.column, 31)

    let generatedThen = getLineAndColumn(compiledCode, 'then')
    let originalThen = consumer.originalPositionFor(generatedThen)
    assert.equal(originalThen.line, 1)
    assert.equal(originalThen.column, 43)
  })

  it('supports HEAD requests for source map URLs', async () => {
    await write(dir, 'app/entry.ts', 'export const entry: number = 1')
    let scriptServer = createTestServer(dir, {
      sourceMaps: 'external',
    })

    let response = await head(scriptServer, '/scripts/app/entry.ts.map')
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
    let scriptServer = createTestServer(dir, {
      external: ['@remix-run/component'],
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
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
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
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

    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
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
      cacheStrategy: sourceCacheStrategy(),
    })

    let urls = await scriptServer.preloads('/scripts/app/entry.ts')
    assert.equal(urls[0], '/scripts/app/entry.ts')
    assert.match(urls[1], /\/scripts\/app\/a\.ts\.@/)
    assert.match(urls[2], /\/scripts\/app\/b\.ts\.@/)
    assert.match(urls[3], /\/scripts\/app\/c\.ts\.@/)
  })

  it('preloads accepts stable non-fingerprinted URLs beyond configured entry points', async () => {
    await write(dir, 'app/entry.ts', 'import "./a.ts"\nexport const entry = true')
    await write(dir, 'app/a.ts', 'import "./b.ts"\nexport const a = true')
    await write(dir, 'app/b.ts', 'export const b = true')

    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy('build', ['app/entry.ts']),
    })

    let urls = await scriptServer.preloads('/scripts/app/a.ts')
    assert.match(urls[0], /\/scripts\/app\/a\.ts\.@/)
    assert.match(urls[1], /\/scripts\/app\/b\.ts\.@/)
  })

  it('preloads rejects fingerprinted module URLs', async () => {
    await write(dir, 'app/entry.ts', 'import "./dep.ts"\nexport const entry = true')
    await write(dir, 'app/dep.ts', 'export const dep = 1')

    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy(),
    })

    await assert.rejects(
      () => scriptServer.preloads('/scripts/app/dep.ts.@abc123'),
      /Preload URLs must use stable non-fingerprinted module paths/,
    )
  })

  it('preloads rejects module URLs outside configured routes', async () => {
    await write(dir, 'app/entry.ts', 'export const entry = true')
    let scriptServer = createTestServer(dir)

    await assert.rejects(
      () => scriptServer.preloads('/scripts/other/entry.ts'),
      (error: unknown) => {
        assert.ok(isScriptServerCompilationError(error))
        assert.equal(error.code, 'MODULE_OUTSIDE_ROUTES')
        assert.match(error.message, /outside all configured routes/)
        return true
      },
    )
  })

  it('preloads rejects denied modules', async () => {
    await write(dir, 'app/entry.ts', 'export const entry = true')
    let scriptServer = createScriptServer({
      allow: ['app/**'],
      deny: ['app/entry.ts'],
      root: dir,
      routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
    })

    await assert.rejects(
      () => scriptServer.preloads('/scripts/app/entry.ts'),
      (error: unknown) => {
        assert.ok(isScriptServerCompilationError(error))
        assert.equal(error.code, 'MODULE_NOT_ALLOWED')
        assert.match(error.message, /Module is not allowed/)
        return true
      },
    )
  })

  it('preloads uses jsxImportSource inherited through tsconfig extends', async () => {
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

      let scriptServer = createTestServer(caseDir, {
        cacheStrategy: sourceCacheStrategy('build', ['app/entry.tsx']),
      })

      let urls = await scriptServer.preloads('/scripts/app/entry.tsx')
      assert.ok(urls.some((url) => url.includes('@remix-run/component/jsx-runtime.ts.@')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps cached tsconfig-driven transforms until the live server restarts', async () => {
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

      let before = await firstServer.preloads('/scripts/app/entry.tsx')
      assert.ok(before.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
      assert.ok(!before.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))

      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-b',
        },
      })

      let sameServer = await firstServer.preloads('/scripts/app/entry.tsx')
      assert.ok(sameServer.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
      assert.ok(!sameServer.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))

      let secondServer = createTestServer(caseDir)
      let afterRestart = await secondServer.preloads('/scripts/app/entry.tsx')
      assert.ok(afterRestart.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts')))
      assert.ok(!afterRestart.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps tsconfig-driven imports stable within an immutable build', async () => {
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

      let scriptServer = createTestServer(caseDir, {
        cacheStrategy: sourceCacheStrategy('build', ['app/entry.tsx']),
      })

      let before = await scriptServer.preloads('/scripts/app/entry.tsx')
      assert.ok(before.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts.@')))
      assert.ok(!before.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts.@')))

      await writeJson(caseDir, 'tsconfig.base.json', {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component-b',
        },
      })

      let after = await scriptServer.preloads('/scripts/app/entry.tsx')
      assert.ok(after.some((url) => url.includes('@remix-run/component-a/jsx-runtime.ts.@')))
      assert.ok(!after.some((url) => url.includes('@remix-run/component-b/jsx-runtime.ts.@')))
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up extensionless import resolution changes after restart in live mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await fs.mkdir(path.join(caseDir, 'app/dep'), { recursive: true })
      await write(caseDir, 'app/dep/index.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let firstServer = createTestServer(caseDir)

      let before = await get(firstServer, '/scripts/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/scripts\/app\/dep\/index\.js/)

      await fs.rm(path.join(caseDir, 'app/dep/index.js'))
      await write(caseDir, 'app/dep/index.ts', 'export const dep = "ts"')

      let secondServer = createTestServer(caseDir)
      let afterRestart = await get(secondServer, '/scripts/app/entry.ts')
      assert.ok(afterRestart)
      let afterRestartBody = await afterRestart.text()
      assert.doesNotMatch(afterRestartBody, /\/scripts\/app\/dep\/index\.js/)
      assert.match(afterRestartBody, /\/scripts\/app\/dep\/index\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('picks up extensionless import resolution changes after importer edits in live mode', async () => {
    let caseDir = await makeTmpDir()
    try {
      await fs.mkdir(path.join(caseDir, 'app/dep'), { recursive: true })
      await write(caseDir, 'app/dep/index.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let scriptServer = createTestServer(caseDir)

      let before = await get(scriptServer, '/scripts/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/scripts\/app\/dep\/index\.js/)

      await fs.rm(path.join(caseDir, 'app/dep/index.js'))
      await write(caseDir, 'app/dep/index.ts', 'export const dep = "ts"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = "changed"')

      let after = await get(scriptServer, '/scripts/app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/scripts\/app\/dep\/index\.ts/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('keeps extensionless import resolution stable within an immutable build', async () => {
    let caseDir = await makeTmpDir()
    try {
      await fs.mkdir(path.join(caseDir, 'app/dep'), { recursive: true })
      await write(caseDir, 'app/dep/index.js', 'export const dep = "js"')
      await write(caseDir, 'app/entry.ts', 'import "./dep"\nexport const entry = true')

      let scriptServer = createTestServer(caseDir, {
        cacheStrategy: sourceCacheStrategy('build', ['app/entry.ts']),
      })

      let before = await get(scriptServer, '/scripts/app/entry.ts')
      assert.ok(before)
      assert.match(await before.text(), /\/scripts\/app\/dep\/index\.js\.@/)

      await fs.rm(path.join(caseDir, 'app/dep/index.js'))
      await write(caseDir, 'app/dep/index.ts', 'export const dep = "ts"')

      let after = await get(scriptServer, '/scripts/app/entry.ts')
      assert.ok(after)
      let afterBody = await after.text()
      assert.match(afterBody, /\/scripts\/app\/dep\/index\.js\.@/)
      assert.doesNotMatch(afterBody, /\/scripts\/app\/dep\/index\.ts\.@/)
    } finally {
      await fs.rm(caseDir, { recursive: true, force: true })
    }
  })

  it('supports absolute entry-point patterns', async () => {
    let entryPath = await write(dir, 'app/entry-abs.ts', 'export const abs = true')
    let scriptServer = createTestServer(dir, {
      cacheStrategy: sourceCacheStrategy('build', [entryPath]),
    })

    let response = await get(scriptServer, '/scripts/app/entry-abs.ts')
    assert.ok(response)
    assert.equal(response.status, 200)
  })

  it('rejects missing exact entry-point patterns', async () => {
    assert.throws(
      () =>
        createTestServer(dir, {
          cacheStrategy: sourceCacheStrategy('build', ['app/missing-entry.ts']),
        }),
      { code: 'ENOENT' },
    )
  })

  it('rethrows unexpected realpath errors for exact file matchers', async () => {
    assert.throws(
      () =>
        createScriptServer({
          allow: ['app/\0allowed-realpath.ts'],
          root: dir,
          routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
        }),
      { code: 'ERR_INVALID_ARG_VALUE' },
    )
  })

  it('rejects absolute file patterns', async () => {
    await write(dir, 'app/entry.ts', 'export const abs = true')
    assert.throws(
      () =>
        createScriptServer({
          allow: [path.join(dir, 'app')],
          root: dir,
          routes: [
            {
              urlPattern: '/scripts/app/*path',
              filePattern: `${path.join(dir, 'app')}/*path`,
            },
          ],
          cacheStrategy: sourceCacheStrategy('build', [path.join(dir, 'app/entry.ts')]),
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

  it('does not call onError for denied direct requests', async () => {
    await write(dir, 'app/blocked.ts', 'export const blocked = true')
    let receivedError: unknown
    let scriptServer = createScriptServer({
      allow: ['app/**'],
      deny: ['app/blocked.ts'],
      root: dir,
      routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/blocked.ts')
    assert.equal(response, null)
    assert.equal(receivedError, undefined)
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

  it('rejects cacheStrategy without source fingerprinting', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          cacheStrategy: {
            buildId: 'build',
          } as unknown as CacheStrategyOptions,
        }),
      /Expected "source", or omit cacheStrategy/,
    )
  })

  it('rejects source fingerprinting without a non-empty buildId', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          cacheStrategy: {
            fingerprint: 'source',
            buildId: '',
            entryPoints: ['app/entry.ts'],
          },
        }),
      /cacheStrategy\.buildId must be a non-empty string/,
    )
  })

  it('rejects source fingerprinting without entry points', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          cacheStrategy: { fingerprint: 'source', buildId: 'build' } as CacheStrategyOptions,
        }),
      /cacheStrategy\.entryPoints must be a non-empty array/,
    )
  })

  it('rejects invalid cacheStrategy fingerprint values', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          cacheStrategy: {
            fingerprint: 'content',
          } as unknown as CacheStrategyOptions,
        }),
      /Invalid cacheStrategy\.fingerprint/,
    )
  })

  it('rejects entryPoints without source fingerprinting', async () => {
    await write(dir, 'app/entry.ts', 'export const value = 1')
    assert.throws(
      () =>
        createTestServer(dir, {
          cacheStrategy: {
            entryPoints: ['app/entry.ts'],
          } as unknown as CacheStrategyOptions,
        }),
      /Expected "source", or omit cacheStrategy/,
    )
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
    assert.ok(isScriptServerCompilationError(receivedError))
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
    let scriptServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isScriptServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_NOT_SUPPORTED')
    assert.match(receivedError.message, /not a supported script module/)
    assert.match(receivedError.message, /"\.\/data\.json"/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/entry\.ts/)
  })

  it('calls onError for import resolution failures', async () => {
    await write(dir, 'app/entry.ts', 'import "./missing.ts"\nexport const entry = true')
    let receivedError: unknown
    let scriptServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isScriptServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_RESOLUTION_FAILED')
    assert.match(receivedError.message, /Failed to resolve import/)
    assert.match(receivedError.message, /"\.\/missing\.ts"/)
  })

  it('calls onError for CommonJS modules', async () => {
    await write(dir, 'app/entry.ts', 'import "./legacy.js"\nexport const entry = true')
    await write(dir, 'app/dep.js', 'export const dep = true')
    await write(dir, 'app/legacy.js', 'let x = require("./dep.js")\nexport { x }')
    let receivedError: unknown
    let scriptServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isScriptServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'MODULE_COMMONJS_NOT_SUPPORTED')
    assert.match(receivedError.message, /CommonJS module detected/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/legacy\.js/)
  })

  it('calls onError for disallowed imported modules', async () => {
    await write(dir, 'app/entry.ts', 'import "../secret.ts"\nexport const entry = true')
    await write(dir, 'secret.ts', 'export const secret = true')
    let receivedError: unknown
    let scriptServer = createTestServer(dir, {
      onError(error) {
        receivedError = error
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
    assert.ok(isScriptServerCompilationError(receivedError))
    assert.equal(receivedError.code, 'IMPORT_NOT_ALLOWED')
    assert.match(receivedError.message, /outside the script-server routing\/allow configuration/)
    assert.match(receivedError.message, /"\.\.\/secret\.ts"/)
    assert.match(normalizeWindowsPath(receivedError.message), /app\/entry\.ts/)
  })

  it('uses a custom response returned from onError', async () => {
    await write(dir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
    await write(dir, 'app/broken.ts', 'export const nope =')
    let scriptServer = createTestServer(dir, {
      onError() {
        return new Response('Custom build error', { status: 418 })
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    assert.equal(response.status, 418)
    assert.equal(await response.text(), 'Custom build error')
  })

  it('falls back to the default 500 when onError throws', async () => {
    await write(dir, 'app/entry.ts', 'import "./broken.ts"\nexport const entry = true')
    await write(dir, 'app/broken.ts', 'export const nope =')
    let scriptServer = createTestServer(dir, {
      onError() {
        throw new Error('error handler failed')
      },
    })

    let response = await get(scriptServer, '/scripts/app/entry.ts')
    assert.ok(response)
    await assertInternalServerError(response)
  })
})
