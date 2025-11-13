import { describe, it, expect } from 'vitest'

describe('jsx', () => {
  it('creates an element', () => {
    let element = <div>Hello, world!</div>
    expect(element.type).toBe('div')
    expect(element.props.children).toEqual('Hello, world!')
  })

  it('warns when the wrong type of a prop is used', () => {
    let element = <a target="_blank">Hello, world!</a>

    // @ts-expect-error - wrong type
    let badElement = <a target={123}>Hello, world!</a>
  })
})
