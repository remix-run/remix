import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { transformSync } from 'esbuild'
import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'

function compile(source: string, loader: 'js' | 'ts' | 'tsx' = 'js'): string {
  let result = transformSync(source, {
    loader,
    sourcemap: false,
  })

  return result.code.trim()
}

describe('mayContainCommonJSModuleGlobals', () => {
  it('skips comments that only mention require, module, and exports as words', () => {
    let source = `
      // require module exports
      /* exports module require */
    `
    assert.equal(mayContainCommonJSModuleGlobals(source), false)
  })

  it('skips function and variable names that only contain those words', () => {
    let source = `
      function requireFactory() {}
      let moduleCount = 1
      let exportsValue = 2
    `
    assert.equal(mayContainCommonJSModuleGlobals(source), false)
  })

  it('detects require calls with varying whitespace', () => {
    assert.equal(mayContainCommonJSModuleGlobals('let fs = require     ("node:fs")'), true)
  })

  it('detects require member access with varying whitespace', () => {
    assert.equal(mayContainCommonJSModuleGlobals('let x = require   .   resolve("pkg")'), true)
  })

  it('detects require bracket access', () => {
    assert.equal(mayContainCommonJSModuleGlobals('let x = require["resolve"]("pkg")'), true)
  })

  it('detects module.exports with varying whitespace', () => {
    assert.equal(mayContainCommonJSModuleGlobals('module   .   exports = {}'), true)
  })

  it('detects bracketed module exports with all quote types', () => {
    assert.equal(mayContainCommonJSModuleGlobals('module["exports"] = {}'), true)
    assert.equal(mayContainCommonJSModuleGlobals("module['exports'] = {}"), true)
    assert.equal(mayContainCommonJSModuleGlobals('module[`exports`] = {}'), true)
  })

  it('detects exports property access and assignment with varying whitespace', () => {
    assert.equal(mayContainCommonJSModuleGlobals('exports    = {}'), true)
    assert.equal(mayContainCommonJSModuleGlobals('exports   .   foo = 1'), true)
    assert.equal(mayContainCommonJSModuleGlobals('exports   ["foo"] = 1'), true)
    assert.equal(mayContainCommonJSModuleGlobals('exports   [`foo`] = 1'), true)
  })
})

describe('isCommonJS', () => {
  describe('module globals', () => {
    it('detects module.exports assignment', () => {
      assert.equal(isCommonJS(compile('module.exports = { foo: 1 }')), true)
    })

    it('detects module.exports member access', () => {
      assert.equal(isCommonJS(compile('module.exports.foo = function() {}')), true)
    })

    it('detects bracketed module exports with all quote types', () => {
      assert.equal(isCommonJS(compile('module["exports"] = { foo: 1 }')), true)
      assert.equal(isCommonJS(compile("module['exports'] = { foo: 1 }")), true)
      assert.equal(isCommonJS(compile('module[`exports`] = { foo: 1 }')), true)
    })

    it('detects exports property access with dot and bracket notation', () => {
      assert.equal(isCommonJS(compile('exports.foo = 42')), true)
      assert.equal(isCommonJS(compile('exports["foo"] = 42')), true)
      assert.equal(isCommonJS(compile("exports['foo'] = 42")), true)
      assert.equal(isCommonJS(compile('exports[`foo`] = 42')), true)
    })

    it('detects exports assignment with varying whitespace', () => {
      assert.equal(isCommonJS(compile('exports        = { foo: 1 }')), true)
    })

    it('detects require calls and member access with varying whitespace', () => {
      assert.equal(isCommonJS(compile('let fs = require     ("node:fs")')), true)
      assert.equal(isCommonJS(compile('let x = require   .   resolve("pkg")')), true)
      assert.equal(isCommonJS(compile('let x = require["resolve"]("pkg")')), true)
    })
  })

  describe('scope awareness', () => {
    it('does not flag a shadowed require parameter', () => {
      let source = compile('function load(require) { return require("pkg") }')
      assert.equal(isCommonJS(source), false)
    })

    it('does not flag a shadowed module variable', () => {
      let source = compile('let module = {}; module.exports = { foo: 1 }')
      assert.equal(isCommonJS(source), false)
    })

    it('does not flag a shadowed exports variable', () => {
      let source = compile('let exports = {}; exports.foo = 1; exports = {}')
      assert.equal(isCommonJS(source), false)
    })
  })

  describe('compiled output behavior', () => {
    it('flags CommonJS even when ESM syntax is also present', () => {
      let source = compile('import fs from "node:fs"\nlet x = require("pkg")')
      assert.equal(isCommonJS(source), true)
    })

    it('does not flag suspicious text in strings and comments', () => {
      let source = compile(`
        let a = "require('pkg')"
        let b = 'module.exports = {}'
        let c = \`exports.foo = 1\`
        // require.resolve('pkg')
        /* module["exports"] = {} */
        export { a, b, c }
      `)
      assert.equal(isCommonJS(source), false)
    })

    it('does not flag valid ESM output', () => {
      let source = compile('export function foo() { return 1 }')
      assert.equal(isCommonJS(source), false)
    })

    it('does not flag transformed TypeScript without CommonJS globals', () => {
      let source = compile(
        'import type { Foo } from "./foo.ts"\nexport function bar(value: Foo): Foo { return value }',
        'ts',
      )
      assert.equal(isCommonJS(source), false)
    })

    it('does not flag transformed TSX without CommonJS globals', () => {
      let source = compile('export function Button() { return <button>Hello</button> }', 'tsx')
      assert.equal(isCommonJS(source), false)
    })
  })
})
