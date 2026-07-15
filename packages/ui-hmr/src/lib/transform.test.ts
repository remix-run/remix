import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SourceMapConsumer } from 'source-map-js/source-map.js'

import { transformComponentsForBrowser, transformComponentsForServer } from './transform.ts'

describe('transformComponentsForBrowser', () => {
  it('rewrites exported PascalCase function components into HMR wrappers', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return ({ count }) => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(\)/)
    assert.match(result.code, /export function Counter\(\)/)
    assert.match(
      result.code,
      /import \{ __uiHmrBrowserRuntime__ as __remixUiHmr__ \} from "@remix-run\/ui-hmr\/browser-runtime"/,
    )
    assert.match(result.code, /import \* as __remixUIRefresh__ from "@remix-run\/ui\/dev\/refresh"/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
    assert.match(result.code, /__remixUiHmr__\.registerComponentForHmr\(__remixUIRefresh__/)
    assert.match(result.code, /__remixUiHmrComponentNames__ = \["Counter"\]/)
    assert.doesNotMatch(result.code, /ComponentExportNames/)
    assert.match(result.code, /__remixUiHmrPreviousExports__ = \{\n  "Counter": Counter,\n\}/)
    assert.match(result.code, /Object\.keys\(module\)/)
    assert.match(result.code, /Object\.prototype\.hasOwnProperty\.call\(module, name\)/)
    assert.match(result.code, /Updated component module changed its exports/)
    assert.match(result.code, /Updated component module added export/)
    assert.match(result.code, /Updated component module removed export/)
    assert.match(result.code, /Updated component module changed non-component export/)
  })

  it('derives browser runtime imports from the import source', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: 'remix', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(
      result.code,
      /import \{ __uiHmrBrowserRuntime__ as __remixUiHmr__ \} from "remix\/ui-hmr\/browser-runtime"/,
    )
    assert.match(result.code, /import \* as __remixUIRefresh__ from "remix\/ui\/dev\/refresh"/)
  })

  it('supports custom browser runtime import sources', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@acme/remix', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(
      result.code,
      /import \{ __uiHmrBrowserRuntime__ as __remixUiHmr__ \} from "@acme\/remix\/ui-hmr\/browser-runtime"/,
    )
    assert.match(
      result.code,
      /import \* as __remixUIRefresh__ from "@acme\/remix\/ui\/dev\/refresh"/,
    )
  })

  it('generates source maps for transformed browser modules', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
      sourceMap: true,
    })

    assert.equal(result.transformed, true)
    assertSourceMapPosition(result.map, result.code, source, '<button>Count</button>')
  })

  it('hoists setup variables into persistent HMR state', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 0
  return () => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__remixUiHmr__\.getComponentHmrState/)
    assert.match(result.code, /__s__\.count = 0/)
    assert.match(result.code, /<button>\{__s__\.count\}<\/button>/)
    assert.match(result.code, /__remixUiHmr__\.callComponentRenderForHmr/)
  })

  it('hoists destructured setup variables into persistent HMR state', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let model = { count: 1 }
  let { count } = model
  return () => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s__\.model = \{ count: 1 \}/)
    assert.match(result.code, /let \{ count \} = __s__\.model/)
    assert.match(result.code, /__s__\.count = count/)
    assert.match(result.code, /<button>\{__s__\.count\}<\/button>/)
  })

  it('rewrites setup expressions that reference previously hoisted variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 0
  let next = count + 1
  count += 1
  let model = { count }
  let { value, ...rest } = model
  return () => <button title={value}>{count}{next}{rest.count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s__\.next = __s__\.count \+ 1/)
    assert.match(result.code, /__s__\.count \+= 1/)
    assert.match(result.code, /__s__\.model = \{ count: __s__\.count \}/)
    assert.match(result.code, /let \{ value, \.\.\.rest \} = __s__\.model/)
    assert.match(result.code, /<button title=\{__s__\.value\}>/)
    assert.match(result.code, /\{__s__\.count\}\{__s__\.next\}\{__s__\.rest\.count\}/)
    assert.doesNotMatch(result.code, /\{ __s__\.count \}/)
  })

  it('rewrites setup binding pattern expressions that reference previously hoisted variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 1
  let key = 'value'
  let model = { [key]: 2 }
  let { [key]: value = count } = model
  let [first = count] = []
  return () => <button>{value}{first}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s__\.model = \{ \[__s__\.key\]: 2 \}/)
    assert.match(
      result.code,
      /let \{ \[__s__\.key\]: value = __s__\.count \} = __s__\.model/,
    )
    assert.match(result.code, /let \[first = __s__\.count\] = \[\]/)
    assert.match(result.code, /<button>\{__s__\.value\}\{__s__\.first\}<\/button>/)
  })

  it('does not rewrite setup bindings that shadow previously hoisted variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let value = 'outer'
  function read(value) {
    let inner = value
    return inner
  }
  if (value) {
    let value = 'block'
    read(value)
  }
  let result = read(value)
  return () => <button>{value}{result}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s__\.value = 'outer'/)
    assert.match(result.code, /function read\(value\) \{\n\s+let inner = value\n\s+return inner\n\s+\}/)
    assert.match(result.code, /if \(__s__\.value\) \{\n\s+let value = 'block'\n\s+read\(value\)\n\s+\}/)
    assert.match(result.code, /__s__\.result = read\(__s__\.value\)/)
    assert.doesNotMatch(result.code, /let inner = __s__\.value/)
    assert.match(result.code, /<button>\{__s__\.value\}\{__s__\.result\}<\/button>/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /\(\{ count \}\) =>/)
    assert.match(result.code, /let next = count \+ 1/)
    assert.doesNotMatch(result.code, /\(\{ __s__\.count \}\) =>/)
    assert.doesNotMatch(result.code, /let next = __s__\.count \+ 1/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(\)/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(handle\)/)
    assert.match(
      result.code,
      /export const Counter = clientEntry\(import\.meta\.url, function Counter\(handle\)/,
    )
    assert.match(result.code, /__remixUiHmr__\.registerComponentForHmr\(__remixUIRefresh__/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /__s__\.label = "Initial"/)
    assert.match(result.code, /__s__\.count = 0/)
    assert.match(result.code, /children: __s__\.label \+ __s__\.count/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(handle\)/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(handle\)/)
    assert.match(result.code, /__name\(function Counter2\(handle\)/)
    assert.match(result.code, /"Counter"\)\)/)
    assert.match(result.code, /import\.meta\.hot\.accept/)
  })

  it('does not transform aliased component exports', () => {
    let source = `function Counter() {
  return () => <button>Count</button>
}

export { Counter as Renamed }
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform component-like exports with unsupported initializers', () => {
    let source = `function CounterA() {
  return () => <button>A</button>
}

function CounterB() {
  return () => <button>B</button>
}

export const Counter = Math.random() > 0.5 ? CounterA : CounterB
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform non-component functions', () => {
    let source = `export function loader() {
  return new Response('ok')
}
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/loader.ts',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('tracks unsupported component-like exports as non-component exports', () => {
    let result = transformComponentsForBrowser(
      `function CounterA() {
  return () => <button>A</button>
}

function CounterB() {
  return () => <button>B</button>
}

export const Selected = Math.random() > 0.5 ? CounterA : CounterB

export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(
      result.code,
      /__remixUiHmrPreviousExports__ = \{\n  "Selected": Selected,\n  "Counter": Counter,\n\}/,
    )
    assert.match(result.code, /Updated component module changed non-component export/)
  })

  it('transforms component modules with non-component tracked exports', () => {
    let result = transformComponentsForBrowser(
      `export const loader = () => new Response('ok')

export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(
      result.code,
      /__remixUiHmrPreviousExports__ = \{\n  "loader": loader,\n  "Counter": Counter,\n\}/,
    )
  })

  it('does not transform component modules with re-exported runtime values', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}

export { loader } from './loader.ts'
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('rejects updates with incompatible tracked exports', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /Updated component module added export/)
    assert.match(result.code, /Updated component module removed export/)
    assert.match(result.code, /Updated component module changed non-component export/)
    assert.match(result.code, /import\.meta\.hot\.invalidate\(__remixUiHmrInvalidationMessage__\)/)
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
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
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
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(
      result.code,
      /import \{ __uiHmrServerRuntime__ as __remixUiHmr__ \} from "@remix-run\/ui-hmr\/server-runtime"/,
    )
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(handle\) \{/)
    assert.match(result.code, /let count = 0/)
    assert.match(result.code, /<button>\{count\}<\/button>/)
    assert.match(result.code, /export function Counter\(handle\) \{/)
    assert.match(
      result.code,
      /__remixUiHmr__\.registerComponentForHmr\("file:\/\/\/app\/Counter\.tsx", "Counter", __remixUiHmrImpl_Counter__\)/,
    )
    assert.match(result.code, /import\.meta\.hot\.accept\(\(module\) =>/)
    assert.doesNotMatch(result.code, /getComponentHmrState/)
    assert.doesNotMatch(result.code, /setupComponentForHmr/)
    assert.doesNotMatch(result.code, /__remixUIRefresh__/)
    assert.match(result.code, /__remixUiHmrComponentNames__ = \["Counter"\]/)
    assert.doesNotMatch(result.code, /ComponentExportNames/)
    assert.match(result.code, /__remixUiHmrPreviousExports__ = \{\n  "Counter": Counter,\n\}/)
    assert.match(result.code, /Object\.keys\(module\)/)
    assert.match(result.code, /Object\.prototype\.hasOwnProperty\.call\(module, name\)/)
    assert.match(result.code, /Updated component module changed its exports/)
    assert.match(result.code, /Updated component module added export/)
    assert.match(result.code, /Updated component module removed export/)
    assert.match(result.code, /Updated component module changed non-component export/)
  })

  it('derives server runtime imports from the import source', () => {
    let result = transformComponentsForServer(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: 'remix', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(
      result.code,
      /import \{ __uiHmrServerRuntime__ as __remixUiHmr__ \} from "remix\/ui-hmr\/server-runtime"/,
    )
  })

  it('supports custom server runtime import sources', () => {
    let result = transformComponentsForServer(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@acme/remix', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(
      result.code,
      /import \{ __uiHmrServerRuntime__ as __remixUiHmr__ \} from "@acme\/remix\/ui-hmr\/server-runtime"/,
    )
  })

  it('generates source maps for transformed server modules', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}
`
    let result = transformComponentsForServer(source, {
      importSource: '@remix-run',
      moduleUrl: 'file:///app/Counter.tsx',
      sourceMap: true,
    })

    assert.equal(result.transformed, true)
    assertSourceMapPosition(result.map, result.code, source, '<button>Count</button>')
  })

  it('rewrites exported client entry function components without hoisting setup state', () => {
    let result = transformComponentsForServer(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(result.code, /function __remixUiHmrImpl_Counter__\(handle\) \{/)
    assert.match(result.code, /let count = 0/)
    assert.match(result.code, /children: count/)
    assert.match(
      result.code,
      /export const Counter = clientEntry\(import\.meta\.url, function Counter\(handle\)/,
    )
    assert.match(result.code, /__remixUiHmr__\.getCurrentComponentForHmr/)
    assert.match(result.code, /import\.meta\.hot\.accept\(\(module\) =>/)
    assert.doesNotMatch(result.code, /__s__\.count/)
  })

  it('does not transform non-component functions', () => {
    let source = `export function loader() {
  return new Response('ok')
}
`
    let result = transformComponentsForServer(source, {
      importSource: '@remix-run',
      moduleUrl: 'file:///app/loader.ts',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('transforms component modules with non-component tracked exports', () => {
    let result = transformComponentsForServer(
      `export const loader = () => new Response('ok')

export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.match(
      result.code,
      /__remixUiHmrPreviousExports__ = \{\n  "loader": loader,\n  "Counter": Counter,\n\}/,
    )
  })

  it('rejects updates with incompatible tracked exports', () => {
    let result = transformComponentsForServer(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.match(result.code, /import\.meta\.hot\.accept\(\(module\) =>/)
    assert.match(result.code, /Object\.keys\(module\)/)
    assert.match(result.code, /Updated component module added export/)
    assert.match(result.code, /Updated component module removed export/)
    assert.match(result.code, /Updated component module changed non-component export/)
    assert.match(result.code, /import\.meta\.hot\.invalidate\(__remixUiHmrInvalidationMessage__\)/)
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
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
  })
})

function assertSourceMapPosition(
  sourceMap: string | null,
  generatedSource: string,
  originalSource: string,
  search: string,
): void {
  assert.ok(sourceMap)
  let consumer = new SourceMapConsumer(JSON.parse(sourceMap))
  let generated = getLineAndColumn(generatedSource, search)
  let expected = getLineAndColumn(originalSource, search)
  let original = consumer.originalPositionFor(generated)

  assert.equal(original.line, expected.line)
  assert.equal(original.column, expected.column)
}

function getLineAndColumn(source: string, search: string): { column: number; line: number } {
  let index = source.indexOf(search)
  assert.notEqual(index, -1)

  let lines = source.slice(0, index).split('\n')
  return {
    column: lines.at(-1)?.length ?? 0,
    line: lines.length,
  }
}
