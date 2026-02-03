import { describe, it, expect } from 'vitest'

import { createElement } from '../lib/create-element.ts'

describe('createElement', () => {
  it('creates an element', () => {
    let element = createElement('div', {}, 'Hello, world!')
    expect(element.type).toBe('div')
    expect(element.props.children).toEqual(['Hello, world!'])
  })
})
