import { describe, expect, it } from 'vitest'
import { createDirective, RECONCILER_FRAGMENT } from '@remix-run/reconciler'
import { Fragment, jsx, jsxs } from './jsx-runtime.ts'
import type { Component } from '@remix-run/reconciler'

describe('dom jsx runtime', () => {
  it('creates branded reconciler elements and extracts key from props', () => {
    let element = <div key="props-key" id="x" />
    expect(element.$rmx).toBe(true)
    expect(element.type).toBe('div')
    expect(element.key).toBe('props-key')
    expect('key' in element.props).toBe(false)
    expect(element.props.id).toBe('x')
  })

  it('supports fragments and nested children arrays', () => {
    let children = ['a', 'b']
    let element = (
      <ul id="list">
        <>
          {children.map((child) => (
            <li key={child}>{child}</li>
          ))}
        </>
      </ul>
    )
    expect(element.key).toBe(null)
    expect(element.props.id).toBe('list')
    expect(element.props.children).toBeTruthy()
  })

  it('exports Fragment symbol compatible with reconciler', () => {
    expect(Fragment).toBe(RECONCILER_FRAGMENT)
  })

  it('supports explicit key argument and null props', () => {
    let element = jsx('div', null, 'explicit')
    expect(element.type).toBe('div')
    expect(element.key).toBe('explicit')
    expect(element.props).toEqual({})
  })

  it('supports jsxs factory calls', () => {
    let element = jsxs('div', { id: 'x' })
    expect(element.type).toBe('div')
    expect(element.key).toBe(null)
    expect(element.props.id).toBe('x')
  })

  it('extracts key from props when key argument is missing', () => {
    let element = jsx('div', { key: 'props-key', id: 'y' })
    expect(element.key).toBe('props-key')
    expect('key' in element.props).toBe(false)
    expect(element.props.id).toBe('y')
  })
})

type Counter = Component<{ start: number }, { label: string }>
type WithoutSetup = Component<undefined, { id: string }>

let CounterComponent: Counter = (_handle, setup) => (props) => {
  // @ts-expect-error setup should not be present in render props
  void props.setup
  return <div>{props.label + String(setup.start)}</div>
}

let WithoutSetupComponent: WithoutSetup = () => (props) => <div>{props.id}</div>

let goodCounterElement = <CounterComponent setup={{ start: 10 }} label="Count" />
// @ts-expect-error setup is required for CounterComponent
let missingCounterSetup = <CounterComponent label="Count" />
// @ts-expect-error setup must be a number config object
let badCounterSetupType = <CounterComponent setup={10} label="Count" />
// @ts-expect-error label must be string
let badCounterPropsType = <CounterComponent setup={{ start: 10 }} label={10} />

let goodWithoutSetupElement = <WithoutSetupComponent id="item-1" />
let goodWithoutSetupUndefined = <WithoutSetupComponent setup={undefined} id="item-2" />
// @ts-expect-error setup for WithoutSetupComponent only accepts undefined
let badWithoutSetupValue = <WithoutSetupComponent setup={{ any: 'value' }} id="item-3" />
// @ts-expect-error id is required
let missingWithoutSetupProps = <WithoutSetupComponent />

let noopDirective = createDirective<HTMLDivElement, [boolean]>(() => () => (_enabled) => {})
let goodUseProp = <div use={[noopDirective(true)]} />
// @ts-expect-error directive args are typed
let badUseDirectiveArgs = <div use={[noopDirective('yes')]} />
// @ts-expect-error use expects directive descriptors
let badUseValue = <div use={['not-a-descriptor']} />

void goodCounterElement
void missingCounterSetup
void badCounterSetupType
void badCounterPropsType
void goodWithoutSetupElement
void goodWithoutSetupUndefined
void badWithoutSetupValue
void missingWithoutSetupProps
void goodUseProp
void badUseDirectiveArgs
void badUseValue