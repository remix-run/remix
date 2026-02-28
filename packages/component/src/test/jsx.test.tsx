import { describe, it, expect } from 'vitest'
import type { Assert, Equal } from './utils'
import type { Handle } from '../lib/component'
import { animateLayout, createMixin, on, ref } from '../index.ts'
import type { Dispatched, MixinHandle, Props } from '../index.ts'

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
          mix={[
            on('pointerdown', (event) => {
              type dispatchedEvent = Assert<
                Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>
              >
              type eventTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
            }),
          ]}
        >
          Click me
        </button>
      )
    })
  })

  describe('library managed attributes', () => {
    it('infers component setup and props', () => {
      function Counter(handle: Handle, setup: number) {
        let count = setup

        return (props: { label: string }) => {
          // no `props.setup`
          type componentProps = Assert<Equal<typeof props, { label: string }>>
          return (
            <button
              mix={[
                on('click', () => {
                  count++
                  handle.update()
                }),
              ]}
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

    it('infers component setup and props with context', () => {
      function Counter(handle: Handle<number>, setup: number) {
        let count = setup

        return (props: { label: string }) => {
          handle.context.set(count)
          // no `props.setup`
          type componentProps = Assert<Equal<typeof props, { label: string }>>
          return (
            <button
              mix={[
                on('click', () => {
                  count++
                  handle.update()
                }),
              ]}
            >
              {props.label} {count}
            </button>
          )
        }
      }

      let good = <Counter setup={10} label="Count" />
    })
  })

  describe('mixins', () => {
    it('infers mixin usage from scoped callback annotations without top-level generics', () => {
      let buttonOnly = createMixin(
        (handle: MixinHandle<HTMLButtonElement, Props<'button'>>) => (props: Props<'button'>) => {
          type inferredButtonProps = Assert<Equal<typeof props, Props<'button'>>>
          return <handle.element {...props} />
        },
      )

      let good = <button mix={[buttonOnly()]} />
      // @ts-expect-error button-scoped mixin should not apply to div
      let bad = <div mix={[buttonOnly()]} />
    })

    it('allows optional explicit narrowing for specific element kinds', () => {
      let inputOnly = createMixin<HTMLInputElement>((_handle) => {})

      let good = <input mix={[inputOnly()]} />
      // @ts-expect-error input-only mixin should not apply to button
      let bad = <button mix={[inputOnly()]} />
    })

    it('infers insert event node type from createMixin node generic', () => {
      let inputOnly = createMixin<HTMLInputElement>((handle) => {
        handle.addEventListener('insert', (event) => {
          type inferredInsertNode = Assert<Equal<typeof event.node, HTMLInputElement>>
        })
      })

      let good = <input mix={[inputOnly()]} />
    })

    it('infers on mixin event/currentTarget types from host context', () => {
      let direct = (
        <button
          mix={[
            on('pointerdown', (event, signal) => {
              type inferredEvent = Assert<
                Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>
              >
              type inferredTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
              type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
            }),
          ]}
        />
      )

      let withOnMixin = createMixin<HTMLElement>((handle) => (props: Props<'div'>) => (
        <handle.element
          {...props}
          mix={[
            on('pointerdown', (event, signal) => {
              type inferredEvent = Assert<
                Equal<typeof event, Dispatched<PointerEvent, HTMLElement>>
              >
              type inferredTarget = Assert<Equal<typeof event.currentTarget, HTMLElement>>
              type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
            }),
          ]}
        />
      ))

      let applied = <div mix={[withOnMixin()]} />
    })

    it('infers ref mixin node type from host context', () => {
      let element = (
        <button
          mix={[
            ref((node, signal) => {
              type inferredNode = Assert<Equal<typeof node, HTMLButtonElement>>
              type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
            }),
          ]}
        />
      )
    })

    it('accepts animateLayout mixin usage', () => {
      let element = (
        <div mix={[animateLayout(), animateLayout({ duration: 300, easing: 'linear' })]} />
      )
    })
  })
})
