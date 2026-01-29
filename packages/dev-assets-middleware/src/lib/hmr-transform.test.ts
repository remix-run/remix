import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as prettier from 'prettier'

import { transformComponent, maybeHasComponent, HMR_RUNTIME_PATH } from './hmr-transform.ts'

/**
 * The HMR import that gets prepended to all transformed files.
 */
let HMR_IMPORT = `import {
  __hmr_state,
  __hmr_setup,
  __hmr_register,
  __hmr_call,
  __hmr_request_remount,
  __hmr_register_component,
  __hmr_get_component,
} from '${HMR_RUNTIME_PATH}'`

/**
 * Normalize setup hashes in code to a static value for comparison.
 * Hashes look like 'h1abc2d' - alphanumeric starting with 'h'.
 */
function normalizeHashes(code: string): string {
  // Match hash strings - any quoted string starting with 'h' followed by alphanumeric
  // This handles both single-line and multi-line __hmr_setup calls
  return code.replace(/'h[a-z0-9]+'/g, "'HASH'")
}

/**
 * Compare two code strings, ignoring formatting differences and hash values.
 * Uses Prettier to normalize both strings before comparison.
 */
async function expectCodeEqual(actual: string, expected: string): Promise<void> {
  let format = async (code: string) => {
    try {
      return await prettier.format(code, {
        parser: 'babel',
        semi: false,
        singleQuote: true,
        printWidth: 100,
      })
    } catch (error) {
      // If Prettier fails, show the raw code for debugging
      console.error('Prettier format failed for code:')
      console.error(code)
      throw error
    }
  }

  let formattedActual = normalizeHashes(await format(actual))
  let formattedExpected = normalizeHashes(await format(expected))

  assert.equal(formattedActual, formattedExpected)
}

// =============================================================================
// Transform Tests
// =============================================================================
// Tests use JS input (as if already transformed by esbuild from TSX).
// The transform detects PascalCase functions that return function expressions.

describe('transformComponent', () => {
  it('transforms a simple counter component', async () => {
    let input = `
export function Counter(handle) {
  let count = 0

  return () => <div>Count: {count}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (<div>Count: {__s.count}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms a component that accepts props', async () => {
    let input = `
export function App(handle) {
  return (props) => <div>{props.name}</div>
}
`

    let expected = `
${HMR_IMPORT}
function App__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/App.js', 'App', handle, (props) => (<div>{props.name}</div>))
  return (props) => __hmr_call(handle, props)
}
__hmr_register_component('/app/App.js', 'App', App__impl)
export function App(handle) {
  let impl = __hmr_get_component('/app/App.js', 'App')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/App.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms a component with multiple setup variables', async () => {
    let input = `
export function Counter(handle) {
  let count = 0
  let name = 'test'
  let active = true

  return () => (
    <div>{name}: {count} ({active ? 'yes' : 'no'})</div>
  )
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
    __s.name = 'test'
    __s.active = true
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (
    <div>{__s.name}: {__s.count} ({__s.active ? 'yes' : 'no'})</div>
  ))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms a component with no setup variables', async () => {
    let input = `
export function Static(handle) {
  return () => <div>Hello</div>
}
`

    let expected = `
${HMR_IMPORT}
function Static__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {})) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Static.js', 'Static', handle, () => (<div>Hello</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Static.js', 'Static', Static__impl)
export function Static(handle) {
  let impl = __hmr_get_component('/app/Static.js', 'Static')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Static.js')
    await expectCodeEqual(code, expected)
  })

  it('preserves imports before the component', async () => {
    let input = `
import { helper } from './utils.js'

export function Counter(handle) {
  let count = helper()

  return () => <div>{count}</div>
}
`

    let expected = `
${HMR_IMPORT}
import { helper } from './utils.js'
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = helper()
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (<div>{__s.count}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('does not transform non-component functions', async () => {
    let input = `
export function helper() {
  let x = 1
  return x + 1
}
`

    let { code } = await transformComponent(input, '/app/helper.js')

    // Should return unchanged (doesn't return a function)
    assert.equal(code, input)
  })

  it('does not transform lowercase functions', async () => {
    let input = `
export function counter(handle) {
  let count = 0
  return () => <div>{count}</div>
}
`

    let { code } = await transformComponent(input, '/app/counter.js')

    // Should return unchanged (not PascalCase)
    assert.equal(code, input)
  })

  it('generates different hashes for different setup code', async () => {
    let input1 = `
export function Counter(handle) {
  let count = 0

  return () => <div>{count}</div>
}
`

    let input2 = `
export function Counter(handle) {
  let count = 10

  return () => <div>{count}</div>
}
`

    let { code: result1 } = await transformComponent(input1, '/app/Counter.js')
    let { code: result2 } = await transformComponent(input2, '/app/Counter.js')

    let hashMatch1 = result1.match(/__hmr_setup\(handle, '([^']+)'/)
    let hashMatch2 = result2.match(/__hmr_setup\(handle, '([^']+)'/)

    assert.ok(hashMatch1, 'should have hash in result1')
    assert.ok(hashMatch2, 'should have hash in result2')
    assert.notEqual(hashMatch1![1], hashMatch2![1], 'hashes should differ')
  })

  it('generates consistent hashes for the same setup code', async () => {
    let input = `
export function Counter(handle) {
  let count = 0

  return () => <div>{count}</div>
}
`

    let { code: result1 } = await transformComponent(input, '/app/Counter.js')
    let { code: result2 } = await transformComponent(input, '/app/Counter.js')

    // Full output should be identical
    assert.equal(result1, result2)
  })

  it('transforms a non-exported component', async () => {
    let input = `
function Internal(handle) {
  let value = 42

  return () => <span>{value}</span>
}
`

    let expected = `
${HMR_IMPORT}
function Internal__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.value = 42
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Internal.js', 'Internal', handle, () => (<span>{__s.value}</span>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Internal.js', 'Internal', Internal__impl)
function Internal(handle) {
  let impl = __hmr_get_component('/app/Internal.js', 'Internal')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Internal.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms component with destructured handle', async () => {
    let input = `
export function Counter({ signal, params }) {
  let count = 0

  return () => <div>{count}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl({ signal, params }) {
  let __s = __hmr_state({
    signal: signal,
    params: params,
  })
  if (
    __hmr_setup(
      {
        signal: signal,
        params: params,
      },
      'HASH',
      () => {
        __s.count = 0
      },
    )
  ) {
    __hmr_request_remount({
      signal: signal,
      params: params,
    })
    return () => null
  }
  __hmr_register(
    '/app/Counter.js',
    'Counter',
    {
      signal: signal,
      params: params,
    },
    () => <div>{__s.count}</div>,
  )
    return () =>
    __hmr_call({
      signal: signal,
      params: params,
    })
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter({ signal, params }) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl({
    signal: signal,
    params: params,
  })
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms component returning regular function expression', async () => {
    let input = `
export function Counter(handle) {
  let count = 0

  return function() {
    return <div>{count}</div>
  }
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, function() {
    return <div>{__s.count}</div>
  })
  return function() {
    return __hmr_call(handle)
  }
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms const function expression component', async () => {
    let input = `
export const Counter = function(handle) {
  let count = 0

  return () => <div>{count}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (<div>{__s.count}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms const arrow function component with block body', async () => {
    let input = `
export const Counter = (handle) => {
  let count = 0

  return () => <div>{count}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (<div>{__s.count}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms const arrow function component with expression body', async () => {
    let input = `
export const Counter = (handle) => () => <div>Hello</div>
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (<div>Hello</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
export function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms let arrow function component', async () => {
    let input = `
let Counter = (handle) => {
  let count = 0
  return () => <div>{count}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Counter.js', 'Counter', handle, () => (<div>{__s.count}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Counter.js', 'Counter', Counter__impl)
function Counter(handle) {
  let impl = __hmr_get_component('/app/Counter.js', 'Counter')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Counter.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms multiple components in one file', async () => {
    let input = `
export function Header(handle) {
  let title = 'My App'
  return () => <header>{title}</header>
}

export function Footer(handle) {
  let year = 2024
  return () => <footer>© {year}</footer>
}
`

    let expected = `
${HMR_IMPORT}
function Header__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.title = 'My App'
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/components.js', 'Header', handle, () => (<header>{__s.title}</header>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/components.js', 'Header', Header__impl)
export function Header(handle) {
  let impl = __hmr_get_component('/app/components.js', 'Header')
  return impl(handle)
}
function Footer__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.year = 2024
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/components.js', 'Footer', handle, () => (<footer>© {__s.year}</footer>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/components.js', 'Footer', Footer__impl)
export function Footer(handle) {
  let impl = __hmr_get_component('/app/components.js', 'Footer')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/components.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms mixed components and non-components', async () => {
    let input = `
export function formatDate(date) {
  return date.toISOString()
}

export function Counter(handle) {
  let count = 0
  return () => <div>{count}</div>
}

export const PI = 3.14159
`

    // Only Counter should be transformed, others pass through
    let { code } = await transformComponent(input, '/app/mixed.js')

    // Check that Counter was transformed
    assert.ok(code.includes('Counter__impl'), 'Counter should be transformed')
    assert.ok(code.includes('__hmr_register_component'), 'Should have HMR registration')

    // Check that non-components pass through unchanged
    assert.ok(code.includes('export function formatDate(date)'), 'formatDate should pass through')
    assert.ok(code.includes('export const PI = 3.14159'), 'PI should pass through')
  })

  it('transforms component with addEventListener in setup', async () => {
    let input = `
export function Timer(handle) {
  let interval = setInterval(() => handle.update(), 1000)
  
  handle.signal.addEventListener('abort', () => {
    clearInterval(interval)
  })
  
  return () => <div>Tick</div>
}
`

    let expected = `
${HMR_IMPORT}
function Timer__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.interval = setInterval(() => handle.update(), 1000)
    handle.signal.addEventListener('abort', () => {
      clearInterval(__s.interval)
    })
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Timer.js', 'Timer', handle, () => (<div>Tick</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Timer.js', 'Timer', Timer__impl)
export function Timer(handle) {
  let impl = __hmr_get_component('/app/Timer.js', 'Timer')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Timer.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms component with function calls in setup', async () => {
    let input = `
export function Logger(handle) {
  let name = 'test'
  
  console.log('Component mounted:', name)
  handle.on(window, { resize: () => handle.update() })
  
  return () => <div>{name}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Logger__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.name = 'test'
    console.log('Component mounted:', __s.name)
    handle.on(window, {
      resize: () => handle.update(),
    })
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Logger.js', 'Logger', handle, () => (<div>{__s.name}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Logger.js', 'Logger', Logger__impl)
export function Logger(handle) {
  let impl = __hmr_get_component('/app/Logger.js', 'Logger')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Logger.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms component with conditional statements in setup', async () => {
    let input = `
export function Conditional(handle) {
  let value = 0
  
  if (value > 0) {
    console.log('positive')
  }
  
  return () => <div>{value}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Conditional__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.value = 0
    if (__s.value > 0) {
      console.log('positive')
    }
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Conditional.js', 'Conditional', handle, () => (<div>{__s.value}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Conditional.js', 'Conditional', Conditional__impl)
export function Conditional(handle) {
  let impl = __hmr_get_component('/app/Conditional.js', 'Conditional')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Conditional.js')
    await expectCodeEqual(code, expected)
  })

  it('generates different hashes when non-variable setup statements change', async () => {
    let input1 = `
export function Timer(handle) {
  let interval = setInterval(() => handle.update(), 1000)
  return () => <div>Tick</div>
}
`

    let input2 = `
export function Timer(handle) {
  let interval = setInterval(() => handle.update(), 2000)
  return () => <div>Tick</div>
}
`

    let { code: result1 } = await transformComponent(input1, '/app/Timer.js')
    let { code: result2 } = await transformComponent(input2, '/app/Timer.js')

    let hashMatch1 = result1.match(/__hmr_setup\(handle, '([^']+)'/)
    let hashMatch2 = result2.match(/__hmr_setup\(handle, '([^']+)'/)

    assert.ok(hashMatch1, 'should have hash in result1')
    assert.ok(hashMatch2, 'should have hash in result2')
    assert.notEqual(hashMatch1![1], hashMatch2![1], 'hashes should differ when setup code changes')
  })

  it('generates different hashes when addEventListener is added', async () => {
    let input1 = `
export function Timer(handle) {
  let interval = setInterval(() => handle.update(), 1000)
  return () => <div>Tick</div>
}
`

    let input2 = `
export function Timer(handle) {
  let interval = setInterval(() => handle.update(), 1000)
  
  handle.signal.addEventListener('abort', () => {
    clearInterval(interval)
  })
  
  return () => <div>Tick</div>
}
`

    let { code: result1 } = await transformComponent(input1, '/app/Timer.js')
    let { code: result2 } = await transformComponent(input2, '/app/Timer.js')

    let hashMatch1 = result1.match(/__hmr_setup\(handle, '([^']+)'/)
    let hashMatch2 = result2.match(/__hmr_setup\(handle, '([^']+)'/)

    assert.ok(hashMatch1, 'should have hash in result1')
    assert.ok(hashMatch2, 'should have hash in result2')
    assert.notEqual(
      hashMatch1![1],
      hashMatch2![1],
      'hashes should differ when cleanup listener is added',
    )
  })

  it('transforms component with multiple variable declarations in single statement', async () => {
    let input = `
export function Multi(handle) {
  let a = 1, b = 2, c = 3
  
  return () => <div>{a + b + c}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Multi__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.a = 1
    __s.b = 2
    __s.c = 3
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Multi.js', 'Multi', handle, () => (<div>{__s.a + __s.b + __s.c}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Multi.js', 'Multi', Multi__impl)
export function Multi(handle) {
  let impl = __hmr_get_component('/app/Multi.js', 'Multi')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Multi.js')
    await expectCodeEqual(code, expected)
  })

  it('transforms component with expression statements in setup', async () => {
    let input = `
export function Effects(handle) {
  let count = 0
  
  handle.queueTask(() => console.log('mounted'))
  Math.random()
  
  return () => <div>{count}</div>
}
`

    let expected = `
${HMR_IMPORT}
function Effects__impl(handle) {
  let __s = __hmr_state(handle)
  if (__hmr_setup(handle, 'HASH', () => {
    __s.count = 0
    handle.queueTask(() => console.log('mounted'))
    Math.random()
  })) {
    __hmr_request_remount(handle)
    return () => null
  }
  __hmr_register('/app/Effects.js', 'Effects', handle, () => (<div>{__s.count}</div>))
  return () => __hmr_call(handle)
}
__hmr_register_component('/app/Effects.js', 'Effects', Effects__impl)
export function Effects(handle) {
  let impl = __hmr_get_component('/app/Effects.js', 'Effects')
  return impl(handle)
}
`

    let { code } = await transformComponent(input, '/app/Effects.js')
    await expectCodeEqual(code, expected)
  })
})

// =============================================================================
// maybeHasComponent Tests
// =============================================================================

describe('maybeHasComponent', () => {
  it('detects function declaration components', () => {
    assert.equal(maybeHasComponent('function Counter(handle) { }'), true)
    assert.equal(maybeHasComponent('export function Counter(handle) { }'), true)
  })

  it('detects const/let function expression components', () => {
    assert.equal(maybeHasComponent('const Counter = function(handle) { }'), true)
    assert.equal(maybeHasComponent('let Counter = function(handle) { }'), true)
    assert.equal(maybeHasComponent('export const Counter = function(handle) { }'), true)
  })

  it('detects const/let arrow function components', () => {
    assert.equal(maybeHasComponent('const Counter = (handle) => { }'), true)
    assert.equal(maybeHasComponent('let Counter = () => { }'), true)
    assert.equal(maybeHasComponent('export const Counter = handle => { }'), true)
  })

  it('rejects lowercase function names', () => {
    assert.equal(maybeHasComponent('function counter(handle) { }'), false)
    assert.equal(maybeHasComponent('const counter = () => { }'), false)
  })

  it('rejects code without PascalCase declarations', () => {
    assert.equal(maybeHasComponent('let x = 5'), false)
    assert.equal(maybeHasComponent('return () => <div />'), false)
    assert.equal(maybeHasComponent('const data = fetch(url)'), false)
  })

  it('handles mixed code with components', () => {
    let code = `
      import { useState } from 'react'
      let helper = () => {}
      export function Counter(handle) {
        return () => <div />
      }
    `
    assert.equal(maybeHasComponent(code), true)
  })
})
