import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'

import {
  getLoader,
  getPackageName,
  isCommonJS,
  extractImportSpecifiers,
  parseInlineSourceMap,
  generateETag,
  matchesETag,
  createDevAssets,
} from './assets.ts'

describe('getLoader', () => {
  it('returns ts for .ts files', () => {
    assert.equal(getLoader('.ts'), 'ts')
  })

  it('returns tsx for .tsx files', () => {
    assert.equal(getLoader('.tsx'), 'tsx')
  })

  it('returns jsx for .jsx files', () => {
    assert.equal(getLoader('.jsx'), 'jsx')
  })

  it('returns js for .js files', () => {
    assert.equal(getLoader('.js'), 'js')
  })

  it('returns js for unknown extensions', () => {
    assert.equal(getLoader('.mjs'), 'js')
    assert.equal(getLoader('.cjs'), 'js')
    assert.equal(getLoader(''), 'js')
  })
})

describe('getPackageName', () => {
  it('extracts name from unscoped package', () => {
    assert.equal(getPackageName('lodash'), 'lodash')
  })

  it('extracts name from unscoped package with subpath', () => {
    assert.equal(getPackageName('lodash/map'), 'lodash')
    assert.equal(getPackageName('lodash/fp/map'), 'lodash')
  })

  it('extracts name from scoped package', () => {
    assert.equal(getPackageName('@remix-run/component'), '@remix-run/component')
  })

  it('extracts name from scoped package with subpath', () => {
    assert.equal(getPackageName('@remix-run/component/jsx-runtime'), '@remix-run/component')
    assert.equal(getPackageName('@remix-run/component/lib/utils'), '@remix-run/component')
  })

  it('returns null for incomplete scoped package', () => {
    assert.equal(getPackageName('@remix-run'), null)
  })

  it('handles edge cases', () => {
    assert.equal(getPackageName(''), '')
    assert.equal(getPackageName('a'), 'a')
    assert.equal(getPackageName('@a/b'), '@a/b')
  })
})

describe('isCommonJS', () => {
  describe('detects CJS patterns', () => {
    it('detects module.exports', () => {
      assert.equal(isCommonJS('module.exports = {}'), true)
      assert.equal(isCommonJS('module.exports.foo = bar'), true)
    })

    it('detects exports.property', () => {
      assert.equal(isCommonJS('exports.foo = bar'), true)
      assert.equal(isCommonJS('exports.default = fn'), true)
      assert.equal(isCommonJS('exports._private = x'), true)
      assert.equal(isCommonJS('exports.$special = y'), true)
    })

    it('detects require() without ESM syntax', () => {
      assert.equal(isCommonJS('const x = require("foo")'), true)
      assert.equal(isCommonJS("const x = require('foo')"), true)
      assert.equal(isCommonJS('require("foo")'), true)
    })
  })

  describe('identifies ESM', () => {
    it('returns false for import statements', () => {
      assert.equal(isCommonJS('import foo from "bar"'), false)
      assert.equal(isCommonJS('import { foo } from "bar"'), false)
      assert.equal(isCommonJS('import * as foo from "bar"'), false)
    })

    it('returns false for export statements', () => {
      assert.equal(isCommonJS('export default foo'), false)
      assert.equal(isCommonJS('export { foo }'), false)
      assert.equal(isCommonJS('export const foo = 1'), false)
    })

    it('returns false for ESM with require() calls', () => {
      // If there's ESM syntax, require() is allowed (dynamic require in ESM)
      assert.equal(isCommonJS('import foo from "bar"; require("baz")'), false)
      assert.equal(isCommonJS('export const x = require("y")'), false)
    })
  })

  describe('edge cases', () => {
    it('returns false for empty source', () => {
      assert.equal(isCommonJS(''), false)
    })

    it('returns false for plain JavaScript', () => {
      assert.equal(isCommonJS('const x = 1'), false)
      assert.equal(isCommonJS('function foo() {}'), false)
    })

    it('does not false-positive on similar patterns', () => {
      // "module.exports" in a string shouldn't trigger
      assert.equal(isCommonJS('const str = "module.exports"'), true) // This is a known limitation
      // But legitimate code patterns should work
      assert.equal(isCommonJS('const exports = {}'), false) // No exports.property
      assert.equal(isCommonJS('const module = {}'), false) // No module.exports
    })

    it('handles exports without valid property name', () => {
      assert.equal(isCommonJS('exports. = x'), false) // Invalid property
      assert.equal(isCommonJS('exports[0] = x'), false) // Bracket notation not matched
    })
  })
})

describe('extractImportSpecifiers', () => {
  describe('detects static imports', () => {
    it('detects default imports', async () => {
      let imports = await extractImportSpecifiers(`import foo from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects named imports', async () => {
      let imports = await extractImportSpecifiers(`import { foo, bar } from 'baz'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'baz')
    })

    it('detects namespace imports', async () => {
      let imports = await extractImportSpecifiers(`import * as foo from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects side-effect imports', async () => {
      let imports = await extractImportSpecifiers(`import 'side-effect'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'side-effect')
    })

    it('detects multiple imports', async () => {
      let code = `
        import a from 'pkg-a'
        import { b } from 'pkg-b'
        import 'pkg-c'
      `
      let imports = await extractImportSpecifiers(code)
      assert.equal(imports.length, 3)
      assert.deepEqual(
        imports.map((i) => i.specifier),
        ['pkg-a', 'pkg-b', 'pkg-c'],
      )
    })
  })

  describe('detects dynamic imports', () => {
    it('detects dynamic import with string literal', async () => {
      let imports = await extractImportSpecifiers(`const m = import('dynamic')`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'dynamic')
    })

    it('does not include dynamic import with variable', async () => {
      let imports = await extractImportSpecifiers(`const m = import(variable)`)
      assert.equal(imports.length, 0)
    })

    it('does not include dynamic import with expression', async () => {
      let imports = await extractImportSpecifiers(`const m = import('./path/' + name)`)
      assert.equal(imports.length, 0)
    })
  })

  describe('detects re-exports', () => {
    it('detects export from', async () => {
      let imports = await extractImportSpecifiers(`export { foo } from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects export * from', async () => {
      let imports = await extractImportSpecifiers(`export * from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })

    it('detects export * as from', async () => {
      let imports = await extractImportSpecifiers(`export * as ns from 'bar'`)
      assert.equal(imports.length, 1)
      assert.equal(imports[0].specifier, 'bar')
    })
  })

  describe('edge cases', () => {
    it('does not detect imports in strings', async () => {
      let imports = await extractImportSpecifiers(`const str = "import foo from 'bar'"`)
      assert.equal(imports.length, 0)
    })

    it('does not detect imports in template literals', async () => {
      let imports = await extractImportSpecifiers('const str = `import foo from "bar"`')
      assert.equal(imports.length, 0)
    })

    it('does not detect imports in comments', async () => {
      let imports = await extractImportSpecifiers(`// import foo from 'bar'`)
      assert.equal(imports.length, 0)
    })

    it('does not detect imports in block comments', async () => {
      let imports = await extractImportSpecifiers(`/* import foo from 'bar' */`)
      assert.equal(imports.length, 0)
    })

    it('provides correct positions', async () => {
      let code = `import foo from 'bar'`
      let imports = await extractImportSpecifiers(code)
      assert.equal(code.slice(imports[0].start, imports[0].end), 'bar')
    })

    it('handles empty source', async () => {
      let imports = await extractImportSpecifiers('')
      assert.equal(imports.length, 0)
    })

    it('handles source with no imports', async () => {
      let imports = await extractImportSpecifiers('const x = 1')
      assert.equal(imports.length, 0)
    })
  })
})

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
    assert.deepEqual(parsed.sources, ['/entry.ts'])
    assert.deepEqual(parsed.sourcesContent, ['const x = 1'])
    assert.equal(parsed.mappings, 'AAAA')
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
    // This is the key test: source maps should use URL paths like "/entry.ts"
    // not filesystem paths like "/Users/mark/project/app/entry.ts"
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
    // Source should be a URL path, not a filesystem path
    assert.equal(parsed.sources[0], '/components/App.tsx')
    assert.ok(!parsed.sources[0].includes('/Users/'), 'Source should not contain filesystem path')
    assert.ok(!parsed.sources[0].includes('C:\\'), 'Source should not contain Windows path')
  })

  it('handles fs URL paths', () => {
    let sourceMap = {
      version: 3,
      sources: ['/@fs/node_modules/@remix-run/component/src/index.ts'],
      mappings: 'AAAA',
    }
    let base64 = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
    let code = `export {};\n//# sourceMappingURL=data:application/json;base64,${base64}`

    let parsed = parseInlineSourceMap(code)

    assert.ok(parsed)
    assert.equal(parsed.sources[0], '/@fs/node_modules/@remix-run/component/src/index.ts')
  })
})

describe('generateETag', () => {
  it('generates weak ETag from mtime and size', () => {
    let mtime = new Date('2024-01-15T10:30:00Z')
    let size = 1234

    let etag = generateETag(mtime, size)

    assert.ok(etag.startsWith('W/"'), 'ETag should be weak (W/ prefix)')
    assert.ok(etag.endsWith('"'), 'ETag should end with quote')
  })

  it('generates different ETags for different mtimes', () => {
    let mtime1 = new Date('2024-01-15T10:30:00Z')
    let mtime2 = new Date('2024-01-15T10:30:01Z')
    let size = 1234

    let etag1 = generateETag(mtime1, size)
    let etag2 = generateETag(mtime2, size)

    assert.notEqual(etag1, etag2)
  })

  it('generates different ETags for different sizes', () => {
    let mtime = new Date('2024-01-15T10:30:00Z')

    let etag1 = generateETag(mtime, 1234)
    let etag2 = generateETag(mtime, 5678)

    assert.notEqual(etag1, etag2)
  })

  it('generates same ETag for same mtime and size', () => {
    let mtime = new Date('2024-01-15T10:30:00Z')
    let size = 1234

    let etag1 = generateETag(mtime, size)
    let etag2 = generateETag(mtime, size)

    assert.equal(etag1, etag2)
  })
})

describe('matchesETag', () => {
  it('returns false for null If-None-Match', () => {
    assert.equal(matchesETag(null, 'W/"abc"'), false)
  })

  it('returns true for exact match', () => {
    assert.equal(matchesETag('W/"abc"', 'W/"abc"'), true)
  })

  it('returns true for match without W/ prefix', () => {
    assert.equal(matchesETag('"abc"', 'W/"abc"'), true)
    assert.equal(matchesETag('W/"abc"', '"abc"'), true)
  })

  it('returns false for non-match', () => {
    assert.equal(matchesETag('W/"abc"', 'W/"xyz"'), false)
  })

  it('returns true for wildcard', () => {
    assert.equal(matchesETag('*', 'W/"abc"'), true)
  })

  it('handles multiple ETags in If-None-Match', () => {
    assert.equal(matchesETag('W/"abc", W/"def", W/"xyz"', 'W/"def"'), true)
    assert.equal(matchesETag('W/"abc", W/"def"', 'W/"xyz"'), false)
  })

  it('handles whitespace in multiple ETags', () => {
    assert.equal(matchesETag('W/"abc" , W/"def" , W/"xyz"', 'W/"def"'), true)
  })
})

describe('createDevAssets', () => {
  let tempDir: string

  // Create a temp directory with test files before each test
  function setupTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-test-'))
    fs.writeFileSync(path.join(tempDir, 'entry.tsx'), 'export default function App() {}')
    fs.mkdirSync(path.join(tempDir, 'components'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), 'export function Button() {}')
  }

  function cleanupTempDir() {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  describe('get()', () => {
    it('returns href as source path with leading slash', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns chunks as array containing only href', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.deepEqual(entry.chunks, ['/entry.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('handles nested paths', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('components/Button.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/components/Button.tsx')
        assert.deepEqual(entry.chunks, ['/components/Button.tsx'])
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes leading slashes in entry path', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('/entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('normalizes multiple leading slashes', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('///entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null if entry file does not exist', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)

        assert.equal(assets.get('nonexistent.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('returns null for nested non-existent paths', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)

        assert.equal(assets.get('missing/file.tsx'), null)
      } finally {
        cleanupTempDir()
      }
    })

    it('works with relative root path', () => {
      setupTempDir()
      try {
        // Get relative path from cwd to temp dir
        let relativePath = path.relative(process.cwd(), tempDir)
        let assets = createDevAssets(relativePath)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })

    it('works with absolute root path', () => {
      setupTempDir()
      try {
        let assets = createDevAssets(tempDir)
        let entry = assets.get('entry.tsx')

        assert.ok(entry, 'entry should not be null')
        assert.equal(entry.href, '/entry.tsx')
      } finally {
        cleanupTempDir()
      }
    })
  })
})
