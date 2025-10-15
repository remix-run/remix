import { describe, it, expect } from 'vitest'

import type { EventWithTargets } from './events.ts'
import { events } from './events.ts'
import { createInteraction } from './interactions.ts'
import { dom } from './targets.ts'
import type { Assert, Equal } from '../test/utils.ts'

describe('createInteraction', () => {
  describe('type inference', () => {
    it('infers types correctly', () => {
      type TestEventDetail = { clicked: boolean }

      let testEvent = createInteraction<Element, TestEventDetail>(
        'test',
        ({ dispatch, target }) => {
          return events(target, [
            dom('click', () => {
              dispatch({ detail: { clicked: true } })
            }),
          ])
        },
      )

      events(document.createElement('div'), [
        testEvent((event) => {
          type Expected = EventWithTargets<CustomEvent<TestEventDetail>, HTMLDivElement, any>
          type T = Assert<Equal<Expected, typeof event>>
          // @ts-expect-error divs don't have disabled
          event.currentTarget.disabled
        }),
      ])
    })
  })

  describe('basic usage', () => {
    it('creates interaction definitions', () => {
      let testEvent = createInteraction('test', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', (event) => {
            dispatch({ detail: { clicked: true } }, event)
          }),
        ])

        return [cleanup]
      })

      let handler = (event: CustomEvent) => {}
      let eventDef = testEvent(handler)

      expect(eventDef.type).toBe('test')
      expect(eventDef.handler).toBe(handler)
      expect(eventDef.isCustom).toBe(true)
    })
  })

  describe('event dispatching', () => {
    it('dispatches events with detail', () => {
      let testEvent = createInteraction('test', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', (event) => {
            dispatch({ detail: { value: 'hello' } }, event)
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let receivedDetail: any = null

      let cleanup = events(element, [
        testEvent((event: CustomEvent) => {
          receivedDetail = event.detail
        }),
      ])

      element.click()

      expect(receivedDetail).toEqual({ value: 'hello' })

      cleanup()
    })

    it('supports preventDefault', () => {
      let testEvent = createInteraction('test', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', (event) => {
            dispatch({ detail: { value: 'hello' } }, event)
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let firstCalled = false
      let secondCalled = false

      let cleanup = events(element, [
        testEvent((event: CustomEvent) => {
          firstCalled = true
          event.preventDefault()
        }),
        testEvent(() => {
          secondCalled = true
        }),
      ])

      element.click()

      expect(firstCalled).toBe(true)
      expect(secondCalled).toBe(false)

      cleanup()
    })
  })

  describe('cleanup', () => {
    it('calls cleanup functions', () => {
      let cleanupCalled = false

      let testEvent = createInteraction('test', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { value: 'hello' } })
          }),
        ])

        let customCleanup = () => {
          cleanupCalled = true
        }

        return [cleanup, customCleanup] // Test array return
      })

      let element = document.createElement('button')
      let cleanup = events(element, [testEvent(() => {})])

      cleanup()

      expect(cleanupCalled).toBe(true)
    })

    it('maintains state between events', () => {
      let clickCount = createInteraction('clickcount', ({ dispatch, target }) => {
        let count = 0

        let cleanup = events(target, [
          dom('click', (event) => {
            count++
            dispatch({ detail: { count } }, event)
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let counts: number[] = []

      let cleanup = events(element, [
        clickCount((event: CustomEvent) => {
          counts.push(event.detail.count)
        }),
      ])

      element.click()
      element.click()
      element.click()

      expect(counts).toEqual([1, 2, 3])

      cleanup()
    })
  })

  describe('options', () => {
    it('accepts options parameter', () => {
      let testEvent = createInteraction('test', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', (event) => {
            dispatch({ detail: { value: 'hello' } }, event)
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let called = false

      // Test that custom events can accept options (for future extensibility)
      let cleanup = events(element, [
        testEvent(
          (event: CustomEvent) => {
            called = true
          },
          { customOption: 'value' },
        ),
      ])

      element.click()

      expect(called).toBe(true)

      cleanup()
    })

    it('passes options to setup', () => {
      // Mock press events for the example
      let pressMock = createInteraction('press', ({ dispatch, target }, options) => {
        let hitBox = options?.hit || 10
        let releaseBox = options?.release || 10

        let cleanup = events(target, [
          dom('click', (event) => {
            dispatch({ detail: { pressed: true, hitBox, releaseBox } }, event)
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let pressCalled = false
      let receivedOptions: any = null

      let cleanup = events(element, [
        pressMock(
          (event: CustomEvent) => {
            pressCalled = true
            receivedOptions = {
              hitBox: event.detail.hitBox,
              releaseBox: event.detail.releaseBox,
            }
          },
          { hit: 20, release: 30 },
        ),
      ])

      element.click()

      expect(pressCalled).toBe(true)
      expect(receivedOptions).toEqual({ hitBox: 20, releaseBox: 30 })

      cleanup()
    })

    it('types options correctly', () => {
      type PressOptions = {
        hit?: number
        release?: number
        longPressDelay?: number
      }

      type PressEventDetail = {
        pressed: boolean
        config: PressOptions
      }

      let press = createInteraction<Element, PressEventDetail, PressOptions>(
        'press',
        ({ dispatch, target }, options) => {
          let config = {
            hit: options?.hit ?? 10,
            release: options?.release ?? 10,
            longPressDelay: options?.longPressDelay ?? 500,
          }

          let cleanup = events(target, [
            dom('mousedown', (event) => {
              dispatch(
                {
                  detail: {
                    pressed: true,
                    config,
                  },
                },
                event,
              )
            }),
          ])

          return [cleanup]
        },
      )

      let element = document.createElement('button')
      let eventDetail: PressEventDetail | null = null

      let cleanup = events(element, [
        press(
          (event) => {
            eventDetail = event.detail
          },
          {
            hit: 15,
            release: 25,
            longPressDelay: 1000,
          },
        ),
      ])

      element.dispatchEvent(new MouseEvent('mousedown'))

      expect(eventDetail!.pressed).toBe(true)
      expect(eventDetail!.config).toEqual({
        hit: 15,
        release: 25,
        longPressDelay: 1000,
      })

      cleanup()
    })
  })

  describe('event propagation', () => {
    it('supports stopPropagation', () => {
      let buttonCallCount = 0
      let documentCallCount = 0

      let testEvent = createInteraction('test', ({ dispatch, target }) => {
        return events(target, [
          dom('click', (event) => {
            dispatch({ detail: { value: 'hello' } }, event)
          }),
        ])
      })

      let element = document.createElement('button')
      document.body.appendChild(element)

      events(element, [
        testEvent((event) => {
          event.stopPropagation()
          buttonCallCount++
        }),
      ])

      events(document.body, [
        testEvent(() => {
          documentCallCount++
        }),
      ])

      element.click()

      expect(buttonCallCount).toBe(1)
      expect(documentCallCount).toBe(0)

      document.body.removeChild(element)
    })

    it('stops propagation on raw custom events', () => {
      let customEventCallCount = 0

      let element = document.createElement('button')
      document.body.appendChild(element)

      element.addEventListener('test', (event) => {
        event.stopPropagation()
        customEventCallCount++
      })

      document.addEventListener('test', () => {
        customEventCallCount++
      })

      element.dispatchEvent(new CustomEvent('test', { bubbles: true }))

      expect(customEventCallCount).toBe(1)
    })

    it('stops both custom and original events', () => {
      let buttonClickCount = 0
      let bodyClickCount = 0
      let customEventCount = 0

      let testEvent = createInteraction('demo', ({ dispatch, target }) => {
        return events(target, [
          dom('click', (event) => {
            dispatch({ detail: { value: 'test' } }, event)
          }),
        ])
      })

      let button = document.createElement('button')
      document.body.appendChild(button)

      // Add real click listeners to verify stopPropagation works on original events
      button.addEventListener('click', () => {
        buttonClickCount++
      })

      document.body.addEventListener('click', () => {
        bodyClickCount++
      })

      // Add our custom interaction
      let cleanup = events(button, [
        testEvent((event) => {
          customEventCount++
          // This should now stop both the custom event AND the original click event
          event.stopPropagation()
        }),
      ])

      button.click()

      expect(customEventCount).toBe(1)
      expect(buttonClickCount).toBe(1) // Button click still fires
      expect(bodyClickCount).toBe(0) // But body click should NOT fire due to stopPropagation

      cleanup()
      document.body.removeChild(button)
    })
  })
})
