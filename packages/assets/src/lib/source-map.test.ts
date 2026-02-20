import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseInlineSourceMap, fixSourceMapPaths, fixSourceMapSources } from './source-map.ts'

describe('parseInlineSourceMap', () => {
  it('parses valid inline source map', () => {
    let sourceMap = {
      version: 3,
      sources: ['/entry.ts'],
      mappings: 'AAAA',
      sourcesContent: ['const x = 1'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `const x = 1;\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    assert.deepEqual(parsed!.sources, ['/entry.ts'])
    assert.deepEqual(parsed!.sourcesContent, ['const x = 1'])
    assert.equal(parsed!.mappings, 'AAAA')
  })

  it('returns null for code without source map', () => {
    let parsed = parseInlineSourceMap('const x = 1')
    assert.equal(parsed, null)
  })

  it('returns null for malformed base64', () => {
    let code = '//# sourceMappingURL=data:application/json;base64,not-valid-base64!!!'
    let parsed = parseInlineSourceMap(code)
    assert.equal(parsed, null)
  })

  it('extracts source map with URL paths (not filesystem paths)', () => {
    let sourceMap = {
      version: 3,
      sources: ['/components/App.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    assert.equal(parsed!.sources[0], '/components/App.tsx')
    assert.ok(!parsed!.sources[0].includes('/Users/'), 'Source should not contain filesystem path')
  })

  it('handles workspace URL paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['/__@assets/__@workspace/node_modules/@remix-run/component/src/index.ts'],
      mappings: 'AAAA',
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export {};\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    assert.equal(
      parsed!.sources[0],
      '/__@assets/__@workspace/node_modules/@remix-run/component/src/index.ts',
    )
  })
})

describe('fixSourceMapSources', () => {
  it('replaces sources array with single sourceUrl', () => {
    let mapJson = JSON.stringify({
      version: 3,
      sources: ['../App.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() {}'],
    })
    let fixed = fixSourceMapSources(mapJson, '/app/App.tsx')
    assert.ok(fixed !== null)
    let parsed = JSON.parse(fixed)
    assert.deepEqual(parsed.sources, ['/app/App.tsx'])
    assert.equal(parsed.sourcesContent[0], 'export function App() {}')
  })

  it('returns null on parse failure', () => {
    let invalid = 'not json'
    assert.equal(fixSourceMapSources(invalid, '/app/entry.tsx'), null)
  })
})

describe('fixSourceMapPaths', () => {
  it('fixes filesystem-relative paths to URL paths for app files', () => {
    let sourceMap = {
      version: 3,
      sources: ['../components/Counter.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function Counter() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function Counter() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let fixed = fixSourceMapPaths(code, '/assets/components/Counter.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed!.sources, ['/assets/components/Counter.tsx'])
  })

  it('fixes filesystem-relative paths to URL paths for virtual modules', () => {
    let sourceMap = {
      version: 3,
      sources: ['../../virtual/some-module.ts'],
      mappings: 'AAAA',
      sourcesContent: ['export function init() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function init() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let fixed = fixSourceMapPaths(code, '/__virtual/some-module.ts')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed!.sources, ['/__virtual/some-module.ts'])
    assert.deepEqual(parsed!.sourcesContent, ['export function init() {}'])
  })

  it('fixes filesystem-relative paths to URL paths for workspace files', () => {
    let sourceMap = {
      version: 3,
      sources: ['../../packages/component/src/index.ts'],
      mappings: 'AAAA',
      sourcesContent: ['export function createRoot() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function createRoot() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let fixed = fixSourceMapPaths(code, '/__@assets/__@workspace/packages/component/src/index.ts')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed!.sources, ['/__@assets/__@workspace/packages/component/src/index.ts'])
  })

  it('preserves mappings when fixing paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['../App.tsx'],
      mappings: 'AAAA,CAAC,CAAC,CAAC',
      sourcesContent: ['export function App() {}'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.equal(parsed!.mappings, 'AAAA,CAAC,CAAC,CAAC')
  })

  it('preserves sourcesContent when fixing paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['../App.tsx'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() { return <div>Hello</div> }'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed!.sourcesContent)
    assert.equal(parsed!.sourcesContent![0], 'export function App() { return <div>Hello</div> }')
  })

  it('handles code without source map gracefully', () => {
    let code = 'export function App() {}'
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')
    assert.equal(fixed, code)
  })

  it('handles malformed source map gracefully', () => {
    let code =
      'export function App() {}\n//# sourceMappingURL=data:application/json;base64,not-valid!!!'
    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')
    assert.equal(fixed, code)
  })

  it('replaces multiple sources with single sourceUrl', () => {
    let sourceMap = {
      version: 3,
      sources: ['../App.tsx', '../utils.ts'],
      mappings: 'AAAA',
      sourcesContent: ['export function App() {}', 'export const x = 1'],
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export function App() {}\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let fixed = fixSourceMapPaths(code, '/assets/App.tsx')

    let parsed = parseInlineSourceMap(fixed)
    assert.ok(parsed)
    assert.deepEqual(parsed!.sources, ['/assets/App.tsx'])
    assert.deepEqual(parsed!.sourcesContent, ['export function App() {}', 'export const x = 1'])
  })
})
