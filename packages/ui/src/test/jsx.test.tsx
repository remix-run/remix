import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Assert, Equal } from './utils'
import type { Handle, RemixNode } from '../runtime/component.ts'
import { createMixin, on, ref } from '../index.ts'

import { animateLayout } from '../animation/index.ts'
import type { Dispatched, MixinHandle, Props } from '../index.ts'

type MixLeaf<mix> = mix extends ReadonlyArray<infer descriptor> ? MixLeaf<descriptor> : mix
type FalsyMixValue = false | 0 | 0n | '' | null | undefined
type NormalizeMixLeaf<mix> = Exclude<MixLeaf<mix>, FalsyMixValue>
type NormalizedMix<mix> = Array<NormalizeMixLeaf<mix>> | undefined

describe('jsx', () => {
  it('creates an element', () => {
    let element = <div>Hello, world!</div>
    expect(element.type).toBe('div')
    expect(element.props.children).toEqual('Hello, world!')
  })

  /* oxlint-disable eslint/no-unused-vars */
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

    it('accepts nested mix values for host element JSX while render props still see arrays', () => {
      let passthrough = createMixin((_handle) => {})
      let descriptor = passthrough()

      let withNested = <button mix={[[descriptor], [[[descriptor]]]]}>Click me</button>

      expect(withNested.props.mix).toEqual([descriptor, descriptor])
    })
  })

  describe('library managed attributes', () => {
    it('infers component props', () => {
      interface CounterProps {
        initialCount: number
        label: string
      }

      function Counter(handle: Handle<CounterProps>) {
        let count = handle.props.initialCount

        return () => {
          type componentProps = Assert<Equal<typeof handle.props, CounterProps>>
          return (
            <button
              mix={[
                on('click', () => {
                  count++
                  handle.update()
                }),
              ]}
            >
              {handle.props.label} {count}
            </button>
          )
        }
      }

      let good = <Counter initialCount={10} label="Count" />
      // @ts-expect-error - wrong type
      let bad = <Counter initialCount={{ initial: 10 }} label={10} />
    })

    it('infers component props with context', () => {
      interface CounterProps {
        initialCount: number
        label: string
      }

      function Counter(handle: Handle<CounterProps, number>) {
        let count = handle.props.initialCount

        return () => {
          handle.context.set(count)
          type componentProps = Assert<Equal<typeof handle.props, CounterProps>>
          return (
            <button
              mix={[
                on('click', () => {
                  count++
                  handle.update()
                }),
              ]}
            >
              {handle.props.label} {count}
            </button>
          )
        }
      }

      let good = <Counter initialCount={10} label="Count" />
    })

    it('accepts single or array mix values for component JSX while render props see arrays', () => {
      let passthrough = createMixin((handle) => {})

      function Button(handle: Handle<Props<'button'>>) {
        return () => {
          type normalizedMix = Assert<
            Equal<typeof handle.props.mix, NormalizedMix<JSX.IntrinsicElements['button']['mix']>>
          >
          return <button {...handle.props} />
        }
      }

      let descriptor = passthrough()
      let withSingle = <Button mix={descriptor} />
      let withArray = <Button mix={[descriptor]} />
      let withNested = <Button mix={[[descriptor], [[[descriptor]]]]} />
      let withoutMix = <Button />

      expect(withSingle.props.mix).toEqual([descriptor])
      expect(withArray.props.mix).toEqual([descriptor])
      expect(withNested.props.mix).toEqual([descriptor, descriptor])
      expect(withoutMix.props.mix).toBeUndefined()
    })
  })

  describe('mixins', () => {
    it('infers mixin usage from scoped callback annotations without top-level generics', () => {
      type ButtonMixinProps = Omit<Props<'button'>, 'mix' | 'children' | 'innerHTML'>
      let buttonOnly = createMixin(
        (handle: MixinHandle<HTMLButtonElement, Props<'button'>>) => (props: ButtonMixinProps) => {
          type inferredButtonProps = Assert<Equal<typeof props, ButtonMixinProps>>
          return <handle.element {...props} />
        },
      )

      let good = <button mix={[buttonOnly()]} />
      // @ts-expect-error button-scoped mixin should not apply to div
      let bad = <div mix={[buttonOnly()]} />
    })

    it('allows optional explicit narrowing for specific element kinds', () => {
      let inputOnly = createMixin<HTMLInputElement>((handle) => {})

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

      let withOnMixin = createMixin<HTMLElement>((handle) => (props) => (
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

    it('infers context.get types on mixin handles', () => {
      function Provider(handle: Handle<{ children?: RemixNode }, { value: number }>) {
        handle.context.set({ value: 1 })
        return () => <div>{handle.props.children}</div>
      }

      let withContext = createMixin<HTMLDivElement, [], Props<'div'>>((handle) => {
        let provider = handle.context.get(Provider)
        type inferredContext = Assert<Equal<typeof provider, { value: number }>>

        return (props) => <handle.element {...props} data-value={String(provider.value)} />
      })

      let descriptor = withContext()
      let provider = <Provider />
    })
  })
  /* oxlint-enable eslint/no-unused-vars */
})
