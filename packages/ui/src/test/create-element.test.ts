import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createElement } from '../runtime/create-element.ts'
import { createMixin } from '../index.ts'

describe('createElement', () => {
  it('creates an element', () => {
    let element = createElement('div', {}, 'Hello, world!')
    expect(element.type).toBe('div')
    expect(element.props.children).toEqual(['Hello, world!'])
  })

  it('accepts function element types', () => {
    function Example() {
      return () => null
    }

    let element = createElement(Example, { id: 'example' })

    expect(element.type).toBe(Example)
    expect(element.props.id).toBe('example')
  })

  it('normalizes mix to an array or undefined', () => {
    let passthrough = createMixin((_handle) => {})
    let descriptor = passthrough()

    let withSingle = createElement('div', { mix: descriptor })
    let withArray = createElement('div', { mix: [descriptor] })
    let withNestedArray = createElement('div', { mix: [[descriptor], [[[descriptor]]]] })
    let withEmptyArray = createElement('div', { mix: [] })

    expect(withSingle.props.mix).toEqual([descriptor])
    expect(withArray.props.mix).toEqual([descriptor])
    expect(withNestedArray.props.mix).toEqual([descriptor, descriptor])
    expect(withEmptyArray.props.mix).toBeUndefined()
  })

  it('drops falsy mix values during normalization', () => {
    let passthrough = createMixin((_handle) => {})
    let descriptor = passthrough()

    let withFalse = createElement('div', { mix: false })
    let withEmptyString = createElement('div', { mix: '' })
    let withZero = createElement('div', { mix: 0 })
    let withNestedFalsy = createElement('div', {
      mix: [descriptor, false, '', [0, descriptor, [null, undefined]]],
    })

    expect(withFalse.props.mix).toBeUndefined()
    expect(withEmptyString.props.mix).toBeUndefined()
    expect(withZero.props.mix).toBeUndefined()
    expect(withNestedFalsy.props.mix).toEqual([descriptor, descriptor])
  })
})
