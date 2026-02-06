import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPackageName, isCommonJS, extractImportSpecifiers } from './import-rewriter.ts'

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
      assert.equal(isCommonJS('const exports = {}'), false)
      assert.equal(isCommonJS('const module = {}'), false)
    })

    it('handles exports without valid property name', () => {
      assert.equal(isCommonJS('exports. = x'), false)
      assert.equal(isCommonJS('exports[0] = x'), false)
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
  })

  describe('edge cases', () => {
    it('does not detect imports in strings', async () => {
      let imports = await extractImportSpecifiers(`const str = "import foo from 'bar'"`)
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
  })
})
