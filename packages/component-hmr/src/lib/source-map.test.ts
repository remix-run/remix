import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { SourceMapConsumer } from 'source-map-js/source-map.js'

import { transformComponentsForBrowser, transformComponentsForServer } from './transform.ts'

const browserOptions = {
  importSource: '@remix-run',
  moduleUrl: '/app/Counter.tsx',
  sourceMap: true,
}
const serverOptions = {
  importSource: '@remix-run',
  moduleUrl: 'file:///app/Counter.tsx',
  sourceMap: true,
}

describe('component HMR source maps', () => {
  it('maps moved browser setup initializers and statements', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let SETUP_VALUE = 'SETUP_INITIALIZER'
  handle.props.log('SETUP_STATEMENT', SETUP_VALUE)
  return () => SETUP_VALUE
})`
    let result = transformComponentsForBrowser(source, browserOptions)
    assert.ok(result.map)
    assert.equal(
      new SourceMapConsumer(JSON.parse(result.map)).sourceContentFor(browserOptions.moduleUrl),
      source,
    )
    assertMapped(result, source, browserOptions.moduleUrl, 'SETUP_VALUE')
    assertMapped(result, source, browserOptions.moduleUrl, 'SETUP_INITIALIZER')
    assertMapped(result, source, browserOptions.moduleUrl, 'SETUP_STATEMENT')
  })

  it('maps browser render expressions across binding replacements', () => {
    let source = `export function Counter() {
  let value = 'setup'
  return () => <output>{value + 'AFTER_BINDING'}</output>
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'value +')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_BINDING')
    assertMapped(result, source, browserOptions.moduleUrl, '<output>')
  })

  it('maps moved server setup and render code', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, function Self(handle) {
  let value = 'SERVER_INITIALIZER'
  handle.props.log('SERVER_STATEMENT')
  return () => <output>{Self.calls + value + 'SERVER_RENDER'}</output>
})`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_INITIALIZER')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_STATEMENT')
    assertMapped(result, source, serverOptions.moduleUrl, 'Self.calls')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_RENDER')
  })

  it('selects the right browser component when setup and JSX repeat', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const First = clientEntry(import.meta.url, function First() {
  let value = 'REPEATED_SETUP'
  return () => <output>{value + 'REPEATED_RENDER'}</output>
})
export function Second() {
  let value = 'REPEATED_SETUP'
  return () => <output>{value + 'REPEATED_RENDER'}</output>
}
console.log('AFTER_COMPONENTS')`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'REPEATED_SETUP', 2)
    assertMapped(result, source, browserOptions.moduleUrl, 'REPEATED_RENDER', 2)
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_COMPONENTS')
  })

  it('selects the right server component when setup and JSX repeat', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const First = clientEntry(import.meta.url, function First() {
  let value = 'REPEATED_SETUP'
  return () => <output>{value + 'REPEATED_RENDER'}</output>
})
export function Second() {
  let value = 'REPEATED_SETUP'
  return () => <output>{value + 'REPEATED_RENDER'}</output>
}
console.log('AFTER_COMPONENTS')`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'REPEATED_SETUP', 2)
    assertMapped(result, source, serverOptions.moduleUrl, 'REPEATED_RENDER', 2)
    assertMapped(result, source, serverOptions.moduleUrl, 'AFTER_COMPONENTS')
  })

  it('maps multiline browser initializers after removed blank lines', () => {
    let source = `export function Counter() {
  let value = (() => {

    return 'MULTILINE_INITIALIZER'
  })()
  return () => value
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'MULTILINE_INITIALIZER')
  })

  it('maps expressions after shorthand and destructuring replacements', () => {
    let source = `export function Counter(handle) {
  let value = 'setup'
  let { label = value + 'DESTRUCTURING_SUFFIX' } = handle.props
  return () => ({ value, after: 'SHORTHAND_SUFFIX', tail: value + 'RENDER_SUFFIX' })
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'value +')
    assertMapped(result, source, browserOptions.moduleUrl, 'DESTRUCTURING_SUFFIX')
    assertMapped(result, source, browserOptions.moduleUrl, 'SHORTHAND_SUFFIX')
    assertMapped(result, source, browserOptions.moduleUrl, 'value +', 2)
    assertMapped(result, source, browserOptions.moduleUrl, 'RENDER_SUFFIX')
  })

  it('maps computed keys and nested binding defaults through browser rewrites', () => {
    let source = `export function Counter(handle) {
  let key = 'key'
  let value = 'value'
  let { [key + 'COMPUTED_KEY']: { label = value + 'NESTED_DEFAULT' } } = handle.props
  let [first = value + 'ARRAY_DEFAULT'] = handle.props.items
  return () => label + first + 'BINDING_RENDER'
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'key +')
    assertMapped(result, source, browserOptions.moduleUrl, 'COMPUTED_KEY')
    assertMapped(result, source, browserOptions.moduleUrl, 'value +')
    assertMapped(result, source, browserOptions.moduleUrl, 'NESTED_DEFAULT')
    assertMapped(result, source, browserOptions.moduleUrl, 'value +', 2)
    assertMapped(result, source, browserOptions.moduleUrl, 'ARRAY_DEFAULT')
    assertMapped(result, source, browserOptions.moduleUrl, 'BINDING_RENDER')
  })

  it('maps retained escaped declaration names', () => {
    let source = String.raw`export function Counter() {
  let \u0056ALUE:
    string = 'CANONICAL_INITIALIZER'
  return () => VALUE + 'CANONICAL_RENDER'
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, String.raw`\u0056ALUE:`)
    assertMapped(result, source, browserOptions.moduleUrl, 'CANONICAL_INITIALIZER')
    assertMapped(result, source, browserOptions.moduleUrl, 'VALUE +')
    assertMapped(result, source, browserOptions.moduleUrl, 'CANONICAL_RENDER')
  })

  it('maps moved setup declarations without mapping generated binding accessors', () => {
    let source = `export function Counter() {
  function label() {
    return 'DECLARATION_BODY'
  }
  return () => label()
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'function label')
    assertMapped(result, source, browserOptions.moduleUrl, 'DECLARATION_BODY')
    assertPosition(result, 'retainComponentHmrBinding', { source: null, line: null, column: null })
  })

  it('maps the first and later lines of moved browser render code', () => {
    let source = `export function Counter() {
  let value = 'setup'
  return () => <output title="RENDER_FIRST_LINE">
    {value + 'RENDER_LATER_LINE'}
  </output>
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'RENDER_FIRST_LINE')
    assertMapped(result, source, browserOptions.moduleUrl, 'value +')
    assertMapped(result, source, browserOptions.moduleUrl, 'RENDER_LATER_LINE')
    assertMapped(result, source, browserOptions.moduleUrl, '</output>')
  })

  it('leaves generated browser scaffolding unmapped', () => {
    let source = `export function Counter() {
  return () => 'render'
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertPosition(result, 'getComponentHandleForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'getCurrentComponentForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'registerComponentForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'let __remixComponentHmrWrapper_Counter__', {
      source: null,
      line: null,
      column: null,
    })
    assertPosition(result, 'commitComponentModuleForHmr', {
      source: null,
      line: null,
      column: null,
    })
  })

  it('leaves generated server wrappers and registration unmapped', () => {
    let source = `export function Counter() {
  return () => 'SERVER_BODY'
}`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_BODY')
    assertPosition(result, 'getCurrentComponentForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'registerComponentForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'let __remixComponentHmrWrapper_Counter__', {
      source: null,
      line: null,
      column: null,
    })
    assertPosition(result, 'commitComponentModuleForHmr', {
      source: null,
      line: null,
      column: null,
    })
  })

  it('maps browser parameter defaults in the setup signature', () => {
    let source = `export function Counter(
  handle = 'BROWSER_PARAMETER'
) {
  return () => 'BROWSER_BODY'
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_PARAMETER')
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_BODY')
  })

  it('maps server client-entry parameters without mapping the wrapper body', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, function Counter(
  handle = 'SERVER_PARAMETER'
) {
  return () => 'ENTRY_BODY'
})
console.log('AFTER_ENTRY')`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_PARAMETER')
    assertMapped(result, source, serverOptions.moduleUrl, 'ENTRY_BODY')
    assertMapped(result, source, serverOptions.moduleUrl, 'AFTER_ENTRY')
    assertPosition(result, 'getCurrentComponentForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'registerComponentForHmr', { source: null, line: null, column: null })
    assertPosition(result, 'let __remixComponentHmrWrapper_Counter__', {
      source: null,
      line: null,
      column: null,
    })
    assertPosition(result, 'commitComponentModuleForHmr', {
      source: null,
      line: null,
      column: null,
    })
  })

  it('maps hoisted function bodies without mapping synthetic var declarations', () => {
    let source = `export function Counter() {
  return () => label() + value
  function label() { return 'HOISTED_BODY' }
  var value = 'UNREACHABLE_INITIALIZER'
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'function label')
    assertMapped(result, source, browserOptions.moduleUrl, 'HOISTED_BODY')
    assertPosition(result, 'var value;', { source: null, line: null, column: null })
  })

  it('maps bare calls, optional calls and template tags through receiver rewrites', () => {
    let source = `export function Counter() {
  function label(value) { return value }
  return () => [label('BARE_CALL'), label?.('OPTIONAL_CALL'), label\`TAGGED_CALL\`]
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertPosition(result, "label)('BARE_CALL')", {
      source: browserOptions.moduleUrl,
      ...getPosition(source, "label('BARE_CALL')", 1),
    })
    assertMapped(result, source, browserOptions.moduleUrl, 'BARE_CALL')
    assertPosition(result, "label)?.('OPTIONAL_CALL')", {
      source: browserOptions.moduleUrl,
      ...getPosition(source, "label?.('OPTIONAL_CALL')", 1),
    })
    assertMapped(result, source, browserOptions.moduleUrl, 'OPTIONAL_CALL')
    assertPosition(result, 'label)`TAGGED_CALL`', {
      source: browserOptions.moduleUrl,
      ...getPosition(source, 'label`TAGGED_CALL`', 1),
    })
    assertMapped(result, source, browserOptions.moduleUrl, 'TAGGED_CALL')
  })

  it('maps assignment initializers through inferred-name wrappers', () => {
    let source = `export function Counter() {
  let value
  return () => {
    value = () => 'ARROW_BODY'
    value ||= class { static label = 'CLASS_BODY' }
    return value + 'AFTER_ASSIGNMENTS'
  }
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertPosition(result, 'value = ({', {
      source: browserOptions.moduleUrl,
      ...getPosition(source, 'value =', 1),
    })
    assertMapped(result, source, browserOptions.moduleUrl, 'ARROW_BODY')
    assertMapped(result, source, browserOptions.moduleUrl, 'value ||=')
    assertMapped(result, source, browserOptions.moduleUrl, 'CLASS_BODY')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_ASSIGNMENTS')
  })

  it('maps nested initializers through inferred-name wrappers', () => {
    let source = `export function Counter() {
  let outer, inner
  return () => {
    outer = () => inner = () => 'NESTED_BODY'
    return outer()() + 'AFTER_NESTED'
  }
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertPosition(result, 'inner = ({', {
      source: browserOptions.moduleUrl,
      ...getPosition(source, 'inner =', 1),
    })
    assertMapped(result, source, browserOptions.moduleUrl, 'NESTED_BODY')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_NESTED')
  })

  it('maps shorthand assignment defaults through key and inferred-name rewrites', () => {
    let source = `export function Counter() {
  let value
  return () => {
    ({ value = () => 'SHORTHAND_DEFAULT' } = {})
    return { value, after: 'AFTER_SHORTHAND' }
  }
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertPosition(result, 'value = ({', {
      source: browserOptions.moduleUrl,
      ...getPosition(source, 'value =', 1),
    })
    assertMapped(result, source, browserOptions.moduleUrl, 'SHORTHAND_DEFAULT')
    assertMapped(result, source, browserOptions.moduleUrl, 'value, after:')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_SHORTHAND')
  })

  it('maps browser client-entry self-bindings through helper capture and setup extraction', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, wrap(function Self(
  handle, read = () => Self.calls + 'SELF_DEFAULT'
) {
  let value = Self.calls + 'SELF_SETUP'
  return () => Self.calls + value + read() + 'SELF_RENDER'
}))
console.log('AFTER_CAPTURE')`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'Self.calls')
    assertMapped(result, source, browserOptions.moduleUrl, 'SELF_DEFAULT')
    assertMapped(result, source, browserOptions.moduleUrl, 'Self.calls', 2)
    assertMapped(result, source, browserOptions.moduleUrl, 'SELF_SETUP')
    assertMapped(result, source, browserOptions.moduleUrl, 'Self.calls', 3)
    assertMapped(result, source, browserOptions.moduleUrl, 'SELF_RENDER')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_CAPTURE')
  })

  it('maps server client-entry self-bindings through helper capture and body extraction', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, wrap(function Self(
  handle, read = () => Self.calls + 'SELF_DEFAULT'
) {
  let value = Self.calls + 'SELF_SETUP'
  return () => Self.calls + value + read() + 'SELF_RENDER'
}))
console.log('AFTER_CAPTURE')`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'Self.calls')
    assertMapped(result, source, serverOptions.moduleUrl, 'SELF_DEFAULT')
    assertMapped(result, source, serverOptions.moduleUrl, 'Self.calls', 2)
    assertMapped(result, source, serverOptions.moduleUrl, 'SELF_SETUP')
    assertMapped(result, source, serverOptions.moduleUrl, 'Self.calls', 3)
    assertMapped(result, source, serverOptions.moduleUrl, 'SELF_RENDER')
    assertMapped(result, source, serverOptions.moduleUrl, 'AFTER_CAPTURE')
  })

  it('preserves browser mappings when authored text contains generated code', () => {
    let component = `export function Counter() {
  return () => 'BROWSER_REPEATED_OUTPUT'
}`
    let example = transformComponentsForBrowser(component, browserOptions).code
    let source = `const example = \`${example}\`\n${component}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_REPEATED_OUTPUT')
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_REPEATED_OUTPUT', 2)
  })

  it('preserves server mappings when authored text contains generated client-entry code', () => {
    let component = `import { clientEntry } from '@remix-run/component'
export const Counter = clientEntry(import.meta.url, function Counter() {
  return () => 'SERVER_REPEATED_OUTPUT'
})`
    let example = transformComponentsForServer(component, serverOptions).code
    let source = `const example = \`${example}\`\n${component}`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_REPEATED_OUTPUT')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_REPEATED_OUTPUT', 2)
  })

  it('maps browser insertions that share a statement boundary', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const First = clientEntry(import.meta.url, function() {
  return () => 'SHARED_FIRST'
}), Second = clientEntry(import.meta.url, function() {
  return () => 'SHARED_SECOND'
})
console.log('AFTER_SHARED_STATEMENT')`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'SHARED_FIRST')
    assertMapped(result, source, browserOptions.moduleUrl, 'SHARED_SECOND')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_SHARED_STATEMENT')
  })

  it('maps retained browser source between shared client-entry replacements', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const before = 'BROWSER_GAP_BEFORE', First = clientEntry(import.meta.url, function() {
  return () => 'BROWSER_GAP_FIRST'
}), middle = 'BROWSER_GAP_MIDDLE', Second = clientEntry(import.meta.url, function() {
  return () => 'BROWSER_GAP_SECOND'
}), after = 'BROWSER_GAP_AFTER'`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_GAP_BEFORE')
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_GAP_FIRST')
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_GAP_MIDDLE')
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_GAP_SECOND')
    assertMapped(result, source, browserOptions.moduleUrl, 'BROWSER_GAP_AFTER')
  })

  it('maps retained server source between shared client-entry replacements', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const before = 'SERVER_GAP_BEFORE', First = clientEntry(import.meta.url, function() {
  return () => 'SERVER_GAP_FIRST'
}), middle = 'SERVER_GAP_MIDDLE', Second = clientEntry(import.meta.url, function() {
  return () => 'SERVER_GAP_SECOND'
}), after = 'SERVER_GAP_AFTER'`
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_GAP_BEFORE')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_GAP_FIRST')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_GAP_MIDDLE')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_GAP_SECOND')
    assertMapped(result, source, serverOptions.moduleUrl, 'SERVER_GAP_AFTER')
  })

  it('maps browser prepends and appends at the same source position', () => {
    let source = `import { clientEntry } from '@remix-run/component'
export const First = clientEntry(import.meta.url, function() {
  return () => 'ADJACENT_FIRST'
});export const Second = clientEntry(import.meta.url, function() {
  return () => 'ADJACENT_SECOND'
})
console.log('AFTER_ADJACENT_ENTRIES')`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'ADJACENT_FIRST')
    assertMapped(result, source, browserOptions.moduleUrl, 'ADJACENT_SECOND')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_ADJACENT_ENTRIES')
  })

  it('leaves generated implementation starts unmapped after authored code', () => {
    let source = `/* 😀 */ const before = 'BEFORE_REGION'; export function Counter() {
  return () => 'INLINE_RENDER'
}`
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'BEFORE_REGION')
    assertMapped(result, source, browserOptions.moduleUrl, 'INLINE_RENDER')
    assertPosition(result, 'function ', { source: null, line: null, column: null })
  })

  it('maps retained browser source between shared function-expression components', () => {
    let source = `export const before = 'BEFORE_FUNCTIONS', First = function Self(
  handle, read = () => Self.calls + 'FIRST_DEFAULT'
) {
  return () => read() + 'FIRST_RENDER'
}, middle = 'BETWEEN_FUNCTIONS', Second = function() {
  return () => 'SECOND_RENDER'
}, after = 'AFTER_FUNCTIONS'`
    let result = transformComponentsForBrowser(source, browserOptions)
    assert.equal(
      result.code,
      transformComponentsForBrowser(source, { ...browserOptions, sourceMap: false }).code,
    )
    assertMapped(result, source, browserOptions.moduleUrl, 'BEFORE_FUNCTIONS')
    assertMapped(result, source, browserOptions.moduleUrl, 'Self.calls')
    assertMapped(result, source, browserOptions.moduleUrl, 'FIRST_DEFAULT')
    assertMapped(result, source, browserOptions.moduleUrl, 'FIRST_RENDER')
    assertMapped(result, source, browserOptions.moduleUrl, 'BETWEEN_FUNCTIONS')
    assertMapped(result, source, browserOptions.moduleUrl, 'SECOND_RENDER')
    assertMapped(result, source, browserOptions.moduleUrl, 'AFTER_FUNCTIONS')
  })

  it('maps retained server source between shared function-expression components', () => {
    let source = `export const before = 'BEFORE_FUNCTIONS', First = function Self(
  handle, read = () => Self.calls + 'FIRST_DEFAULT'
) {
  return () => read() + 'FIRST_RENDER'
}, middle = 'BETWEEN_FUNCTIONS', Second = function() {
  return () => 'SECOND_RENDER'
}, after = 'AFTER_FUNCTIONS'`
    let result = transformComponentsForServer(source, serverOptions)
    assert.equal(
      result.code,
      transformComponentsForServer(source, { ...serverOptions, sourceMap: false }).code,
    )
    assertMapped(result, source, serverOptions.moduleUrl, 'BEFORE_FUNCTIONS')
    assertMapped(result, source, serverOptions.moduleUrl, 'Self.calls')
    assertMapped(result, source, serverOptions.moduleUrl, 'FIRST_DEFAULT')
    assertMapped(result, source, serverOptions.moduleUrl, 'FIRST_RENDER')
    assertMapped(result, source, serverOptions.moduleUrl, 'BETWEEN_FUNCTIONS')
    assertMapped(result, source, serverOptions.moduleUrl, 'SECOND_RENDER')
    assertMapped(result, source, serverOptions.moduleUrl, 'AFTER_FUNCTIONS')
  })

  it('maps browser setup and render code with mixed carriage-return line endings', () => {
    let source = [
      'export function Counter() {\r\n',
      "  /* 😀 */ let value = 'CR_INITIALIZER'\r",
      "  return () => value + 'CR_RENDER'\r",
      '}',
    ].join('')
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'CR_INITIALIZER')
    assertMapped(result, source, browserOptions.moduleUrl, 'CR_RENDER')
  })

  it('maps server parameters and bodies separated by Unicode line separators', () => {
    let source = [
      "export function Counter(handle = 'LS_PARAMETER') {\u2028",
      "  let value = 'LS_INITIALIZER'\u2029",
      "  return () => value + 'LS_RENDER'\u2028",
      '}',
    ].join('')
    let result = transformComponentsForServer(source, serverOptions)
    assertMapped(result, source, serverOptions.moduleUrl, 'LS_PARAMETER')
    assertMapped(result, source, serverOptions.moduleUrl, 'LS_INITIALIZER')
    assertMapped(result, source, serverOptions.moduleUrl, 'LS_RENDER')
  })

  it('maps multiline browser template fragments through binding rewrites', () => {
    let source = [
      'export function Counter(handle = `TEMPLATE_PARAMETER_FIRST\u2028TEMPLATE_PARAMETER_LAST`) {\n',
      '  let value = `TEMPLATE_SETUP_FIRST\u2029TEMPLATE_SETUP_LAST`\n',
      '  return () => `TEMPLATE_RENDER_FIRST\u2028${value}\u2029TEMPLATE_RENDER_LAST`\n',
      '}',
    ].join('')
    let result = transformComponentsForBrowser(source, browserOptions)
    assertMapped(result, source, browserOptions.moduleUrl, 'TEMPLATE_PARAMETER_FIRST')
    assertMapped(result, source, browserOptions.moduleUrl, 'TEMPLATE_PARAMETER_LAST')
    assertMapped(result, source, browserOptions.moduleUrl, 'TEMPLATE_SETUP_FIRST')
    assertMapped(result, source, browserOptions.moduleUrl, 'TEMPLATE_SETUP_LAST')
    assertMapped(result, source, browserOptions.moduleUrl, 'TEMPLATE_RENDER_FIRST')
    assertMapped(result, source, browserOptions.moduleUrl, 'TEMPLATE_RENDER_LAST')
  })
})

function assertMapped(
  result: { code: string; map: string | null },
  source: string,
  filename: string,
  search: string,
  occurrence = 1,
  generatedOccurrence = occurrence,
): void {
  assertPosition(
    result,
    search,
    { source: filename, ...getPosition(source, search, occurrence) },
    generatedOccurrence,
  )
}

function assertPosition(
  result: { code: string; map: string | null },
  search: string,
  expected: { source: string | null; line: number | null; column: number | null },
  occurrence = 1,
): void {
  assert.ok(result.map)
  let original = new SourceMapConsumer(JSON.parse(result.map)).originalPositionFor(
    getPosition(result.code, search, occurrence),
  )
  assert.deepEqual(
    { source: original.source, line: original.line, column: original.column },
    expected,
    `${search}: ${JSON.stringify(original)}`,
  )
}

function getPosition(
  source: string,
  search: string,
  occurrence: number,
): { line: number; column: number } {
  let index = -1
  for (let count = 0; count < occurrence; count++) {
    index = source.indexOf(search, index + 1)
    assert.notEqual(index, -1, search)
  }
  // Compilers may change quote style and map string literals to their opening quote.
  let quote = source[index - 1]
  if ((quote === "'" || quote === '"') && source[index + search.length] === quote) index--
  let lines = source.slice(0, index).split(/\r\n|[\n\r\u2028\u2029]/)
  return { line: lines.length, column: lines.at(-1)?.length ?? 0 }
}
