import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { createScriptHandler } from './script-handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'script-handler-test-'))
}

async function write(dir: string, rel: string, content: string): Promise<string> {
  let full = path.join(dir, rel)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf-8')
  return full
}

function get(
  handler: ReturnType<typeof createScriptHandler>,
  pathname: string,
  headers?: Record<string, string>,
) {
  let url = `http://localhost${pathname}`
  return handler.handle(new Request(url, { headers }), pathname.replace('/scripts/', ''))
}

function head(handler: ReturnType<typeof createScriptHandler>, pathname: string) {
  let url = `http://localhost${pathname}`
  return handler.handle(new Request(url, { method: 'HEAD' }), pathname.replace('/scripts/', ''))
}

function post(handler: ReturnType<typeof createScriptHandler>, pathname: string) {
  let url = `http://localhost${pathname}`
  return handler.handle(new Request(url, { method: 'POST' }), pathname.replace('/scripts/', ''))
}

async function parseJson(response: Response): Promise<any> {
  return JSON.parse(await response.text())
}

async function parseInlineSourceMap(response: Response): Promise<any> {
  let body = await response.text()
  let match = body.match(/sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/)
  assert.ok(match, `expected inline source map data URL, got:\n${body}`)
  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf-8'))
}

// ---------------------------------------------------------------------------
// HTTP method handling
// ---------------------------------------------------------------------------

describe('HTTP method handling', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'export const x = 1')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('handles GET requests', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('handles HEAD requests (same status, no body)', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await head(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
    let body = await res.text()
    assert.equal(body, '')
  })

  it('returns null for POST requests', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await post(handler, '/scripts/app/entry.ts')
    assert.equal(res, null)
  })

  it('returns null for PUT requests', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let url = 'http://localhost/scripts/app/entry.ts'
    let res = await handler.handle(new Request(url, { method: 'PUT' }), 'app/entry.ts')
    assert.equal(res, null)
  })
})

// ---------------------------------------------------------------------------
// Entry point routing
// ---------------------------------------------------------------------------

describe('entry point routing', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'export const x = 1')
    await write(dir, 'app/other.ts', 'export const y = 2')
    await write(dir, 'lib/internal.ts', 'export const z = 3')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns 200 for a path matching an exact entryPoints entry', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('returns null for a path not matching any entryPoints pattern', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/lib/internal.ts')
    assert.equal(res, null)
  })

  it('supports glob patterns for entryPoints', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/*.ts'], root: dir, base: '/scripts' })
    let res1 = await get(handler, '/scripts/app/entry.ts')
    let res2 = await get(handler, '/scripts/app/other.ts')
    assert.ok(res1)
    assert.ok(res2)
    assert.equal(res1.status, 200)
    assert.equal(res2.status, 200)
  })

  it('returns null for a path matching glob but not an actual entryPoints glob', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/other.ts')
    assert.equal(res, null)
  })

  it('returns null for an empty path', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await handler.handle(new Request('http://localhost/scripts/'), '')
    assert.equal(res, null)
  })
})

// ---------------------------------------------------------------------------
// Content-Type and basic response shape
// ---------------------------------------------------------------------------

describe('response content', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(
      dir,
      'app/entry.ts',
      `
      export function greet(name: string): string {
        return 'Hello, ' + name
      }
    `,
    )
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns application/javascript content-type', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    assert.ok(res.headers.get('Content-Type')?.includes('application/javascript'))
  })

  it('strips TypeScript type annotations from output', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(!body.includes(': string'), 'TypeScript type annotations should be stripped')
  })

  it('preserves the function logic in output', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('greet'), 'function name should be preserved')
    assert.ok(body.includes('Hello, '), 'function body should be preserved')
  })
})

// ---------------------------------------------------------------------------
// TSX / JSX transpilation
// ---------------------------------------------------------------------------

describe('TSX transpilation', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(
      dir,
      'app/component.tsx',
      `
      export function Button({ label }: { label: string }) {
        return <button>{label}</button>
      }
    `,
    )
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('transpiles TSX files to valid JavaScript', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/component.tsx'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/component.tsx')
    assert.ok(res)
    assert.equal(res.status, 200)
    let body = await res.text()
    // JSX should be converted to React.createElement or similar calls
    assert.ok(!body.includes('<button>'), 'JSX syntax should be transpiled')
    assert.ok(body.includes('Button'), 'function name should remain')
  })
})

// ---------------------------------------------------------------------------
// tsconfig.json and package.json config
// ---------------------------------------------------------------------------

describe('tsconfig.json and package.json config', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()

    await write(
      dir,
      'package.json',
      JSON.stringify(
        {
          imports: {
            '#component/jsx-runtime': './support/jsx-runtime.ts',
            '#component/jsx-dev-runtime': './support/jsx-dev-runtime.ts',
          },
        },
        null,
        2,
      ),
    )

    await write(
      dir,
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            jsx: 'react-jsx',
            jsxImportSource: '#component',
          },
        },
        null,
        2,
      ),
    )

    await write(
      dir,
      'support/jsx-runtime.ts',
      `
        export let Fragment = Symbol.for('fragment')
        export function jsx(type: string, props: unknown) {
          return { type, props }
        }
        export let jsxs = jsx
      `,
    )

    await write(
      dir,
      'support/jsx-dev-runtime.ts',
      `
        export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
        export let jsxDEV = jsx
      `,
    )

    await write(
      dir,
      'app/component.tsx',
      `
        export function Button() {
          return <button>Hello</button>
        }
      `,
    )
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('uses tsconfig jsxImportSource and rewrites package imports', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/component.tsx'],
      root: dir,
      base: '/scripts',
    })

    let res = await get(handler, '/scripts/app/component.tsx')
    assert.ok(res)
    assert.equal(res.status, 200)

    let body = await res.text()
    assert.ok(!body.includes('React.createElement'), `expected custom JSX runtime, got:\n${body}`)

    let match = body.match(/\/scripts\/support\/jsx-runtime\.ts\.@([a-z0-9]+)/)
    assert.ok(
      match,
      `expected jsx runtime import to be rewritten via package imports, got:\n${body}`,
    )

    let runtimeRes = await get(handler, `/scripts/support/jsx-runtime.ts.@${match[1]}`)
    assert.ok(runtimeRes)
    assert.equal(runtimeRes.status, 200)
  })
})

// ---------------------------------------------------------------------------
// Cache headers
// ---------------------------------------------------------------------------

describe('cache headers', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'export const x = 1')
    await write(dir, 'app/dep.ts', 'export const y = 2')
    await write(
      dir,
      'app/entry-with-dep.ts',
      'import { y } from "./dep.ts"\nexport const z = y + 1',
    )
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('serves entry points with Cache-Control: no-cache', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    assert.equal(res.headers.get('Cache-Control'), 'no-cache')
  })

  it('serves entry points with an ETag header', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let etag = res.headers.get('ETag')
    assert.ok(etag, 'ETag header should be present')
    assert.match(etag!, /^W\/"[0-9a-z]+"$/)
  })

  it('serves internal modules with Cache-Control: immutable', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
    })
    // First fetch entry to build the graph and get the dep URL
    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()

    // Extract the content-addressed dep URL from the entry body
    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match, `expected dep URL in entry body, got:\n${entryBody}`)
    let depUrl = `/scripts/app/dep.ts.@${match[1]}`

    let depRes = await get(handler, depUrl)
    assert.ok(depRes)
    assert.equal(depRes.status, 200)
    assert.ok(
      depRes.headers.get('Cache-Control')?.includes('immutable'),
      'internal modules should be immutable',
    )
  })

  it('internal modules have no ETag header (immutable, never revalidated)', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
    })
    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()

    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match)
    let depRes = await get(handler, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depRes)
    assert.equal(depRes.headers.get('ETag'), null)
  })
})

// ---------------------------------------------------------------------------
// ETag / 304 handling
// ---------------------------------------------------------------------------

describe('ETag and 304 Not Modified', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'export const x = 1')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns 304 when If-None-Match matches the ETag', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let first = await get(handler, '/scripts/app/entry.ts')
    assert.ok(first)
    let etag = first.headers.get('ETag')
    assert.ok(etag)

    let second = await get(handler, '/scripts/app/entry.ts', { 'If-None-Match': etag })
    assert.ok(second)
    assert.equal(second.status, 304)
    let body = await second.text()
    assert.equal(body, '')
  })

  it('returns 200 when If-None-Match does not match', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts', { 'If-None-Match': 'W/"stale"' })
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('304 response has no body', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let first = await get(handler, '/scripts/app/entry.ts')
    assert.ok(first)
    let etag = first.headers.get('ETag')!

    let second = await get(handler, '/scripts/app/entry.ts', { 'If-None-Match': etag })
    assert.ok(second)
    assert.equal(second.status, 304)
    assert.equal(await second.text(), '')
  })
})

// ---------------------------------------------------------------------------
// Internal module hash validation
// ---------------------------------------------------------------------------

describe('internal module hash validation', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'import { y } from "./dep.ts"\nexport const z = y')
    await write(dir, 'app/dep.ts', 'export const y = 2')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns null for a wrong hash on an internal module', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    await get(handler, '/scripts/app/entry.ts') // build the graph
    let res = await get(handler, '/scripts/app/dep.ts.@wronghash')
    assert.equal(res, null)
  })

  it('returns null for a non-existent file with a hash', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/nonexistent.ts.@abc123')
    assert.equal(res, null)
  })

  it('returns 200 for an internal module with the correct hash', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let entryRes = await get(handler, '/scripts/app/entry.ts')
    assert.ok(entryRes)
    let body = await entryRes.text()

    let match = body.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match, `expected dep URL in entry body, got:\n${body}`)

    let depRes = await get(handler, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depRes)
    assert.equal(depRes.status, 200)
  })

  it('returns 500 when an internal module has a compilation error', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let entryRes = await get(handler, '/scripts/app/entry.ts')
    assert.ok(entryRes)
    let body = await entryRes.text()

    let match = body.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match, `expected dep URL in entry body, got:\n${body}`)

    await write(dir, 'app/dep.ts', 'export const y =')

    let depRes = await get(handler, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depRes)
    assert.equal(depRes.status, 500)
    let depBody = await depRes.text()
    assert.match(depBody, /^Compilation error: /)
  })
})

// ---------------------------------------------------------------------------
// Import rewriting
// ---------------------------------------------------------------------------

describe('import rewriting', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(
      dir,
      'app/entry.ts',
      `
      import { greet } from './greet.ts'
      export { greet }
      export * as remoteLib from 'https://esm.sh/some-lib'
    `,
    )
    await write(dir, 'app/greet.ts', 'export function greet(n: string) { return "Hi " + n }')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('rewrites relative imports to content-addressed URLs', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('/scripts/app/greet.ts.@'), 'relative import should be rewritten')
    assert.ok(!body.includes('./greet.ts'), 'original relative import should be gone')
  })

  it('leaves https:// URL imports unrewritten', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('https://esm.sh/some-lib'), 'URL imports should be left unchanged')
  })
})

// ---------------------------------------------------------------------------
// Entry point import URL rewriting
// ---------------------------------------------------------------------------

describe('entry point import URL rewriting', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    // B is a configured entry point that is also imported by A
    await write(dir, 'app/a.ts', 'import { y } from "./b.ts"\nexport const z = y + 1')
    await write(dir, 'app/b.ts', 'export const y: number = 2')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('uses stable no-hash URL when importing a configured entry point', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/a.ts', 'app/b.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/a.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('/scripts/app/b.ts'),
      `expected stable entry URL in import, got:\n${body}`,
    )
    assert.ok(
      !body.includes('/scripts/app/b.ts.@'),
      `expected no hash token in entry import URL, got:\n${body}`,
    )
  })

  it('uses content-addressed URL when importing a non-entry module', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/a.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/a.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('/scripts/app/b.ts.@'),
      `expected hash token in non-entry import URL, got:\n${body}`,
    )
  })

  it('preloads() uses stable URL for entry point deps', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/a.ts', 'app/b.ts'],
      root: dir,
      base: '/scripts',
    })
    let urls = await handler.preloads('app/a.ts')
    let bUrl = urls.find((u) => u.includes('app/b'))
    assert.ok(bUrl, 'should include b.ts in preloads')
    assert.ok(!bUrl.includes('.@'), `expected no hash token in entry preload URL, got: ${bUrl}`)
  })
})

// ---------------------------------------------------------------------------
// External specifiers
// ---------------------------------------------------------------------------

describe('external specifiers', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(
      dir,
      'app/entry.ts',
      `import React from 'react'\nimport { format } from './utils.ts'\nexport { React, format }`,
    )
    await write(dir, 'app/utils.ts', 'export function format(s: string) { return s.trim() }')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('leaves externals unrewritten', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      external: ['react'],
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes("'react'") || body.includes('"react"'), 'react import should remain')
  })

  it('still rewrites non-external relative imports', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      external: ['react'],
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('/scripts/app/utils.ts.@'),
      'relative imports should still be rewritten',
    )
  })

  it('supports a single string for external (not just array)', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      external: 'react',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes("'react'") || body.includes('"react"'))
  })
})

// ---------------------------------------------------------------------------
// Content-addressed URL determinism and cache invalidation
// ---------------------------------------------------------------------------

describe('content-addressed URL determinism', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('same source produces same hash', async () => {
    await write(dir, 'a/dep.ts', 'export const x = 1')
    await write(dir, 'a/entry.ts', 'import { x } from "./dep.ts"\nexport { x }')

    let handlerA = createScriptHandler({ entryPoints: ['a/entry.ts'], root: dir, base: '/scripts' })
    let resA1 = await get(handlerA, '/scripts/a/entry.ts')
    assert.ok(resA1)
    let bodyA1 = await resA1.text()

    let handlerA2 = createScriptHandler({
      entryPoints: ['a/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let resA2 = await get(handlerA2, '/scripts/a/entry.ts')
    assert.ok(resA2)
    let bodyA2 = await resA2.text()

    assert.equal(bodyA1, bodyA2, 'identical sources should produce identical output')
  })

  it('different dep content produces different hash in importer', async () => {
    await write(dir, 'b/dep.ts', 'export const x = 1')
    await write(dir, 'b/entry.ts', 'import { x } from "./dep.ts"\nexport { x }')

    let handler = createScriptHandler({ entryPoints: ['b/entry.ts'], root: dir, base: '/scripts' })
    let res1 = await get(handler, '/scripts/b/entry.ts')
    assert.ok(res1)
    let body1 = await res1.text()
    let match1 = body1.match(/\/scripts\/b\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match1)
    let hash1 = match1[1]

    // Modify dep content with a new mtime
    await write(dir, 'b/dep.ts', 'export const x = 999')

    // New handler to get fresh compilation
    let handler2 = createScriptHandler({ entryPoints: ['b/entry.ts'], root: dir, base: '/scripts' })
    let res2 = await get(handler2, '/scripts/b/entry.ts')
    assert.ok(res2)
    let body2 = await res2.text()
    let match2 = body2.match(/\/scripts\/b\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match2)
    let hash2 = match2[1]

    assert.notEqual(hash1, hash2, 'changing dep content should change hash in importer')
  })

  it('transitive dep change propagates new hash to all importers', async () => {
    await write(dir, 'c/leaf.ts', 'export const v = 1')
    await write(dir, 'c/mid.ts', 'import { v } from "./leaf.ts"\nexport const w = v + 1')
    await write(dir, 'c/entry.ts', 'import { w } from "./mid.ts"\nexport const z = w')

    let handler1 = createScriptHandler({ entryPoints: ['c/entry.ts'], root: dir, base: '/scripts' })
    let res1 = await get(handler1, '/scripts/c/entry.ts')
    assert.ok(res1)
    let body1 = await res1.text()
    let midMatch1 = body1.match(/\/scripts\/c\/mid\.ts\.@([a-z0-9]+)/)
    assert.ok(midMatch1)
    let midHash1 = midMatch1[1]

    // Change the leaf (deepest dep)
    await write(dir, 'c/leaf.ts', 'export const v = 42')

    let handler2 = createScriptHandler({ entryPoints: ['c/entry.ts'], root: dir, base: '/scripts' })
    let res2 = await get(handler2, '/scripts/c/entry.ts')
    assert.ok(res2)
    let body2 = await res2.text()
    let midMatch2 = body2.match(/\/scripts\/c\/mid\.ts\.@([a-z0-9]+)/)
    assert.ok(midMatch2)
    let midHash2 = midMatch2[1]

    assert.notEqual(midHash1, midHash2, 'leaf change should propagate to mid hash')
  })
})

// ---------------------------------------------------------------------------
// Circular dependency handling
// ---------------------------------------------------------------------------

describe('circular dependency handling', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    // Real cycle: a.ts uses b, b.ts uses a (both sides consumed so esbuild keeps both imports)
    await write(
      dir,
      'cycle/a.ts',
      'import { getB } from "./b.ts"\nexport const a = "A"\nexport const aFn = () => getB()',
    )
    await write(
      dir,
      'cycle/b.ts',
      'import { a } from "./a.ts"\nexport const b = "B"\nexport const getB = () => a',
    )
    await write(dir, 'cycle/entry.ts', 'import { aFn } from "./a.ts"\nexport { aFn }')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('successfully compiles a module graph with circular deps', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cycle/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/cycle/entry.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('modules in a cycle share the same hash', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cycle/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let entryRes = await get(handler, '/scripts/cycle/entry.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()

    let aMatch = entryBody.match(/\/scripts\/cycle\/a\.ts\.@([a-z0-9]+)/)
    assert.ok(aMatch, `expected a.ts in entry body, got:\n${entryBody}`)
    let aHash = aMatch[1]

    // a.ts and b.ts are in a real cycle — they must share the same compiledHash
    let aRes = await get(handler, `/scripts/cycle/a.ts.@${aHash}`)
    assert.ok(aRes)
    assert.equal(aRes.status, 200)
    let aBody = await aRes.text()

    let bMatch = aBody.match(/\/scripts\/cycle\/b\.ts\.@([a-z0-9]+)/)
    assert.ok(bMatch, `expected b.ts URL in a.ts body, got:\n${aBody}`)
    let bHash = bMatch[1]

    // Both must share the cycle hash
    assert.equal(aHash, bHash, 'modules in a real cycle should share the same hash')

    // b.ts must also be fetchable via its URL
    let bRes = await get(handler, `/scripts/cycle/b.ts.@${bHash}`)
    assert.ok(bRes)
    assert.equal(bRes.status, 200)
  })

  it('cycle hash changes when a cycle member changes', async () => {
    let handler1 = createScriptHandler({
      entryPoints: ['cycle/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res1 = await get(handler1, '/scripts/cycle/entry.ts')
    assert.ok(res1)
    let body1 = await res1.text()
    let match1 = body1.match(/\/scripts\/cycle\/a\.ts\.@([a-z0-9]+)/)
    assert.ok(match1)
    let hash1 = match1[1]

    // Modify one cycle member (keep the real cycle: a still uses b)
    await write(
      dir,
      'cycle/a.ts',
      'import { getB } from "./b.ts"\nexport const a = "AA"\nexport const aFn = () => "changed " + getB()',
    )

    let handler2 = createScriptHandler({
      entryPoints: ['cycle/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res2 = await get(handler2, '/scripts/cycle/entry.ts')
    assert.ok(res2)
    let body2 = await res2.text()
    let match2 = body2.match(/\/scripts\/cycle\/a\.ts\.@([a-z0-9]+)/)
    assert.ok(match2)
    let hash2 = match2[1]

    assert.notEqual(hash1, hash2, 'cycle hash should change when a member changes')
  })
})

// ---------------------------------------------------------------------------
// CommonJS detection
// ---------------------------------------------------------------------------

describe('CommonJS detection', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'export const ok = true')
    await write(dir, 'cjs/module-exports.js', 'module.exports = { foo: 1 }')
    await write(dir, 'cjs/exports-dot.js', 'exports.bar = 2')
    await write(dir, 'cjs/module-bracket.js', 'module   [  `exports`  ] = { foo: 1 }')
    await write(dir, 'cjs/exports-assignment.js', 'exports        = { foo: 1 }')
    await write(
      dir,
      'cjs/require-member.js',
      'let x = require   [ `resolve` ]("fs")\nexport default x',
    )
    await write(dir, 'cjs/require-only.js', 'const fs = require("fs")')
    await write(dir, 'app/imports-cjs.ts', 'import "./cjs-dep.js"\nexport const x = 1')
    await write(dir, 'app/cjs-dep.js', 'exports.x = 1')
    await write(
      dir,
      'app/shadowed-require.ts',
      'export function load(require: (value: string) => string) { return require("ok") }',
    )
    await write(
      dir,
      'app/suspicious-text.ts',
      'let text = "require(resolve)"\n// module.exports = {}\nexport { text }',
    )
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns 500 with error message when entry point is module.exports CJS', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cjs/module-exports.js'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/cjs/module-exports.js')
    assert.ok(res)
    assert.equal(res.status, 500)
    let body = await res.text()
    assert.ok(body.includes('CommonJS'), 'error should mention CommonJS')
  })

  it('returns 500 for exports.foo CJS pattern', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cjs/exports-dot.js'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/cjs/exports-dot.js')
    assert.ok(res)
    assert.equal(res.status, 500)
  })

  it('returns 500 for bracketed module exports syntax', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cjs/module-bracket.js'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/cjs/module-bracket.js')
    assert.ok(res)
    assert.equal(res.status, 500)
  })

  it('returns 500 for exports assignment syntax', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cjs/exports-assignment.js'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/cjs/exports-assignment.js')
    assert.ok(res)
    assert.equal(res.status, 500)
  })

  it('returns 500 for require member syntax', async () => {
    let handler = createScriptHandler({
      entryPoints: ['cjs/require-member.js'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/cjs/require-member.js')
    assert.ok(res)
    assert.equal(res.status, 500)
  })

  it('returns 500 when an entry point imports a CJS dependency', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/imports-cjs.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/imports-cjs.ts')
    assert.ok(res)
    assert.equal(res.status, 500)
    let body = await res.text()
    assert.ok(body.includes('CommonJS'))
  })

  it('serves ESM entry points successfully (control case)', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('serves modules with shadowed require successfully', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/shadowed-require.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/shadowed-require.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('serves modules with suspicious text in strings and comments successfully', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/suspicious-text.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/suspicious-text.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })
})

// ---------------------------------------------------------------------------
// preloads()
// ---------------------------------------------------------------------------

describe('preloads()', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(
      dir,
      'app/entry.ts',
      `
      import { a } from './a.ts'
      import { b } from './b.ts'
      export { a, b }
    `,
    )
    await write(dir, 'app/a.ts', `import { c } from './c.ts'\nexport const a = c + 'a'`)
    await write(dir, 'app/b.ts', 'export const b = "b"')
    await write(dir, 'app/c.ts', 'export const c = "c"')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns an array of URLs', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let urls = await handler.preloads('app/entry.ts')
    assert.ok(Array.isArray(urls))
    assert.ok(urls.length > 0)
  })

  it('includes the entry point URL first (without hash)', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let urls = await handler.preloads('app/entry.ts')
    assert.ok(
      urls[0].endsWith('/scripts/app/entry.ts'),
      `first URL should be entry, got: ${urls[0]}`,
    )
    assert.ok(!urls[0].includes('.@'), 'entry point URL should not have a hash')
  })

  it('includes all transitive dependencies', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let urls = await handler.preloads('app/entry.ts')
    let hasA = urls.some((u) => u.includes('app/a.ts.@'))
    let hasB = urls.some((u) => u.includes('app/b.ts.@'))
    let hasC = urls.some((u) => u.includes('app/c.ts.@'))
    assert.ok(hasA, 'should include a.ts')
    assert.ok(hasB, 'should include b.ts')
    assert.ok(hasC, 'should include c.ts')
  })

  it('preload URLs for deps use content-addressed format', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let urls = await handler.preloads('app/entry.ts')
    let depUrls = urls.filter((u) => !u.endsWith('entry.ts'))
    for (let url of depUrls) {
      assert.match(url, /\.ts\.@[a-z0-9]+$/, `dep URL should be content-addressed: ${url}`)
    }
  })

  it('all preload URLs resolve successfully', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let urls = await handler.preloads('app/entry.ts')

    for (let url of urls) {
      let pathname = url.replace('http://localhost', '')
      let modulePath = pathname.replace('/scripts/', '')
      let res = await handler.handle(new Request(`http://localhost${pathname}`), modulePath)
      assert.ok(res, `preload URL should resolve: ${url}`)
      assert.equal(res.status, 200, `preload URL should return 200: ${url}`)
    }
  })

  it('returns the same preload URLs across repeated calls when sources are unchanged', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })

    let first = await handler.preloads('app/entry.ts')
    let second = await handler.preloads('app/entry.ts')

    assert.deepEqual(second, first)
  })

  it('returns a fresh array for each preloads call', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })

    let first = await handler.preloads('app/entry.ts')
    first.push('/scripts/app/injected.ts')

    let second = await handler.preloads('app/entry.ts')

    assert.notEqual(second, first)
    assert.ok(!second.includes('/scripts/app/injected.ts'))
  })

  it('returns updated preload URLs after a dependency changes', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })

    let before = await handler.preloads('app/entry.ts')
    await new Promise((resolve) => setTimeout(resolve, 10))
    await write(dir, 'app/c.ts', 'export const c = "updated"')
    let after = await handler.preloads('app/entry.ts')

    assert.notDeepEqual(after, before)
    assert.notEqual(
      after.find((url) => url.includes('/app/a.ts.@')),
      before.find((url) => url.includes('/app/a.ts.@')),
    )
    assert.notEqual(
      after.find((url) => url.includes('/app/c.ts.@')),
      before.find((url) => url.includes('/app/c.ts.@')),
    )
  })

  it('throws when the entry point fails to compile', async () => {
    await write(dir, 'app/entry.ts', 'export const x =')

    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    await assert.rejects(() => handler.preloads('app/entry.ts'))
  })

  it('throws when a dependency fails to compile', async () => {
    await write(dir, 'app/c.ts', 'export const c =')

    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    await assert.rejects(() => handler.preloads('app/entry.ts'))
  })
})

// ---------------------------------------------------------------------------
// Source maps
// ---------------------------------------------------------------------------

describe('source maps', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'export const x: number = 1')
    await write(dir, 'app/dep.ts', 'export const y: number = 2')
    await write(dir, 'app/entry-with-dep.ts', 'import { y } from "./dep.ts"\nexport const z = y')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it("adds sourceMappingURL comment when sourceMaps: 'external'", async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('//# sourceMappingURL='), 'should have source map URL comment')
  })

  it('does NOT add sourceMappingURL when sourceMaps is not set', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(!body.includes('//# sourceMappingURL='), 'should not have source map URL comment')
  })

  it('serves entry point source map at .map path', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    await get(handler, '/scripts/app/entry.ts') // build the graph
    let mapRes = await handler.handle(
      new Request('http://localhost/scripts/app/entry.ts.map'),
      'app/entry.ts.map',
    )
    assert.ok(mapRes)
    assert.equal(mapRes.status, 200)
    assert.ok(mapRes.headers.get('Content-Type')?.includes('application/json'))
    let mapBody = await mapRes.text()
    // Should be valid JSON source map
    let parsed = JSON.parse(mapBody)
    assert.ok(parsed.version || parsed.sources, 'should be a valid source map')
  })

  it('serves internal module source map at .@hash.map path', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()

    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match)
    let hash = match[1]

    let mapRes = await handler.handle(
      new Request(`http://localhost/scripts/app/dep.ts.@${hash}.map`),
      `app/dep.ts.@${hash}.map`,
    )
    assert.ok(mapRes)
    assert.equal(mapRes.status, 200)
  })

  it('returns 404 for source map request when sourceMaps is disabled', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    await get(handler, '/scripts/app/entry.ts')
    let mapRes = await handler.handle(
      new Request('http://localhost/scripts/app/entry.ts.map'),
      'app/entry.ts.map',
    )
    assert.ok(mapRes)
    assert.equal(mapRes.status, 404)
  })

  it('entry point source map URL has no hash token', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('//# sourceMappingURL=/scripts/app/entry.ts.map'),
      `expected entry source map URL without hash, got:\n${body}`,
    )
  })

  it('internal module source map URL has a hash token', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()
    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match, 'entry should import dep via hash URL')
    let hash = match[1]
    let depRes = await get(handler, `/scripts/app/dep.ts.@${hash}`)
    assert.ok(depRes)
    let depBody = await depRes.text()
    assert.ok(
      depBody.includes(`//# sourceMappingURL=/scripts/app/dep.ts.@${hash}.map`),
      `expected internal module source map URL with hash, got:\n${depBody}`,
    )
  })

  it('when entry point is also a dep, its import URL has no hash token', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts', 'app/dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let res = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('/scripts/app/dep.ts'),
      `expected dep to be imported via stable entry URL, got:\n${body}`,
    )
    assert.ok(
      !body.includes('/scripts/app/dep.ts.@'),
      `expected no hash token since dep is also an entry, got:\n${body}`,
    )
  })

  it('sourceMaps flag is reflected in the content hash (different ETags)', async () => {
    let withMaps = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let withoutMaps = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
    })
    let resWith = await get(withMaps, '/scripts/app/entry-with-dep.ts')
    let resWithout = await get(withoutMaps, '/scripts/app/entry-with-dep.ts')
    assert.ok(resWith && resWithout)
    let etagWith = resWith.headers.get('ETag')
    let etagWithout = resWithout.headers.get('ETag')
    assert.ok(etagWith && etagWithout, 'both responses should have ETags')
    assert.notEqual(etagWith, etagWithout, 'ETags should differ when sourceMaps differs')
  })

  it('sourceMaps flag changes internal module URL tokens', async () => {
    let withMaps = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let withoutMaps = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
    })
    let bodyWith = await (await get(withMaps, '/scripts/app/entry-with-dep.ts'))!.text()
    let bodyWithout = await (await get(withoutMaps, '/scripts/app/entry-with-dep.ts'))!.text()
    let matchWith = bodyWith.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    let matchWithout = bodyWithout.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(matchWith && matchWithout, 'both should have dep URL tokens')
    assert.notEqual(matchWith[1], matchWithout[1], 'dep hash should differ when sourceMaps differs')
  })

  it("embeds data URL comment when sourceMaps: 'inline'", async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('//# sourceMappingURL=data:application/json;base64,'),
      `expected inline source map data URL, got:\n${body}`,
    )
  })

  it('inline source map data URL contains valid JSON', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    let match = body.match(/sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/)
    assert.ok(match, 'expected base64 data URL')
    let decoded = Buffer.from(match[1], 'base64').toString('utf-8')
    let parsed = JSON.parse(decoded)
    assert.ok(parsed.version || parsed.sources, 'decoded data URL should be a valid source map')
  })

  it('external source maps default to virtual source paths', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })

    let entryMapRes = await handler.handle(
      new Request('http://localhost/scripts/app/entry-with-dep.ts.map'),
      'app/entry-with-dep.ts.map',
    )
    assert.ok(entryMapRes)
    let entryMap = await parseJson(entryMapRes)
    assert.deepEqual(entryMap.sources, ['/scripts/app/entry-with-dep.ts'])

    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()
    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match)

    let depMapRes = await handler.handle(
      new Request(`http://localhost/scripts/app/dep.ts.@${match[1]}.map`),
      `app/dep.ts.@${match[1]}.map`,
    )
    assert.ok(depMapRes)
    let depMap = await parseJson(depMapRes)
    assert.deepEqual(depMap.sources, ['/scripts/app/dep.ts'])
  })

  it('external source maps support absolute source paths', async () => {
    let entryPath = await fs.realpath(path.join(dir, 'app/entry-with-dep.ts'))
    let depPath = await fs.realpath(path.join(dir, 'app/dep.ts'))

    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
      sourceMapSourcePaths: 'absolute',
    })

    let entryMapRes = await handler.handle(
      new Request('http://localhost/scripts/app/entry-with-dep.ts.map'),
      'app/entry-with-dep.ts.map',
    )
    assert.ok(entryMapRes)
    let entryMap = await parseJson(entryMapRes)
    assert.deepEqual(entryMap.sources, [entryPath])

    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()
    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match)

    let depMapRes = await handler.handle(
      new Request(`http://localhost/scripts/app/dep.ts.@${match[1]}.map`),
      `app/dep.ts.@${match[1]}.map`,
    )
    assert.ok(depMapRes)
    let depMap = await parseJson(depMapRes)
    assert.deepEqual(depMap.sources, [depPath])
  })

  it('inline source maps default to virtual source paths', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
    })

    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryMap = await parseInlineSourceMap(entryRes)
    assert.deepEqual(entryMap.sources, ['/scripts/app/entry-with-dep.ts'])

    let entryBodyRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryBodyRes)
    let entryBody = await entryBodyRes.text()
    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match)

    let depRes = await get(handler, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depRes)
    let depMap = await parseInlineSourceMap(depRes)
    assert.deepEqual(depMap.sources, ['/scripts/app/dep.ts'])
  })

  it('inline source maps support absolute source paths', async () => {
    let entryPath = await fs.realpath(path.join(dir, 'app/entry-with-dep.ts'))
    let depPath = await fs.realpath(path.join(dir, 'app/dep.ts'))

    let handler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
      sourceMapSourcePaths: 'absolute',
    })

    let entryRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryRes)
    let entryMap = await parseInlineSourceMap(entryRes)
    assert.deepEqual(entryMap.sources, [entryPath])

    let entryBodyRes = await get(handler, '/scripts/app/entry-with-dep.ts')
    assert.ok(entryBodyRes)
    let entryBody = await entryBodyRes.text()
    let match = entryBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(match)

    let depRes = await get(handler, `/scripts/app/dep.ts.@${match[1]}`)
    assert.ok(depRes)
    let depMap = await parseInlineSourceMap(depRes)
    assert.deepEqual(depMap.sources, [depPath])
  })

  it("returns 404 for .map request when sourceMaps: 'inline'", async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
    })
    await get(handler, '/scripts/app/entry.ts')
    let mapRes = await handler.handle(
      new Request('http://localhost/scripts/app/entry.ts.map'),
      'app/entry.ts.map',
    )
    assert.ok(mapRes)
    assert.equal(mapRes.status, 404)
  })

  it('all three sourceMaps modes produce distinct ETags', async () => {
    let makeHandler = (sourceMaps?: 'inline' | 'external') =>
      createScriptHandler({
        entryPoints: ['app/entry-with-dep.ts'],
        root: dir,
        base: '/scripts',
        sourceMaps,
      })

    let [resOff, resInline, resExternal] = await Promise.all([
      get(makeHandler(), '/scripts/app/entry-with-dep.ts'),
      get(makeHandler('inline'), '/scripts/app/entry-with-dep.ts'),
      get(makeHandler('external'), '/scripts/app/entry-with-dep.ts'),
    ])
    assert.ok(resOff && resInline && resExternal)
    let etagOff = resOff.headers.get('ETag')
    let etagInline = resInline.headers.get('ETag')
    let etagExternal = resExternal.headers.get('ETag')
    assert.ok(etagOff && etagInline && etagExternal, 'all responses should have ETags')
    assert.notEqual(etagOff, etagInline, 'disabled vs inline ETags should differ')
    assert.notEqual(etagOff, etagExternal, 'disabled vs external ETags should differ')
    assert.notEqual(etagInline, etagExternal, 'inline vs external ETags should differ')
  })

  it('all three sourceMaps modes produce distinct internal module URL tokens', async () => {
    let makeHandler = (sourceMaps?: 'inline' | 'external') =>
      createScriptHandler({
        entryPoints: ['app/entry-with-dep.ts'],
        root: dir,
        base: '/scripts',
        sourceMaps,
      })

    let getDepHash = async (sourceMaps?: 'inline' | 'external') => {
      let body = await (await get(
        makeHandler(sourceMaps),
        '/scripts/app/entry-with-dep.ts',
      ))!.text()
      let match = body.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
      return match?.[1] ?? null
    }

    let [hashOff, hashInline, hashExternal] = await Promise.all([
      getDepHash(),
      getDepHash('inline'),
      getDepHash('external'),
    ])
    assert.ok(hashOff && hashInline && hashExternal, 'all modes should produce dep hash tokens')
    assert.notEqual(hashOff, hashInline, 'disabled vs inline tokens should differ')
    assert.notEqual(hashOff, hashExternal, 'disabled vs external tokens should differ')
    assert.notEqual(hashInline, hashExternal, 'inline vs external tokens should differ')
  })

  it('sourceMapSourcePaths affects inline ETags', async () => {
    let virtualHandler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
    })
    let absoluteHandler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'inline',
      sourceMapSourcePaths: 'absolute',
    })

    let virtualRes = await get(virtualHandler, '/scripts/app/entry.ts')
    let absoluteRes = await get(absoluteHandler, '/scripts/app/entry.ts')
    assert.ok(virtualRes && absoluteRes)
    assert.notEqual(virtualRes.headers.get('ETag'), absoluteRes.headers.get('ETag'))
  })

  it('sourceMapSourcePaths affects external internal-module URL tokens', async () => {
    let virtualHandler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
    })
    let absoluteHandler = createScriptHandler({
      entryPoints: ['app/entry-with-dep.ts'],
      root: dir,
      base: '/scripts',
      sourceMaps: 'external',
      sourceMapSourcePaths: 'absolute',
    })

    let virtualBody = await (await get(virtualHandler, '/scripts/app/entry-with-dep.ts'))!.text()
    let absoluteBody = await (await get(absoluteHandler, '/scripts/app/entry-with-dep.ts'))!.text()
    let virtualMatch = virtualBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    let absoluteMatch = absoluteBody.match(/\/scripts\/app\/dep\.ts\.@([a-z0-9]+)/)
    assert.ok(virtualMatch && absoluteMatch)
    assert.notEqual(virtualMatch[1], absoluteMatch[1])
  })
})

// ---------------------------------------------------------------------------
// Workspace root
// ---------------------------------------------------------------------------

describe('workspace root', () => {
  let workspaceDir: string
  let projectDir: string
  before(async () => {
    workspaceDir = await makeTmpDir()
    projectDir = path.join(workspaceDir, 'project')
    await fs.mkdir(path.join(projectDir, 'app'), { recursive: true })
    await fs.mkdir(path.join(workspaceDir, 'shared'), { recursive: true })

    // Entry is at project/app/entry.ts; shared is at workspaceDir/shared/utils.ts.
    // Going ../../shared/utils.ts from project/app/ reaches workspaceDir/shared/utils.ts.
    await write(
      workspaceDir,
      'project/app/entry.ts',
      'import { util } from "../../shared/utils.ts"\nexport { util }',
    )
    await write(workspaceDir, 'shared/utils.ts', 'export const util = "shared"')
  })
  after(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true })
  })

  it('rewrites workspace package imports with __@workspace/ prefix', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: projectDir,
      workspaceRoot: workspaceDir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(
      body.includes('/scripts/__@workspace/'),
      `workspace import should have __@workspace/ prefix, got:\n${body}`,
    )
  })

  it('serves workspace modules at __@workspace/ URLs', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: projectDir,
      workspaceRoot: workspaceDir,
      base: '/scripts',
    })
    let entryRes = await get(handler, '/scripts/app/entry.ts')
    assert.ok(entryRes)
    let entryBody = await entryRes.text()

    let match = entryBody.match(/\/scripts\/__@workspace\/(shared\/utils\.ts)\.@([a-z0-9]+)/)
    assert.ok(match, `expected workspace URL, got:\n${entryBody}`)

    let wsModulePath = `__@workspace/${match[1]}.@${match[2]}`
    let wsRes = await handler.handle(
      new Request(`http://localhost/scripts/${wsModulePath}`),
      wsModulePath,
    )
    assert.ok(wsRes)
    assert.equal(wsRes.status, 200)
  })
})

// ---------------------------------------------------------------------------
// Base path
// ---------------------------------------------------------------------------

describe('base path', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry.ts', 'import { x } from "./dep.ts"\nexport { x }')
    await write(dir, 'app/dep.ts', 'export const x = 1')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('uses the configured base for rewritten import URLs', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('/scripts/app/dep.ts.@'))
  })

  it('normalizes a trailing slash in base', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry.ts'],
      root: dir,
      base: '/scripts/',
    })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('/scripts/app/dep.ts.@'))
  })

  it('normalizes a missing leading slash in base', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/entry.ts'], root: dir, base: 'scripts' })
    let res = await get(handler, '/scripts/app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('/scripts/app/dep.ts.@'))
  })

  it('supports root base when set to slash', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/entry.ts'], root: dir, base: '/' })
    let res = await handler.handle(new Request('http://localhost/app/entry.ts'), 'app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('from "/app/dep.ts.@'))
    assert.ok(!body.includes('from "//app/dep.ts.@'))
  })

  it('supports root base when set to an empty string', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/entry.ts'], root: dir, base: '' })
    let res = await handler.handle(new Request('http://localhost/app/entry.ts'), 'app/entry.ts')
    assert.ok(res)
    let body = await res.text()
    assert.ok(body.includes('from "/app/dep.ts.@'))
    assert.ok(!body.includes('from "//app/dep.ts.@'))
  })

  it('uses root base for preload URLs without double slashes', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/entry.ts'], root: dir, base: '' })
    let preloadUrls = await handler.preloads('app/entry.ts')
    assert.equal(preloadUrls[0], '/app/entry.ts')
    assert.match(preloadUrls[1]!, /^\/app\/dep\.ts\.@[a-z0-9]+$/)
  })
})

// ---------------------------------------------------------------------------
// Deep dependency graph (multi-level)
// ---------------------------------------------------------------------------

describe('multi-level dependency graph', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/l0.ts', 'import { v1 } from "./l1.ts"\nexport const v0 = v1 + "0"')
    await write(dir, 'app/l1.ts', 'import { v2 } from "./l2.ts"\nexport const v1 = v2 + "1"')
    await write(dir, 'app/l2.ts', 'import { v3 } from "./l3.ts"\nexport const v2 = v3 + "2"')
    await write(dir, 'app/l3.ts', 'export const v3 = "3"')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('correctly compiles a 4-level deep dependency chain', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/l0.ts'], root: dir, base: '/scripts' })
    let res = await get(handler, '/scripts/app/l0.ts')
    assert.ok(res)
    assert.equal(res.status, 200)
  })

  it('each level has its own content-addressed URL', async () => {
    let handler = createScriptHandler({ entryPoints: ['app/l0.ts'], root: dir, base: '/scripts' })

    let r0 = await get(handler, '/scripts/app/l0.ts')
    assert.ok(r0)
    let b0 = await r0.text()

    let m1 = b0.match(/\/scripts\/app\/l1\.ts\.@([a-z0-9]+)/)
    assert.ok(m1, `l1 URL missing from l0, got:\n${b0}`)

    let r1 = await get(handler, `/scripts/app/l1.ts.@${m1[1]}`)
    assert.ok(r1)
    assert.equal(r1.status, 200)
    let b1 = await r1.text()

    let m2 = b1.match(/\/scripts\/app\/l2\.ts\.@([a-z0-9]+)/)
    assert.ok(m2, `l2 URL missing from l1, got:\n${b1}`)

    let r2 = await get(handler, `/scripts/app/l2.ts.@${m2[1]}`)
    assert.ok(r2)
    assert.equal(r2.status, 200)
    let b2 = await r2.text()

    let m3 = b2.match(/\/scripts\/app\/l3\.ts\.@([a-z0-9]+)/)
    assert.ok(m3, `l3 URL missing from l2, got:\n${b2}`)

    let r3 = await get(handler, `/scripts/app/l3.ts.@${m3[1]}`)
    assert.ok(r3)
    assert.equal(r3.status, 200)
  })

  it('changing a leaf dep invalidates all ancestor hashes', async () => {
    let handler1 = createScriptHandler({ entryPoints: ['app/l0.ts'], root: dir, base: '/scripts' })
    let res1 = await get(handler1, '/scripts/app/l0.ts')
    assert.ok(res1)
    let body1 = await res1.text()
    let m1Before = body1.match(/\/scripts\/app\/l1\.ts\.@([a-z0-9]+)/)!
    assert.ok(m1Before)

    await write(dir, 'app/l3.ts', 'export const v3 = "changed"')

    let handler2 = createScriptHandler({ entryPoints: ['app/l0.ts'], root: dir, base: '/scripts' })
    let res2 = await get(handler2, '/scripts/app/l0.ts')
    assert.ok(res2)
    let body2 = await res2.text()
    let m1After = body2.match(/\/scripts\/app\/l1\.ts\.@([a-z0-9]+)/)!
    assert.ok(m1After)

    assert.notEqual(m1Before[1], m1After[1], 'l1 hash should change when l3 changes')
  })
})

// ---------------------------------------------------------------------------
// Multiple entry points
// ---------------------------------------------------------------------------

describe('multiple entry points', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/entry-a.ts', 'export const a = "A"')
    await write(dir, 'app/entry-b.ts', 'export const b = "B"')
    await write(dir, 'app/not-entry.ts', 'export const c = "C"')
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('serves all configured entry points', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-a.ts', 'app/entry-b.ts'],
      root: dir,
      base: '/scripts',
    })
    let resA = await get(handler, '/scripts/app/entry-a.ts')
    let resB = await get(handler, '/scripts/app/entry-b.ts')
    assert.ok(resA)
    assert.ok(resB)
    assert.equal(resA.status, 200)
    assert.equal(resB.status, 200)
  })

  it('returns null for a path that is not in the entry points list', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-a.ts', 'app/entry-b.ts'],
      root: dir,
      base: '/scripts',
    })
    let res = await get(handler, '/scripts/app/not-entry.ts')
    assert.equal(res, null)
  })
})

// ---------------------------------------------------------------------------
// Shared dependencies across entry points
// ---------------------------------------------------------------------------

describe('shared dependencies across entry points', () => {
  let dir: string
  before(async () => {
    dir = await makeTmpDir()
    await write(dir, 'app/shared.ts', 'export const shared = "shared"')
    await write(
      dir,
      'app/entry-a.ts',
      'import { shared } from "./shared.ts"\nexport const a = shared + "A"',
    )
    await write(
      dir,
      'app/entry-b.ts',
      'import { shared } from "./shared.ts"\nexport const b = shared + "B"',
    )
  })
  after(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('both entry points produce the same hash for their shared dep', async () => {
    let handler = createScriptHandler({
      entryPoints: ['app/entry-a.ts', 'app/entry-b.ts'],
      root: dir,
      base: '/scripts',
    })

    let resA = await get(handler, '/scripts/app/entry-a.ts')
    assert.ok(resA)
    let bodyA = await resA.text()
    let matchA = bodyA.match(/\/scripts\/app\/shared\.ts\.@([a-z0-9]+)/)
    assert.ok(matchA)

    let resB = await get(handler, '/scripts/app/entry-b.ts')
    assert.ok(resB)
    let bodyB = await resB.text()
    let matchB = bodyB.match(/\/scripts\/app\/shared\.ts\.@([a-z0-9]+)/)
    assert.ok(matchB)

    assert.equal(matchA[1], matchB[1], 'shared dep should have same hash regardless of entry point')
  })
})
