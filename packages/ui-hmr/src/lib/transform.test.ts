import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { transformComponentsForBrowser, transformComponentsForServer } from './transform.ts'

describe('transformComponentsForBrowser', () => {
  it('rewrites exported PascalCase function components into HMR wrappers', () => {
    let result = transformComponentsForBrowser(
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
    assert.match(result.code, /import \* as __remixHmr from "@remix-run\/ui-hmr\/browser-runtime"/)
    assert.match(result.code, /import \* as __remixUIRefresh from "@remix-run\/ui\/dev\/refresh"/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
    assert.match(result.code, /__remixHmr\.registerComponentForHmr\(__remixUIRefresh/)
    assert.match(result.code, /__remixHmrComponentNames = \["Counter"\]/)
    assert.match(result.code, /Updated component module changed its exports/)
  })

  it('hoists setup variables into persistent HMR state', () => {
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(
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
    let result = transformComponentsForBrowser(source, { moduleUrl: '/app/loader.ts' })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform component modules with non-component runtime exports', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}

export const loader = () => new Response('ok')
`
    let result = transformComponentsForBrowser(source, { moduleUrl: '/app/Counter.tsx' })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform component modules with runtime re-exports', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}

export { loader } from './loader.ts'
`
    let result = transformComponentsForBrowser(source, { moduleUrl: '/app/Counter.tsx' })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('allows component modules with type-only exports', () => {
    let result = transformComponentsForBrowser(
      `export interface CounterProps {
  count: number
}

export function Counter() {
  return ({ count }: CounterProps) => <button>{count}</button>
}
`,
      { moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
  })
})

describe('transformComponentsForServer', () => {
  it('rewrites exported PascalCase function components into stateless HMR wrappers', () => {
    let result = transformComponentsForServer(
      `export function Counter(handle) {
  let count = 0
  return () => <button>{count}</button>
}
`,
      { moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /import \* as __remixHmr from "@remix-run\/ui-hmr\/server-runtime"/)
    assert.match(result.code, /function __remixHmrImpl_Counter\(handle\) \{/)
    assert.match(result.code, /let count = 0/)
    assert.match(result.code, /<button>\{count\}<\/button>/)
    assert.match(result.code, /export function Counter\(handle\) \{/)
    assert.match(
      result.code,
      /__remixHmr\.registerComponentForHmr\("file:\/\/\/app\/Counter\.tsx", "Counter", __remixHmrImpl_Counter\)/,
    )
    assert.match(result.code, /import\.meta\.hot\.accept\(\)/)
    assert.doesNotMatch(result.code, /getComponentHmrState/)
    assert.doesNotMatch(result.code, /setupComponentForHmr/)
    assert.doesNotMatch(result.code, /__remixUIRefresh/)
    assert.match(result.code, /__remixHmrComponentNames = \["Counter"\]/)
    assert.match(result.code, /Updated component module changed its exports/)
  })

  it('rewrites exported client entry function components without hoisting setup state', () => {
    let result = transformComponentsForServer(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
`,
      { moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixHmrImpl_Counter\(handle\) \{/)
    assert.match(result.code, /let count = 0/)
    assert.match(result.code, /children: count/)
    assert.match(
      result.code,
      /export const Counter = clientEntry\(import\.meta\.url, function Counter\(handle\)/,
    )
    assert.match(result.code, /__remixHmr\.getCurrentComponentForHmr/)
    assert.match(result.code, /import\.meta\.hot\.accept\(\)/)
    assert.doesNotMatch(result.code, /__s\.count/)
  })

  it('does not transform non-component functions', () => {
    let source = `export function loader() {
  return new Response('ok')
}
`
    let result = transformComponentsForServer(source, { moduleUrl: 'file:///app/loader.ts' })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform component modules with non-component runtime exports', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}

export const loader = () => new Response('ok')
`
    let result = transformComponentsForServer(source, { moduleUrl: 'file:///app/Counter.tsx' })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('allows component modules with type-only exports', () => {
    let result = transformComponentsForServer(
      `export type CounterProps = {
  count: number
}

export function Counter() {
  return ({ count }: CounterProps) => <button>{count}</button>
}
`,
      { moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
  })
})
