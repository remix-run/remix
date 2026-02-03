import { describe, it, expect } from 'vitest'
import type { Assert, Equal } from './utils'
import type { Dispatched } from '@remix-run/interaction'
import type { Handle } from '../lib/component'

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
    it('infers component setup and props', () => {
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

    it('infers component setup and props with context', () => {
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

  describe('animate', () => {
    it('accepts true for individual animation types', () => {
      let element = <div animate={{ enter: true }}>Hello</div>
      let element2 = <div animate={{ enter: true, exit: true, layout: true }}>Hello</div>
    })

    it('accepts enter-only config', () => {
      let element = (
        <div
          animate={{
            enter: { opacity: 0, duration: 200 },
          }}
        >
          Enter only
        </div>
      )
    })

    it('accepts exit-only config', () => {
      let element = (
        <div
          animate={{
            exit: { opacity: 0, duration: 150 },
          }}
        >
          Exit only
        </div>
      )
    })

    it('accepts shorthand config with single keyframe', () => {
      let element = (
        <div
          animate={{
            enter: { opacity: 0, transform: 'scale(0.85)', duration: 200, easing: 'ease-out' },
            exit: { opacity: 0, duration: 150 },
          }}
        >
          Shorthand config
        </div>
      )
    })

    it('accepts full keyframes config', () => {
      let element = (
        <div
          animate={{
            enter: {
              keyframes: [
                { opacity: 0, transform: 'scale(0.8)' },
                { opacity: 1, transform: 'scale(1.05)', offset: 0.7 },
                { opacity: 1, transform: 'scale(1)' },
              ],
              duration: 300,
              easing: 'ease-out',
              // @ts-expect-error - keyframes defined so only config here
              opacity: 0,
            },
            exit: {
              opacity: 0,
              transform: 'scale(0.9)',
              duration: 150,
            },
          }}
        >
          Full keyframes
        </div>
      )
    })

    it('accepts delay option', () => {
      let element = (
        <div
          animate={{
            enter: { opacity: 0, duration: 200, delay: 100 },
            exit: { opacity: 0, duration: 150, delay: 50 },
          }}
        >
          With delay
        </div>
      )
    })

    it('accepts composite option', () => {
      let element = (
        <div
          animate={{
            enter: { opacity: 0, duration: 200, composite: 'add' },
            exit: { opacity: 0, duration: 150, composite: 'replace' },
          }}
        >
          With composite
        </div>
      )
    })

    it('accepts per-keyframe easing and offset', () => {
      let element = (
        <div
          animate={{
            enter: {
              keyframes: [
                { opacity: 0, easing: 'ease-in' },
                { opacity: 0.5, offset: 0.3, easing: 'linear' },
                { opacity: 1, offset: 1 },
              ],
              duration: 300,
            },
          }}
        >
          Per-keyframe options
        </div>
      )
    })

    it('rejects invalid animate values', () => {
      // @ts-expect-error - animate must be true or PresenceProp
      let bad1 = <div animate={false}>Bad</div>
      // @ts-expect-error - animate must be true or PresenceProp
      let bad2 = <div animate="fade">Bad</div>
      // @ts-expect-error - duration is required in animate config
      let bad3 = <div animate={{ enter: { opacity: 0 } }}>Bad</div>
      // @ts-expect-error - keyframes requires an array
      let bad4 = <div animate={{ enter: { keyframes: { opacity: 0 }, duration: 200 } }}>Bad</div>
    })

    it('accepts various animatable style properties', () => {
      let element = (
        <div
          animate={{
            enter: {
              opacity: 0,
              transform: 'translateY(-10px)',
              filter: 'blur(4px)',
              clipPath: 'inset(0 0 100% 0)',
              backgroundColor: 'transparent',
              color: 'red',
              scale: 0.9,
              rotate: '5deg',
              translate: '0 -10px',
              duration: 200,
            },
          }}
        >
          Various properties
        </div>
      )
    })
  })
})
