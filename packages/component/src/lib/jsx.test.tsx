import { describe, it, expect } from 'vitest'
import type { Assert, Equal } from './test/utils'
import type { Dispatched } from '@remix-run/interaction'
import type { Handle } from './component'

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

  describe('intrinsic elements', () => {
    it('uses literal types for element props', () => {
      let good = <button type="button">Click me</button>
      // @ts-expect-error - wrong type
      let bad = <button type="lol">Click me</button>
    })

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

  describe('library managed attributes', () => {
    it('infers component setup and render props', () => {
      function Counter(handle: Handle, setup: number) {
        let count = setup

        return (props: { label: string }) => {
          // no `props.setup`
          type componentProps = Assert<Equal<typeof props, { label: string }>>
          return (
            <button
              on={{
                click: () => {
                  count++
                  handle.update()
                },
              }}
            >
              {props.label} {count}
            </button>
          )
        }
      }

      let good = <Counter setup={10} label="Count" />
      // @ts-expect-error - wrong type
      let bad = <Counter setup={{ initial: 10 }} label={10} />
    })

    it('infers component setup and render props with context', () => {
      function Counter(handle: Handle<number>, setup: number) {
        let count = setup

        return (props: { label: string }) => {
          handle.context.set(count)
          // no `props.setup`
          type componentProps = Assert<Equal<typeof props, { label: string }>>
          return (
            <button
              on={{
                click: () => {
                  count++
                  handle.update()
                },
              }}
            >
              {props.label} {count}
            </button>
          )
        }
      }

      let good = <Counter setup={10} label="Count" />
    })
  })
})
