import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { registerHooks } from 'node:module'
import { transformSync } from 'oxc-transform'
import type { Handle, RemixNode } from '@remix-run/component'
import { parseSync } from 'oxc-parser'
import { jsx } from '@remix-run/component/jsx-runtime'
import { renderToString } from '@remix-run/component/server'

import { transformComponentsForBrowser, transformComponentsForServer } from './transform.ts'

describe('transformComponentsForBrowser', () => {
  it('supports exported PascalCase function components', async (t) => {
    let source = `export function Counter() {
  return ({ count }) => <button>{count}</button>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    await fixture.update(source.replace('{count}', '{count * 2}'))
    assert.equal(await fixture.render({ count: 3 }), '<button>6</button>')
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
    assert.deepEqual(getImportSources(result.code), [
      'remix/component-hmr/runtime/browser',
      'remix/component/dev/refresh',
    ])
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
    assert.deepEqual(getImportSources(result.code), [
      '@acme/remix/component-hmr/runtime/browser',
      '@acme/remix/component/dev/refresh',
    ])
  })

  it('preserves setup variables across HMR updates', async (t) => {
    let source = `export function Counter(handle) {
  let count = 0
  handle.props.actions.setCount = (nextValue) => {
    count = nextValue
  }
  return () => <button>{count}</button>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    let setCount = fixture.actions.setCount

    setCount(5)

    await fixture.update(source.replace('{count}', '{count * 2}'))
    assert.equal(await fixture.render(), '<button>10</button>')

    setCount(9)
    assert.equal(await fixture.render(), '<button>18</button>')
  })

  it('preserves a setup function declaration passed as a JSX prop', async (t) => {
    let source = `function LandingNav(handle) {
  return () => handle.props.onJump(2)
}
export function LandingEnhancements(handle) {
  let preset = 0
  function jumpToPreset(index) {
    return (preset = index)
  }
  handle.props.actions.readPreset = () => preset
  return () => <output>{<LandingNav onJump={jumpToPreset} />}</output>
}
`
    let fixture = await createComponent(t, source, 'LandingEnhancements')
    let readPreset = fixture.actions.readPreset
    await fixture.update(
      source.replace('onJump={jumpToPreset}', 'onJump={(index) => jumpToPreset(index * 2)}'),
    )
    assert.equal(await fixture.render(), '<output>4</output>')
    assert.equal(readPreset(), 4)
  })

  it('preserves a setup function declaration invoked by render', async (t) => {
    let source = `export function Counter(handle) {
  let count = 1
  function getLabel() {
    return \`Count: \${count}\`
  }
  handle.props.actions.setCount = (nextValue) => {
    count = nextValue
  }
  return () => <p>{getLabel()}</p>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setCount(5)
    await fixture.update(source.replace('{getLabel()}', '{getLabel().toUpperCase()}'))
    assert.equal(await fixture.render(), '<p>COUNT: 5</p>')
  })

  it('preserves a hoisted setup function declaration after the render return', async (t) => {
    let source = `export function Counter(handle) {
  let count = 0
  return () => {
    handle.props.actions.increment = increment
    return <output>{count}</output>
  }
  function increment() {
    count++
  }
}
`
    let fixture = await createComponent(t, source, 'Counter')
    await fixture.update(source.replace('= increment', '= () => { increment(); increment() }'))
    await fixture.render()
    fixture.actions.increment()
    assert.equal(await fixture.render(), '<output>2</output>')
  })

  it('lets a var initializer override a function declaration after return', async (t) => {
    let source = `export function Component() {
  var handler = () => 'assigned'
  return () => handler()

  function handler() {
    return 'declaration'
  }
}
`
    let fixture = await createComponent(t, source)
    assert.equal(await fixture.render(), 'assigned')

    await fixture.update(
      source.replace('return () => handler()', 'return () => handler().toUpperCase()'),
    )
    assert.equal(await fixture.render(), 'ASSIGNED')
  })

  it('does not clear a hoisted function with an uninitialized var declaration', async (t) => {
    let source = `export function Component() {
  var handler
  return () => handler()

  function handler() {
    return 'declaration'
  }
}
`
    let fixture = await createComponent(t, source)
    assert.equal(await fixture.render(), 'declaration')

    await fixture.update(
      source.replace('return () => handler()', 'return () => handler().toUpperCase()'),
    )
    assert.equal(await fixture.render(), 'DECLARATION')
  })

  it('supports assignments after an uninitialized var with a shared function binding', async (t) => {
    let source = `export function Component() {
  var handler
  handler = () => 'assigned'
  return () => handler()

  function handler() {
    return 'declaration'
  }
}
`
    let fixture = await createComponent(t, source)
    assert.equal(await fixture.render(), 'assigned')

    await fixture.update(
      source.replace('return () => handler()', 'return () => handler().toUpperCase()'),
    )
    assert.equal(await fixture.render(), 'ASSIGNED')
  })

  it('preserves var assignment order when the function declaration precedes the render return', async (t) => {
    let source = `export function Component() {
  var handler = () => 'assigned'
  function handler() {
    return 'declaration'
  }
  return () => handler()
}
`
    let fixture = await createComponent(t, source)
    assert.equal(await fixture.render(), 'assigned')

    await fixture.update(
      source.replace('return () => handler()', 'return () => handler().toUpperCase()'),
    )
    assert.equal(await fixture.render(), 'ASSIGNED')
  })

  it('preserves multiple setup function declarations referenced by render', async (t) => {
    let source = `export function Greeting(handle) {
  let greeting = 'Hello'
  let name = 'Ada'
  function getGreeting() {
    return greeting
  }
  function getName() {
    return name
  }
  handle.props.actions.setState = (values) => {
    greeting = values.greeting
    name = values.name
  }
  return () => (
    <p>
      {getGreeting()}, {getName()}
    </p>
  )
}
`
    let fixture = await createComponent(t, source, 'Greeting')
    fixture.actions.setState({ greeting: 'Hi', name: 'Grace' })
    await fixture.update(source.replace('{getGreeting()}', '{getGreeting().toUpperCase()}'))
    assert.equal(await fixture.render(), '<p>HI, Grace</p>')
  })

  it('supports setup-only function declarations', async (t) => {
    let source = `export function Counter() {
  let count = 0
  function initialize() {
    count = 1
  }
  initialize()
  return () => <p>{count}</p>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    assert.equal(await fixture.render(), '<p>1</p>')

    await fixture.update(source.replace('{count}', '{count * 2}'))
    assert.equal(await fixture.render(), '<p>2</p>')
  })

  it('supports setup variables used as JSX element names', async (t) => {
    let source = `export function Parent(handle) {
  let Child = (child) => () => <span>{child.props.label ?? 'Child'}:initial</span>
  handle.props.actions.setChild = (label) => {
    Child = (child) => () => <span>{child.props.label ?? 'Child'}:{label}</span>
  }
  return () => <output>{<Child />}</output>
}
`
    let fixture = await createComponent(t, source, 'Parent')
    fixture.actions.setChild('retained')
    await fixture.update(source.replace('<Child />', '<Child label="Edited" />'))
    assert.equal(await fixture.render(), '<output><span>Edited:retained</span></output>')
  })

  it('preserves setup runtime declarations used as JSX element names or render values', async (t) => {
    let source = `export function Parent(handle) {
  let count = 1
  function Child(handle) {
    return () => <span>{handle.props.title}</span>
  }
  class Model {
    label = 'Ready'
  }
  enum Status {
    Ready = 'ready',
  }
  let original = { Child, Model, Status }
  handle.props.actions.setCount = (nextValue) => {
    count = nextValue
  }
  return () => (
    <output>
      {<Child title={new Model().label + Status.Ready + count} />}:
      {String(
        Child === original.Child &&
          Model === original.Model &&
          Status === original.Status,
      )}
    </output>
  )
}
`
    let fixture = await createComponent(t, source, 'Parent')
    fixture.actions.setCount(5)
    await fixture.update(
      source.replace(
        'new Model().label + Status.Ready + count',
        'new Model().label.toUpperCase() + Status.Ready + count * 2',
      ),
    )
    assert.equal(await fixture.render(), '<output><span>READYready10</span>:true</output>')
  })

  it('preserves destructured setup variables across HMR updates', async (t) => {
    let source = `export function Counter(handle) {
  let model = { count: 1 }
  let { count } = model
  handle.props.actions.setCount = (nextValue) => {
    count = nextValue
  }
  return () => <button>{count}</button>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setCount(5)
    await fixture.update(source.replace('{count}', '{count * 2}'))
    assert.equal(await fixture.render(), '<button>10</button>')
  })

  it('supports setup expressions that reference previously declared variables', async (t) => {
    let source = `export function Counter(handle) {
  let count = 0
  let next = count + 1
  count += 1
  let model = { count }
  let { value, ...rest } = model
  handle.props.actions.setState = (values) => {
    count = values.count
    next = values.next
    rest.count = values.restCount
  }
  return () => (
    <output>
      {count}:{next}:{rest.count}
    </output>
  )
}
`
    let fixture = await createComponent(t, source, 'Counter')
    assert.equal(await fixture.render(), '<output>1:1:1</output>')

    fixture.actions.setState({ count: 5, next: 6, restCount: 7 })
    await fixture.update(
      source.replace('{count}:{next}:{rest.count}', '{count + next + rest.count}'),
    )
    assert.equal(await fixture.render(), '<output>18</output>')
  })

  it('supports setup binding pattern expressions that reference previously declared variables', async (t) => {
    let source = `export function Counter(handle) {
  let count = 1
  let key = 'value'
  let model = { [key]: 2 }
  let { [key]: value = count, missing = count } = model
  let [first = count] = []
  handle.props.actions.setState = (values) => {
    value = values.value
    first = values.first
  }
  return () => (
    <button>
      {value}:{missing}:{first}
    </button>
  )
}
`
    let fixture = await createComponent(t, source, 'Counter')
    assert.equal(await fixture.render(), '<button>2:1:1</button>')

    fixture.actions.setState({ value: 7, first: 8 })
    await fixture.update(source.replace('{value}:{missing}:{first}', '{value + missing + first}'))
    assert.equal(await fixture.render(), '<button>16</button>')
  })

  it('supports setup closures that reference variables declared later', async (t) => {
    let source = `export function Component(handle) {
  let read = () => value
  let value = 1
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  return () => <output>{String(read())}</output>
}
`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('String(read())', 'String(read() * 2)'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('preserves setup bindings that shadow previously declared variables', async (t) => {
    let source = `export function Counter(handle) {
  let value = 'outer'
  function read(value) {
    let inner = value
    return inner
  }
  let blockResult
  if (value) {
    let value = 'block'
    blockResult = read(value)
  }
  let result = read(value)
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  return () => (
    <button>
      {value}
      {result}
      {blockResult}
    </button>
  )
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setValue('retained')
    await fixture.update(source.replace('{value}', '{value.toUpperCase()}'))
    assert.equal(await fixture.render(), '<button>RETAINEDouterblock</button>')
  })

  it('preserves render bindings that shadow setup variables', async (t) => {
    let source = `export function Counter(handle) {
  let getOuter = () => count
  let count = 0
  handle.props.actions.setCount = (nextValue) => {
    count = nextValue
  }
  return ({ count = 1 } = {}) => {
    let next = count + 1
    return (
      <button>
        {next}:{getOuter()}
      </button>
    )
  }
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setCount(5)
    await fixture.update(source.replace('let next = count + 1', 'let next = count * 3'))
    assert.equal(await fixture.render(), '<button>3:5</button>')
  })

  it('preserves render class declarations that shadow setup variables', async (t) => {
    let source = `export function Parent(handle) {
  let getOuter = () => Child
  let Child = 'setup'
  handle.props.actions.setChild = (nextValue) => {
    Child = nextValue
  }
  return () => {
    class Child {
      static label = 'Render child'
    }
    return (
      <p>
        {Child.label}:{getOuter()}
      </p>
    )
  }
}
`
    let fixture = await createComponent(t, source, 'Parent')
    fixture.actions.setChild('retained')
    await fixture.update(source.replace("'Render child'", "'Edited child'"))
    assert.equal(await fixture.render(), '<p>Edited child:retained</p>')
  })

  it('supports PascalCase function components with separate named exports', async (t) => {
    let source = `import { jsx } from '@remix-run/component/jsx-runtime'
function Counter(handle) {
  let value = 1
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  return ({ count = value } = {}) => (
    jsx('button', { children: count })
  )
}
export {
  Counter
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setValue(5)
    await fixture.update(source.replace('children: count', 'children: count * 2'))
    assert.equal(await fixture.render(), '<button>10</button>')
  })

  it('preserves client entry setup variables across HMR updates', async (t) => {
    let source = `import { jsx } from '@remix-run/component/jsx-runtime'
import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let label = 'Initial'
  let count = 0
  handle.props.actions.setState = (values) => {
    label = values.label
    count = values.count
  }
  return () => jsx('button', { children: label + count })
})
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setState({ label: 'Retained', count: 5 })
    await fixture.update(source.replace('label + count', 'label.toUpperCase() + count * 2'))
    assert.equal(await fixture.render(), '<button>RETAINED10</button>')
  })

  it('supports client entry function components with separate named exports', async (t) => {
    let source = `import { jsx } from '@remix-run/component/jsx-runtime'
import { clientEntry } from '@remix-run/component'
const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  handle.props.actions.setCount = (nextValue) => {
    count = nextValue
  }
  return () => jsx('button', { children: count })
})
export {
  Counter
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setCount(5)
    await fixture.update(source.replace('children: count', 'children: count * 2'))
    assert.equal(await fixture.render(), '<button>10</button>')
  })

  it('supports client entry function components wrapped by transform helpers', async (t) => {
    let source = `function __name(fn, name) {
  Object.defineProperty(fn, 'name', { value: name })
  return fn
}
import { jsx } from '@remix-run/component/jsx-runtime'
import { clientEntry } from '@remix-run/component'
const Counter = clientEntry(
  import.meta.url,
  __name(function Counter2(handle) {
    let count = 0
    handle.props.actions.setCount = (nextValue) => {
      count = nextValue
    }
    return () => jsx('button', { children: count })
  }, 'Counter'),
)
export {
  Counter
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setCount(5)
    await fixture.update(source.replace('children: count', 'children: count * 2'))
    assert.equal(await fixture.render(), '<button>10</button>')
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

  it('tracks unsupported component-like exports as non-component exports', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    let source = `function First() { return () => 'first' }
function Second() { return () => 'second' }
export const Selected = true ? First : Second
${plainComponentSource}`
    await host.load(source)
    await host.update(source.replace("'Count'", "'Updated'"))
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "Selected"',
    ])
  })

  it('transforms component modules with non-component tracked exports', async (t) => {
    let source = `export const value = 1
export function Counter(handle) {
  return () => <button>{value}</button>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    await fixture.update(source.replace('{value}', '{value * 2}'))
    assert.equal(await fixture.render(), '<button>2</button>')
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

  it('invalidates while evaluating an added component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    await host.load(plainComponentSource)
    await host.load(`${plainComponentSource}\nexport function Added() { return () => null }`)
    assert.deepEqual(host.messages, ['Updated component module changed its exports'])
  })

  it('invalidates while evaluating a removed component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    await host.load(`${plainComponentSource}\nexport function Removed() { return () => null }`)
    await host.load(plainComponentSource)
    assert.deepEqual(host.messages, ['Updated component module changed its exports'])
  })

  it('invalidates an added non-component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    await host.load(plainComponentSource)
    await host.update(`${plainComponentSource}\nexport const value = true`)
    assert.deepEqual(host.messages, ['Updated component module added export "value"'])
  })

  it('invalidates a removed non-component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    await host.load(`${plainComponentSource}\nexport const value = true`)
    await host.update(plainComponentSource)
    assert.deepEqual(host.messages, ['Updated component module removed export "value"'])
  })

  it('invalidates a changed non-component primitive export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    await host.load(`${plainComponentSource}\nexport const value = true`)
    await host.update(`${plainComponentSource}\nexport const value = false`)
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "value"',
    ])
  })

  it('invalidates a recreated non-component object export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    let source = `${plainComponentSource}\nexport const value = {}`
    await host.load(source)
    await host.update(source)
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "value"',
    ])
  })

  it('invalidates an update that recreates a non-component function export', async (t) => {
    let host = createModuleHost(t, transformComponentsForBrowser)
    let source = `export const loader = () => new Response('ok')
export function Component() {
  return () => 'Count'
}`
    await host.load(source)
    await host.update(source.replace("'Count'", "'Updated'"))
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "loader"',
    ])
  })

  it('allows component modules with type-only exports', async (t) => {
    let source = `export interface Model {
  count: number
}
export function Counter(handle) {
  let model: Model = { count: 1 }
  handle.props.actions.setCount = (nextValue) => {
    model = { count: nextValue }
  }
  return () => <button>{model.count}</button>
}
`
    let fixture = await createComponent(t, source, 'Counter')
    fixture.actions.setCount(5)
    await fixture.update(source.replace('{model.count}', '{model.count * 2}'))
    assert.equal(await fixture.render(), '<button>10</button>')
  })

  it('reports supported component export names separately from other exports', () => {
    let result = transformComponentsForBrowser(
      `import { clientEntry } from '@remix-run/component'
export function Component() {
  return () => 'plain'
}
export const Entry = clientEntry(import.meta.url, function Entry() {
  return () => 'entry'
})
export const Selected = true ? Component : Entry
export function loader() {
  return new Response('ok')
}
export interface Props {
  count: number
}`,
      { importSource: '@remix-run', moduleUrl: '/app/Component.tsx' },
    )
    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Component', 'Entry'])
  })

  it('accepts updates retaining the same imported non-component object', async (t) => {
    let source = `import * as component from '@remix-run/component'
export { component as stable }
export function Component(handle) {
  return () => <output>v1:{1}</output>
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('{1}', '{2}').replaceAll('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:2</output>')
  })

  it('preserves super receivers in refreshed class methods', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  return () => {
    class Base {
      read() {
        return this.offset + value
      }
    }
    class Derived extends Base {
      offset = 1
      read() {
        return super.read()
      }
    }
    return <output>v1:{new Derived().read()}</output>
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(
      source
        .replace(
          '<output>v1:{new Derived().read()}</output>',
          '<output>v1:{new Derived().read() * 2}</output>',
        )
        .replaceAll('v1:', 'v2:'),
    )
    assert.equal(await fixture.render(), '<output>v2:12</output>')
  })

  it('shares computed getter and setter writes with retained setup bindings', async (t) => {
    let source = `export function Component(handle) {
  let key = 'current'
  let value = 1
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  handle.props.actions.readValue = () => value
  return () => {
    let reader = {
      get [key]() {
        return value
      },
      set [key](next) {
        value = next
      },
    }
    reader[key] += 1
    return <output>v1:{reader[key]}</output>
  }
}`
    let fixture = await createComponent(t, source)
    let readValue = fixture.actions.readValue
    fixture.actions.setValue(5)
    await fixture.update(
      source.replace('reader[key] += 1', 'reader[key] += 2').replaceAll('v1:', 'v2:'),
    )
    assert.equal(await fixture.render(), '<output>v2:7</output>')
    assert.equal(readValue(), 7)
  })

  it('preserves shadowed bindings in setup initializer callbacks', async (t) => {
    let source = `export function Component(handle) {
  let argument = 1
  let read = (read) => read
  let local = () => {
    let local = 2
    return local
  }
  handle.props.actions.setArgument = (nextValue) => {
    argument = nextValue
  }
  return () => <output>v1:{String(read(argument) + local())}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setArgument(3)
    await fixture.update(
      source
        .replace('read(argument) + local()', 'read(argument) * local()')
        .replaceAll('v1:', 'v2:'),
    )
    assert.equal(await fixture.render(), '<output>v2:6</output>')
  })

  it('writes array destructuring assignments to retained bindings after updates', async (t) => {
    let source = `export function Component(handle) {
  let value = 0
  handle.props.actions.readValue = () => value
  return () => {
    ;[value] = [2]
    return <output>v1:{String(value)}</output>
  }
}`
    let fixture = await createComponent(t, source)
    let readValue = fixture.actions.readValue
    await fixture.update(source.replace('[value] = [2]', '[value] = [4]').replaceAll('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:4</output>')
    assert.equal(readValue(), 4)
  })

  it('retains JSX member expression component bindings across updates', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  let UI = { value: (handle) => () => <span>{handle.props.value}</span> }
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  return () => {
    return <output>v1:{<UI.value value={value} />}</output>
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(
      source
        .replace(
          '<output>v1:{<UI.value value={value} />}</output>',
          '<output>v1:{<UI.value value={value * 2} />}</output>',
        )
        .replaceAll('v1:', 'v2:'),
    )
    assert.equal(await fixture.render(), '<output>v2:<span>10</span></output>')
  })
})

describe('transformComponentsForServer', () => {
  it('supports exported PascalCase function components without retaining setup state', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `export function Counter() {
  let count = 0
  return () => <button>v1:{++count}</button>
}`
    let Counter = getComponent(await host.load(source), 'Counter')
    assert.equal(await renderToString(jsx(Counter, {})), '<button>v1:1</button>')
    assert.equal(await renderToString(jsx(Counter, {})), '<button>v1:1</button>')
    await host.update(source.replace('v1:', 'v2:').replace('++count', '++count * 2'))
    assert.equal(await renderToString(jsx(Counter, {})), '<button>v2:2</button>')
    assert.equal(await renderToString(jsx(Counter, {})), '<button>v2:2</button>')
    assert.deepEqual(host.messages, [])
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
    assert.deepEqual(getImportSources(result.code), ['remix/component-hmr/runtime/server'])
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
    assert.deepEqual(getImportSources(result.code), ['@acme/remix/component-hmr/runtime/server'])
  })

  it('supports exported client entry function components without retaining setup state', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, function Counter() {
  let count = 0
  return () => <button>v1:{++count}</button>
})`
    let Counter = getComponent(await host.load(source), 'Counter')
    assert.match(await renderToString(jsx(Counter, {})), /<button>v1:1<\/button>/)
    assert.match(await renderToString(jsx(Counter, {})), /<button>v1:1<\/button>/)
    await host.update(source.replace('v1:', 'v2:').replace('++count', '++count * 2'))
    assert.match(await renderToString(jsx(Counter, {})), /<button>v2:2<\/button>/)
    assert.match(await renderToString(jsx(Counter, {})), /<button>v2:2<\/button>/)
    assert.deepEqual(host.messages, [])
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

  it('transforms component modules with non-component tracked exports', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `import * as component from '@remix-run/component'
export { component as stable }
export function Counter() {
  return () => 'Count'
}`
    let Counter = getComponent(await host.load(source), 'Counter')
    await host.update(source.replace("'Count'", "'Updated'"))
    assert.deepEqual(host.messages, [])
    assert.equal(await renderToString(jsx(Counter, {})), 'Updated')
  })

  it('invalidates while evaluating an added component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    await host.load(plainComponentSource)
    await host.load(`${plainComponentSource}\nexport function Added() { return () => null }`)
    assert.deepEqual(host.messages, ['Updated component module changed its exports'])
  })

  it('invalidates while evaluating a removed component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    await host.load(`${plainComponentSource}\nexport function Removed() { return () => null }`)
    await host.load(plainComponentSource)
    assert.deepEqual(host.messages, ['Updated component module changed its exports'])
  })

  it('invalidates an added non-component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    await host.load(plainComponentSource)
    await host.update(`${plainComponentSource}\nexport const value = true`)
    assert.deepEqual(host.messages, ['Updated component module added export "value"'])
  })

  it('invalidates a removed non-component export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    await host.load(`${plainComponentSource}\nexport const value = true`)
    await host.update(plainComponentSource)
    assert.deepEqual(host.messages, ['Updated component module removed export "value"'])
  })

  it('invalidates a changed non-component primitive export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    await host.load(`${plainComponentSource}\nexport const value = true`)
    await host.update(`${plainComponentSource}\nexport const value = false`)
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "value"',
    ])
  })

  it('invalidates a recreated non-component object export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `${plainComponentSource}\nexport const value = {}`
    await host.load(source)
    await host.update(source)
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "value"',
    ])
  })

  it('invalidates an update that recreates a non-component function export', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `export const loader = () => new Response('ok')
export function Component() {
  return () => 'Count'
}`
    await host.load(source)
    await host.update(source.replace("'Count'", "'Updated'"))
    assert.deepEqual(host.messages, [
      'Updated component module changed non-component export "loader"',
    ])
  })

  it('allows component modules with type-only exports', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `export type CounterProps = {
  count: number
}

export function Counter(handle) {
  let props: CounterProps = handle.props
  return () => <button>v1:{props.count}</button>
}`
    let Counter = getComponent(await host.load(source), 'Counter')
    assert.equal(await renderToString(jsx(Counter, { count: 2 })), '<button>v1:2</button>')
    await host.update(source.replace('v1:', 'v2:').replace('props.count}', 'props.count * 3}'))
    assert.equal(await renderToString(jsx(Counter, { count: 2 })), '<button>v2:6</button>')
    assert.deepEqual(host.messages, [])
  })

  it('reports supported component export names separately from other exports', () => {
    let result = transformComponentsForServer(
      `import { clientEntry } from '@remix-run/component'
export function Component() {
  return () => 'plain'
}
export const Entry = clientEntry(import.meta.url, function Entry() {
  return () => 'entry'
})
export const Selected = true ? Component : Entry
export function loader() {
  return new Response('ok')
}
export type Props = { count: number }`,
      { importSource: '@remix-run', moduleUrl: '/app/Component.tsx' },
    )
    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Component', 'Entry'])
  })
})

function getImportSources(code: string): string[] {
  return parseSync('component.tsx', code, { sourceType: 'module' })
    .program.body.filter((node) => node.type === 'ImportDeclaration')
    .map((node) => node.source.value)
}

describe('server client-entry boundary compatibility', () => {
  it('invalidates while evaluating an added or removed client entry', async (t) => {
    await assertClientEntryStatusChanges(t, transformComponentsForServer)
  })

  it('accepts repeated render-only edits with unchanged entry status', async (t) => {
    for (let initial of [plainComponentSource, clientEntryComponentSource]) {
      let host = createModuleHost(t, transformComponentsForServer)
      let Component = getComponent(await host.load(initial), 'Component')
      assert.match(await renderToString(jsx(Component, {})), /Count/)
      for (let label of ['One', 'Two', 'Three']) {
        await host.update(initial.replace("'Count'", JSON.stringify(label)))
        assert.deepEqual(host.messages, [])
        assert.match(await renderToString(jsx(Component, {})), new RegExp(label))
      }
    }
  })

  it('renders updated plain and client-entry components from the same module', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `import { clientEntry } from '@remix-run/component'
export const Other = clientEntry(import.meta.url, function Other() {
  return () => <span>entry:Count</span>
})
export function Component() {
  return () => (
    <main>
      plain:Count
      <Other />
    </main>
  )
}`
    let module = await host.load(source)
    await host.update(source.replaceAll('Count', 'Updated'))
    let after = await renderToString(jsx(getComponent(module, 'Component'), {}))
    assert.match(after, /plain:Updated/)
    assert.match(after, /<span>entry:Updated<\/span>/)
    assert.deepEqual(host.messages, [])
  })
})

describe('browser client-entry boundary compatibility', () => {
  it('invalidates while evaluating an added or removed client entry', async (t) => {
    await assertClientEntryStatusChanges(t, transformComponentsForBrowser)
  })
})

const plainComponentSource = `export function Component() {
  return () => 'Count'
}`
const clientEntryComponentSource = `import { clientEntry } from '@remix-run/component'
export const Component = clientEntry(import.meta.url, function Component() {
  return () => 'Count'
})`

async function assertClientEntryStatusChanges(
  t: TestContext,
  transform: typeof transformComponentsForServer,
): Promise<void> {
  for (let [before, after] of [
    [plainComponentSource, clientEntryComponentSource],
    [clientEntryComponentSource, plainComponentSource],
  ]) {
    let host = createModuleHost(t, transform)
    await host.load(before)
    // Invalidation must happen during module evaluation, before calling the accept handler.
    await host.load(after)
    assert.deepEqual(host.messages, ['Updated component module changed its client entries'])
  }
}

describe('browser component HMR updates', () => {
  it('does not rerun setup for render-only updates', async (t) => {
    let source = `export function Component(handle) {
  handle.props.actions.createdInSetup = () => 'setup'
  return () => <output>v1</output>
}`
    let fixture = await createComponent(t, source)
    let createdInSetup = fixture.actions.createdInSetup
    assert.equal(createdInSetup(), 'setup')
    await fixture.update(source.replace('v1', 'v2'))
    await fixture.update(source.replace('v1', 'v3'))
    assert.equal(fixture.actions.createdInSetup, createdInSetup)
  })

  it('shares initializer captures and render assignments across repeated updates', async (t) => {
    let source = `export function Component(handle) {
  let model = {
    count: 0,
    increment() {
      model.count++
    },
  }
  handle.props.actions.originalIncrement = model.increment
  return () => {
    handle.props.actions.increment = model.increment
    handle.props.actions.reset = () => {
      model = { ...model, count: 10 }
    }
    return <output>v1:{model.count}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.render()
    fixture.actions.increment()
    await fixture.update(source.replace('v1:', 'v2:').replace('{model.count}', '{model.count * 2}'))
    assert.equal(await fixture.render(), '<output>v2:2</output>')
    fixture.actions.reset()
    fixture.actions.increment()
    assert.equal(await fixture.render(), '<output>v2:22</output>')
    await fixture.update(source.replace('v1:', 'v3:').replace('{model.count}', '{model.count * 3}'))
    assert.equal(await fixture.render(), '<output>v3:33</output>')
    fixture.actions.originalIncrement()
    assert.equal(await fixture.render(), '<output>v3:36</output>')
  })

  it('runs abort callbacks registered before their setup binding after an update', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  handle.signal.addEventListener('abort', () => reset())
  let reset = () => {
    handle.props.actions.readValue = () => value
  }
  handle.props.actions.setValue = (nextValue) => {
    value = nextValue
  }
  return () => <output>v1:{value}</output>
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    fixture.actions.setValue(9)
    fixture.close()
    assert.equal(fixture.actions.readValue(), 9)
  })

  it('updates retained spread attributes inside JSX fragments', async (t) => {
    let source = `export function Component(handle) {
  let props = { placeholder: 'initial' }
  handle.props.actions.setProps = (nextProps) => {
    props = nextProps
  }
  return () => (
    <>
      <input {...props} />
      {/* comment */}
    </>
  )
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setProps({ placeholder: 'retained' })
    await fixture.update(
      source.replace('<input {...props} />', '<input {...props} title="updated" />'),
    )
    assert.equal(await fixture.render(), '<input placeholder="retained" title="updated" />')
  })

  it('refreshes asynchronous callbacks containing dynamic imports', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  handle.props.actions.readValue = () => value
  return () => {
    handle.props.actions.add = async () => {
      let module = await import('@remix-run/component', { with: value > 0 ? {} : {} })
      if (module.createRoot) value += 1
    }
    return <output>v1:{value}</output>
  }
}`
    let fixture = await createComponent(t, source)
    let readValue = fixture.actions.readValue
    await fixture.update(source.replace('v1:', 'v2:').replace('value += 1', 'value += 3'))
    await fixture.render()
    await fixture.actions.add()
    assert.equal(await fixture.render(), '<output>v2:4</output>')
    assert.equal(readValue(), 4)
  })

  it('updates mixed plain and client-entry components through repeated edits', async (t) => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Child = clientEntry(import.meta.url, function Child(handle) {
  return () => <span>child:{handle.props.value}</span>
})
export function Component() {
  let value = 1
  return () => <output>v1:parent:{value}</output>
}`
    let host = createModuleHost(t)
    let module = await host.load(source)
    let Child = getComponent(module, 'Child')
    let controller = new AbortController()
    t.after(() => controller.abort())
    let handle = { signal: controller.signal, props: { value: 2 } }
    let parent = getComponent(module, 'Component')(handle)
    let child: unknown = Child({ ...handle })
    assert.ok(typeof child === 'function')
    await host.update(source.replace('v1:', 'v2:').replace('child:', 'updated child:'))
    assert.equal(await renderToString(parent()), '<output>v2:parent:1</output>')
    assert.equal(await renderToString(child()), '<span>updated child:2</span>')
    await host.update(source.replace('v1:', 'v3:').replace('parent:', 'updated parent:'))
    assert.equal(await renderToString(parent()), '<output>v3:updated parent:1</output>')
    assert.equal(await renderToString(child()), '<span>child:2</span>')
    assert.deepEqual(host.messages, [])
  })
})

async function createComponent(t: TestContext, source: string, componentName = 'Component') {
  let host = createModuleHost(t)
  let actions: Record<string, (...args: unknown[]) => unknown> = {}
  let controller = new AbortController()
  t.after(() => controller.abort())
  let Component = getComponent(await host.load(source), componentName)
  let render = Component({ signal: controller.signal, props: { actions } })
  return {
    actions,
    close: () => controller.abort(),
    render: (...args: unknown[]) => renderToString(render(...args)),
    async update(next: string) {
      await host.update(next)
      assert.deepEqual(host.messages, [])
    },
  }
}

type ComponentFunction = (
  handle: Pick<Handle<Record<string, unknown>>, 'signal' | 'props'>,
) => (...args: unknown[]) => RemixNode

type HotContext = {
  data: Record<string, unknown>
  accept(callback: (module: unknown) => void): void
  invalidate(message: string): void
}

declare global {
  var __componentHmrTestHot: HotContext | undefined
}

let nextModuleId = 0

function createModuleHost(t: TestContext, transform = transformComponentsForBrowser) {
  let moduleUrl = `/test/component-${++nextModuleId}.tsx`
  let revision = 0
  let data = {}
  let acceptCallbacks: Array<(module: unknown) => void> = []
  let messages: string[] = []
  let prefix = `data:text/javascript;component-hmr=${nextModuleId},`
  let hooks = registerHooks({
    resolve(specifier, context, next) {
      // Resolve the in-memory module's package imports from this package.
      if (context.parentURL?.startsWith(prefix)) {
        return next(specifier, { ...context, parentURL: import.meta.url })
      }
      return next(specifier, context)
    },
  })
  t.after(() => hooks.deregister())

  async function load(source: string): Promise<unknown> {
    let result = transform(source, { importSource: '@remix-run', moduleUrl })
    assert.ok(result.transformed, 'Expected a component HMR boundary')
    let compiled = transformSync('component.tsx', result.code, {
      lang: 'tsx',
      sourceType: 'module',
      jsx: { runtime: 'automatic', importSource: '@remix-run/component' },
    })
    assert.deepEqual(compiled.errors, [])
    let nextAcceptCallbacks: typeof acceptCallbacks = []
    globalThis.__componentHmrTestHot = {
      data,
      accept(callback) {
        nextAcceptCallbacks.push(callback)
      },
      invalidate(message) {
        messages.push(message)
      },
    }
    try {
      let code = `import.meta.hot = globalThis.__componentHmrTestHot;\n${compiled.code}\n//# sourceURL=component-hmr-${nextModuleId}-${revision++}.mjs`
      let module: unknown = await import(prefix + encodeURIComponent(code))
      assert.ok(nextAcceptCallbacks.length > 0, 'Expected a self-accepting module')
      acceptCallbacks = nextAcceptCallbacks
      return module
    } finally {
      globalThis.__componentHmrTestHot = undefined
    }
  }

  return {
    messages,
    load,
    async update(source: string) {
      let previousCallbacks = acceptCallbacks
      assert.ok(previousCallbacks.length > 0, 'Load a module before updating')
      let module = await load(source)
      for (let callback of previousCallbacks) {
        await callback(module)
      }
      return module
    },
  }
}

function getComponent(module: unknown, name: string) {
  assert.ok(typeof module === 'object' && module !== null)
  let component: unknown = Reflect.get(module, name)
  assert.ok(isComponent(component), `Expected an exported ${name} component`)
  return component
}

function isComponent(value: unknown): value is ComponentFunction {
  return typeof value === 'function'
}
