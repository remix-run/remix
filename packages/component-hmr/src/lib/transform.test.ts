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
    let fixture = await createComponent(t, source, 'Component', 'jsx')
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
    let fixture = await createComponent(t, source, 'Component', 'jsx')
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
    let fixture = await createComponent(t, source, 'Component', 'jsx')
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
    let fixture = await createComponent(t, source, 'Component', 'jsx')
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

  it('retains function-scoped setup vars declared in nested blocks', async (t) => {
    let source = `export function Component(handle) {
  if (true) { var value = 1 }
  handle.props.actions.setValue = (next) => { value = next }
  return () => <output>{value}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{value}', '{value * 2}'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('keeps parameter defaults separate from body vars after the render return', async (t) => {
    let source = `export function Component(handle, value = 1, read = () => value) {
  handle.props.actions.setValue = (next) => { value = next }
  return () => <output>{value}:{read()}</output>
  var value = (() => { throw new Error('unreachable initializer') })()
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{value}:{read()}', '{value * 2}:{read()}'))
    assert.equal(await fixture.render(), '<output>10:1</output>')
  })

  it('retains vars from unreachable destructuring and loops without running initializers', async (t) => {
    let source = `export function Component(handle) {
  handle.props.actions.setValue = (next) => { value = next }
  return () => <output>{String(value)}:{String(rest)}:{String(loop)}</output>
  var { [missing()]: value = missing(), ...rest } = missing()
  for (var loop of missing()) { throw new Error('unreachable loop') }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('String(value)', 'String(value * 2)'))
    assert.equal(await fixture.render(), '<output>10:undefined:undefined</output>')
  })

  it('preserves lexical loop bindings in refreshed renders', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  handle.props.actions.setValue = (next) => { value = next }
  return () => {
    let values = []
    for (let value of [2, 3]) values.push(value)
    return <output>{value}:{values.join(',')}</output>
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{value}:', '{value * 2}:'))
    assert.equal(await fixture.render(), '<output>10:2,3</output>')
  })

  it('preserves destructured catch bindings in refreshed renders', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  handle.props.actions.setValue = (next) => { value = next }
  return () => {
    let caught
    try { throw { value: 'caught' } } catch ({ value }) { caught = value }
    return <output>{value}:{caught}</output>
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{value}:', '{value * 2}:'))
    assert.equal(await fixture.render(), '<output>10:caught</output>')
  })

  it('resolves function-scoped render vars declared in nested blocks', async (t) => {
    let source = `export function Component() {
  let value = 'setup'
  return () => {
    let before = value
    if (true) { var value = 'render' }
    return <output>{String(before)}:{value}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('{value}</output>', '{value.toUpperCase()}</output>'))
    assert.equal(await fixture.render(), '<output>undefined:RENDER</output>')
  })

  it('resolves switch discriminants outside the case lexical scope', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  handle.props.actions.setValue = (next) => { value = next }
  return () => {
    switch (value) {
      case 5:
        let value = 'inner'
        return <output>{value}</output>
    }
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{value}</output>', '{value.toUpperCase()}</output>'))
    assert.equal(await fixture.render(), '<output>INNER</output>')
  })

  it('keeps named function expression self-bindings after reassignment', async (t) => {
    let source = `export function Component(handle) {
  let read = function read() { return read }
  let original = read
  handle.props.actions.replace = () => { read = () => null }
  return () => <output>v1:{String(original() === original)}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.replace()
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:true</output>')
  })

  it('keeps named class expression self-bindings after reassignment', async (t) => {
    let source = `export function Component(handle) {
  let Model = class Model { static read() { return Model } }
  let Original = Model
  handle.props.actions.replace = () => { Model = class {} }
  return () => <output>v1:{String(Original.read() === Original)}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.replace()
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:true</output>')
  })

  it('preserves readonly setup bindings in refreshed assignments', async (t) => {
    let source = `export function Component(handle) {
  const value = 1
  return () => {
    try {
      return <output>{value}</output>
    } catch (error) {
      return <output>{error.name}</output>
    }
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('{value}', '{value = 2}'))
    assert.equal(await fixture.render(), '<output>TypeError</output>')
  })

  it('preserves shorthand destructuring assignment keys and defaults', async (t) => {
    let source = `export function Component(handle) {
  let value = 1
  return () => {
    handle.props.actions.assign = () => { ({ value = 7 } = {}) }
    return <output>v1:{value}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    await fixture.render()
    fixture.actions.assign()
    assert.equal(await fixture.render(), '<output>v2:7</output>')
  })

  it('preserves bare, optional and tagged call receivers', async (t) => {
    let source = `export function Component() {
  function read() { return this === undefined ? 'bare' : 'receiver' }
  return () => <output>v1:{read()}:{read?.()}:{read\`tag\`}</output>
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:bare:bare:bare</output>')
  })

  it('preserves inferred arrow function names in refreshed assignments', async (t) => {
    let source = `export function Component() {
  let read
  return () => {
    read = () => 1
    return <output>v1:{read.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:read</output>')
  })

  it('infers class names before static initialization in refreshed logical assignments', async (t) => {
    let source = `export function Component() {
  let Model
  return () => {
    Model ||= class { static initial = this.name }
    return <output>v1:{Model.initial}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:Model</output>')
  })

  it('preserves inferred names in refreshed destructuring defaults', async (t) => {
    let source = `export function Component() {
  let read
  return () => {
    ;({ read = () => 1 } = {})
    return <output>v1:{read.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:read</output>')
  })

  it('executes nested arrow assignments after a render update', async (t) => {
    let source = `export function Component() {
  let outer, inner
  return () => {
    outer = () => inner = () => 1
    return <output>v1:{outer()()}:{outer.name}:{inner.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:1:outer:inner</output>')
  })

  it('infers nested class names before static initialization after a render update', async (t) => {
    let source = `export function Component() {
  let outer, Inner
  return () => {
    outer ||= () => Inner ||= class { static label = this.name }
    return <output>v1:{outer().label}:{outer.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:Inner:outer</output>')
  })

  it('executes nested assignments in destructuring defaults after a render update', async (t) => {
    let source = `export function Component() {
  let outer, inner
  return () => {
    ;[outer = () => inner = () => 1] = []
    return <output>v1:{outer()()}:{outer.name}:{inner.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:1:outer:inner</output>')
  })

  it('ignores type-only this parameters while retaining setup state after an update', async (t) => {
    let source = `export function Component(this: void, handle) {
  let value = 1
  handle.props.actions.setValue = (next) => { value = next }
  return () => <output>{value}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{value}', '{value * 2}'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('shares default parameter objects with setup callbacks after an update', async (t) => {
    let source = `export function Component(handle, model = { value: 1 }, read = () => model.value) {
  handle.props.actions.setValue = (next) => { model.value = next }
  return () => <output>{model.value}:{read()}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{model.value}', '{model.value * 2}'))
    assert.equal(await fixture.render(), '<output>10:5</output>')
  })

  it('retains array parameter rest values shared with setup callbacks', async (t) => {
    let source = `export function Component(handle, [first, ...rest] = [0, 1]) {
  handle.props.actions.setValue = (next) => { rest[0] = next }
  return () => <output>{rest[0]}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{rest[0]}', '{rest[0] * 2}'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('retains object parameter rest values shared with setup callbacks', async (t) => {
    let source = `export function Component(handle, { value, ...rest } = { value: 0, count: 1 }) {
  handle.props.actions.setValue = (next) => { rest.count = next }
  return () => <output>{rest.count}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{rest.count}', '{rest.count * 2}'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('shares refreshed render assignments with setup callbacks for rest parameters', async (t) => {
    let source = `export function Component(handle, ...rest) {
  handle.props.actions.setRest = (next) => { rest = [next] }
  handle.props.actions.read = () => rest[0]
  return () => {
    rest[0] += 1
    return <output>{rest[0]}:{handle.props.actions.read()}</output>
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setRest(5)
    await fixture.update(source.replace('rest[0] += 1', 'rest[0] += 2'))
    assert.equal(await fixture.render(), '<output>7:7</output>')
  })

  it('keeps nested function parameter arguments separate from component arguments', async (t) => {
    let source = `export function Component(handle) {
  return () => {
    function read(value = arguments[1]) { return value }
    return <output>v1:{String(read(undefined, 7))}:{String(arguments[0] === handle)}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:7:true</output>')
  })

  it('retains named component self-bindings shared with setup and parameter defaults', async (t) => {
    let source = `export const Component = function Self(handle, read = () => Self) {
  handle.props.actions.readSelf = () => Self
  return () => <output>v1:{String(Self === read())}:{String(Self === handle.props.actions.readSelf())}</output>
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:true:true</output>')
  })

  it('preserves readonly named component self-bindings in refreshed assignments', async (t) => {
    let source = `export const Component = function Self(handle) {
  return () => {
    try {
      return <output>{Self.name}</output>
    } catch (error) {
      return <output>{error.name}</output>
    }
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('{Self.name}', '{Self = null}'))
    assert.equal(await fixture.render(), '<output>TypeError</output>')
  })

  it('preserves companions and multiple components in shared declarations', async (t) => {
    let source = `export const before = 'before', Component = function (handle) {
  let value = 1
  handle.props.actions.setValue = (next) => { value = next }
  return () => <output>v1:{before}:{value}:{after}:{Other.name}</output>
}, after = 'after', Other = function () { return () => <span>other</span> }
`
    let fixture = await createComponent(t, source)
    let other = await createComponent(t, source, 'Other')
    fixture.actions.setValue(5)
    let updated = source.replace('v1:', 'v2:').replace('>other<', '>edited<')
    await fixture.update(updated)
    await other.update(updated)
    assert.equal(await fixture.render(), '<output>v2:before:5:after:Other</output>')
    assert.equal(await other.render(), '<span>edited</span>')
  })

  it('avoids collisions with generated runtime, state and setter names', async (t) => {
    let source = `let __remixComponentHmr__ = 'module'
export const __remixComponentHmrPreviousExports__ = 'exports'
export function Component() {
  let __remixComponentHmrState__ = 1
  let __remixComponentHmrNext__ = 2
  return () => {
    __remixComponentHmrNext__ += __remixComponentHmrState__
    return <output>{__remixComponentHmr__}:{__remixComponentHmrNext__}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(
      source.replace('+= __remixComponentHmrState__', '+= __remixComponentHmrState__ * 2'),
    )
    assert.equal(await fixture.render(), '<output>module:4</output>')
  })

  it('accepts render updates when a module binding shadows Object', async (t) => {
    let source = `let Object = null
export function Component() {
  let value = 1
  return () => <output>v1:{value}</output>
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:1</output>')
  })

  it('retains bindings and tracked exports named __proto__', async (t) => {
    let source = `export const __proto__ = 'stable'
export function Component(handle) {
  let __proto__ = 1
  handle.props.actions.setValue = (next) => { __proto__ = next }
  return () => <output>{__proto__}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{__proto__}', '{__proto__ * 2}'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('evaluates destructured parameter getters once across render updates', async (t) => {
    let source = `let calls = 0
export function Component(handle, { value } = { get value() {
  handle.props.actions.onDefault?.()
  return ++calls
} }) {
  handle.props.actions.onDefault = () => { throw new Error('default evaluated after setup') }
  return () => <output>v1:{value}</output>
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:1</output>')
  })

  it('shares component arguments reassigned by refreshed renders with setup callbacks', async (t) => {
    let source = `export function Component(handle) {
  handle.props.actions.read = () => arguments[0].props.actions
  return () => {
    arguments[0] = { props: { actions: 'original' } }
    return <output>{handle.props.actions.read()}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace("actions: 'original'", "actions: 'updated'"))
    assert.equal(await fixture.render(), '<output>updated</output>')
  })

  it('retains named client entry self-bindings shared with parameter defaults', async (t) => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Component = clientEntry(import.meta.url, function Self(handle, read = () => Self) {
  handle.props.actions.read = () => Self
  return () => <output>v1:{String(read() === Self)}:{String(handle.props.actions.read() === Self)}</output>
})`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:true:true</output>')
  })

  it('retains the inner self-binding of client entries wrapped by helpers', async (t) => {
    let source = `import { clientEntry } from '@remix-run/component'
function countCalls(component) {
  component.calls = 0
  return function Wrapped(handle) {
    component.calls++
    return component(handle)
  }
}
export const Component = clientEntry(import.meta.url, countCalls(function Self() {
  return () => <output>v1:{Self.calls}</output>
}))`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:1</output>')
  })

  it('retains parameters that shadow the exported component name', async (t) => {
    let source = `export function Component(handle, Component = 1) {
  handle.props.actions.setValue = (next) => { Component = next }
  return () => <output>{Component}</output>
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('{Component}', '{Component * 2}'))
    assert.equal(await fixture.render(), '<output>10</output>')
  })

  it('preserves own properties in shorthand objects named __proto__', async (t) => {
    let source = `export function Component(handle) {
  let __proto__ = 1
  handle.props.actions.setValue = (next) => { __proto__ = next }
  return () => {
    let object = { __proto__ }
    return <output>v1:{String(Object.hasOwn(object, '__proto__'))}:{object.__proto__}</output>
  }
}`
    let fixture = await createComponent(t, source)
    fixture.actions.setValue(5)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:true:5</output>')
  })

  it('preserves inferred names and bare receivers through TypeScript expressions', async (t) => {
    let source = `export function Component(handle) {
  let read: (() => boolean) | undefined
  return () => {
    handle.props.actions.assign = () => { read = (function () { return this === undefined }) satisfies (() => boolean) }
    return <output>v1:{read?.name}:{String((read as (() => boolean) | undefined)?.())}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    await fixture.render()
    fixture.actions.assign()
    assert.equal(await fixture.render(), '<output>v2:read:true</output>')
  })

  it('preserves inferred function names through asserted assignment targets', async (t) => {
    let source = `export function Component() {
  let read: (() => void) | undefined
  return () => {
    (read as (() => void)) = () => {}
    return <output>v1:{read?.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:read</output>')
  })

  it('infers class names before static initialization through non-null assignment targets', async (t) => {
    let source = `export function Component() {
  let Model: { label: string } | undefined
  return () => {
    Model! ||= class { static label = this.name }
    return <output>v1:{Model?.label}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:Model</output>')
  })

  it('preserves inferred names through TypeScript instantiation expressions', async (t) => {
    let source = `export function Component() {
  let read
  return () => {
    read = (function <T>() {})<string>
    return <output>v1:{read.name}</output>
  }
}`
    let fixture = await createComponent(t, source)
    await fixture.update(source.replace('v1:', 'v2:'))
    assert.equal(await fixture.render(), '<output>v2:read</output>')
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

  it('preserves named component self-bindings on the server after an update', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `export const Component = function Self(handle, read = () => Self) {
  return () => <output>v1:{String(Self === read())}:{Self.name}</output>
}`
    let Component = getComponent(await host.load(source), 'Component')
    await host.update(source.replace('v1:', 'v2:'))
    assert.equal(await renderToString(jsx(Component, {})), '<output>v2:true:Self</output>')
  })

  it('preserves the inner self-binding of wrapped client entries on the server', async (t) => {
    let source = `import { clientEntry } from '@remix-run/component'
function countCalls(component) {
  component.calls = 0
  return function Wrapped(handle) {
    component.calls++
    return component(handle)
  }
}
export const Component = clientEntry(import.meta.url, countCalls(function Self() {
  return () => <output>v1:{Self.calls}</output>
}))`
    let host = createModuleHost(t, transformComponentsForServer)
    await host.load(source)
    let Component = getComponent(await host.update(source.replace('v1:', 'v2:')), 'Component')
    let controller = new AbortController()
    t.after(() => controller.abort())
    let render = Component({ signal: controller.signal, props: {} })
    assert.equal(await renderToString(render()), '<output>v2:1</output>')
  })

  it('evaluates server parameter defaults once per setup after an update', async (t) => {
    let host = createModuleHost(t, transformComponentsForServer)
    let source = `export function Component(handle, value = ++handle.props.counter.value) {
  return () => <output>v1:{value}:{handle.props.counter.value}</output>
}`
    let Component = getComponent(await host.load(source), 'Component')
    await host.update(source.replace('v1:', 'v2:'))
    assert.equal(
      await renderToString(jsx(Component, { counter: { value: 0 } })),
      '<output>v2:1:1</output>',
    )
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

async function createComponent(
  t: TestContext,
  source: string,
  componentName = 'Component',
  lang: 'tsx' | 'jsx' = 'tsx',
) {
  let host = createModuleHost(t, transformComponentsForBrowser, lang)
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

function createModuleHost(
  t: TestContext,
  transform = transformComponentsForBrowser,
  lang: 'tsx' | 'jsx' = 'tsx',
) {
  let moduleUrl = `/test/component-${++nextModuleId}.${lang}`
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
    let compiled = transformSync(moduleUrl, result.code, {
      lang,
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
