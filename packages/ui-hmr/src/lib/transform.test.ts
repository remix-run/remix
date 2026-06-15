import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { transformComponentHmr } from './transform.ts'

describe('transformComponentHmr', () => {
  it('rewrites exported PascalCase function components into HMR wrappers', () => {
    let result = transformComponentHmr(
      `export function Counter() {
  return ({ count }) => <button>{count}</button>
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixHmrImpl_Counter\(\)/)
    assert.match(result.code, /export function Counter\(\)/)
    assert.match(result.code, /import \* as __remixHmr from "@remix-run\/ui-hmr\/runtime"/)
    assert.match(result.code, /import \* as __remixUIRefresh from "@remix-run\/ui\/dev\/refresh"/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
    assert.match(result.code, /__remixHmr\.registerComponentForHmr\(__remixUIRefresh/)
  })

  it('hoists setup variables into persistent HMR state', () => {
    let result = transformComponentHmr(
      `export function Counter() {
  let count = 0
  return () => <button>{count}</button>
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__remixHmr\.getComponentHmrState/)
    assert.match(result.code, /__s\.count = 0/)
    assert.match(result.code, /<button>\{__s\.count\}<\/button>/)
    assert.match(result.code, /__remixHmr\.callComponentRenderForHmr/)
  })

  it('hoists destructured setup variables into persistent HMR state', () => {
    let result = transformComponentHmr(
      `export function Counter() {
  let model = { count: 1 }
  let { count } = model
  return () => <button>{count}</button>
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s\.model = \{ count: 1 \}/)
    assert.match(result.code, /let \{ count \} = __s\.model/)
    assert.match(result.code, /__s\.count = count/)
    assert.match(result.code, /<button>\{__s\.count\}<\/button>/)
  })

  it('does not rewrite render bindings that shadow setup variables', () => {
    let result = transformComponentHmr(
      `export function Counter() {
  let count = 0
  return ({ count }) => {
    let next = count + 1
    return <button>{next}</button>
  }
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /\(\{ count \}\) =>/)
    assert.match(result.code, /let next = count \+ 1/)
    assert.doesNotMatch(result.code, /\(\{ __s\.count \}\) =>/)
    assert.doesNotMatch(result.code, /let next = __s\.count \+ 1/)
  })

  it('rewrites PascalCase function components with separate named exports', () => {
    let result = transformComponentHmr(
      `function Counter() {
  return ({ count }) => jsx('button', { children: count })
}
export {
  Counter
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixHmrImpl_Counter\(\)/)
    assert.match(result.code, /function Counter\(\)/)
    assert.match(result.code, /export \{\s*Counter\s*\}/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
  })

  it('rewrites exported client entry function components', () => {
    let result = transformComponentHmr(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixHmrImpl_Counter\(handle\)/)
    assert.match(
      result.code,
      /export const Counter = clientEntry\(import\.meta\.url, function Counter\(handle\)/,
    )
    assert.match(result.code, /__remixHmr\.registerComponentForHmr\(__remixUIRefresh/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
  })

  it('hoists client entry setup variables into persistent HMR state', () => {
    let result = transformComponentHmr(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let label = "Initial"
  let count = 0
  return () => jsx('button', { children: label + count })
})
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s\.label = "Initial"/)
    assert.match(result.code, /__s\.count = 0/)
    assert.match(result.code, /children: __s\.label \+ __s\.count/)
  })

  it('rewrites client entry function components with separate named exports', () => {
    let result = transformComponentHmr(
      `const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
export {
  Counter
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixHmrImpl_Counter\(handle\)/)
    assert.match(
      result.code,
      /const Counter = clientEntry\(import\.meta\.url, function Counter\(handle\)/,
    )
    assert.match(result.code, /export \{\s*Counter\s*\}/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
  })

  it('rewrites client entry function components wrapped by transform helpers', () => {
    let result = transformComponentHmr(
      `const Counter = clientEntry(import.meta.url, __name(function Counter2(handle) {
  let count = 0
  return () => jsx('button', { children: count })
}, "Counter"))
export {
  Counter
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixHmrImpl_Counter\(handle\)/)
    assert.match(result.code, /__name\(function Counter2\(handle\)/)
    assert.match(result.code, /"Counter"\)\)/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
  })

  it('does not transform non-component functions', () => {
    let source = `export function loader() {
  return new Response('ok')
}
`
    let result = transformComponentHmr(source, { moduleUrl: '/app/loader.ts' })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })
})
