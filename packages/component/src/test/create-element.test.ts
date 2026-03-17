import { describe, it, expect } from 'vitest'

import { createElement } from '../lib/create-element.ts'
import { createMixin } from '../index.ts'

describe('createElement', () => {
  it('creates an element', () => {
    let element = createElement('div', {}, 'Hello, world!')
    expect(element.type).toBe('div')
    expect(element.props.children).toEqual(['Hello, world!'])
  })

  it('normalizes mix to an array or undefined', () => {
    let passthrough = createMixin((_handle) => {})
    let descriptor = passthrough()

    let withSingle = createElement('div', { mix: descriptor })
    let withArray = createElement('div', { mix: [descriptor] })
    let withEmptyArray = createElement('div', { mix: [] })

    expect(withSingle.props.mix).toEqual([descriptor])
    expect(withArray.props.mix).toEqual([descriptor])
    expect(withEmptyArray.props.mix).toBeUndefined()
  })
})
