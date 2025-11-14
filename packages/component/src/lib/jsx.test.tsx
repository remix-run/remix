import { describe, it, expect } from 'vitest'
import type { Assert, Equal } from './test/utils'
import type { Dispatched } from '@remix-run/interaction'

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

  describe('remix attributes', () => {
    it('infers the event target type from the element type', () => {
      let element = (
        <button
          on={{
            pointerdown: (event) => {
              type dispatchedEvent = Assert<
                Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>
              >
              type eventTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
            },
          }}
        >
          Click me
        </button>
      )
    })
  })
})
