import { describe, it, expect } from 'vitest'
import { dom } from './targets.ts'
import { events, bind, type EventWithTargets, type EventDescriptor } from './events.ts'
import { createInteraction } from './interactions.ts'
import type { Assert, Equal } from '../test/utils.ts'
import { invariant } from './invariant.ts'

describe('events', () => {
  describe('type checking', () => {
    it('provides correct types for event handlers', () => {
      let cleanup = events(document.createElement('div'), [
        dom.click((event) => {
          type T1 = Assert<Equal<typeof event.currentTarget, HTMLDivElement>>
          type T2 = Assert<Equal<typeof event.target, EventTarget>>
        }),
      ])
      cleanup()
    })
  })

  describe('events() API', () => {
    it('creates event container with on and cleanup methods', () => {
      let element = document.createElement('button')
      let container = events(element)

      expect(typeof container.on).toBe('function')
      expect(typeof container.cleanup).toBe('function')
    })
  })

  describe('events().on()', () => {
    it('registers event listeners', () => {
      let element = document.createElement('button')
      let called = false
      let container = events(element)

      container.on([
        dom('click', () => {
          called = true
        }),
      ])

      element.click()
      expect(called).toBe(true)

      container.cleanup()
    })

    it('can update handlers without DOM changes', () => {
      let element = document.createElement('button')
      let callCount = 0
      let container = events(element)

      // Initial setup
      container.on([
        dom('click', () => {
          callCount = 1
        }),
      ])

      element.click()
      expect(callCount).toBe(1)

      // Update handler (same type, no DOM changes)
      container.on([
        dom('click', () => {
          callCount = 2
        }),
      ])

      element.click()
      expect(callCount).toBe(2)

      container.cleanup()
    })

    it('reattaches when event type changes', () => {
      let element = document.createElement('button')
      let callCount = 0
      let container = events(element)

      // Initial setup
      container.on([
        dom('click', () => {
          callCount++
        }),
      ])

      element.click()
      expect(callCount).toBe(1)

      // Change event type (should trigger reattach)
      container.on([
        dom('mousedown', () => {
          callCount++
        }),
      ])

      // Click should not trigger (event type changed)
      element.click()
      expect(callCount).toBe(1)

      // Mousedown should trigger
      element.dispatchEvent(new MouseEvent('mousedown'))
      expect(callCount).toBe(2)

      container.cleanup()
    })

    it('reattaches when options change', () => {
      let element = document.createElement('button')
      let callCount = 0
      let container = events(element)

      // Initial setup with once: true
      container.on([
        dom(
          'click',
          () => {
            callCount++
          },
          { once: true },
        ),
      ])

      element.click()
      element.click()
      expect(callCount).toBe(1) // Should only fire once

      // Change options (should trigger reattach)
      container.on([
        dom(
          'click',
          () => {
            callCount++
          },
          { once: false },
        ),
      ])

      element.click()
      element.click()
      expect(callCount).toBe(3) // Should fire twice more

      container.cleanup()
    })
  })

  describe('event prevention and handler execution', () => {
    it('preventDefault() stops subsequent handlers of same type', () => {
      let element = document.createElement('button')
      let firstCalled = false
      let secondCalled = false
      let container = events(element)

      container.on([
        dom('click', (event: Event) => {
          firstCalled = true
          event.preventDefault()
        }),
        dom('click', () => {
          secondCalled = true
        }),
      ])

      element.click()

      expect(firstCalled).toBe(true)
      expect(secondCalled).toBe(false)

      container.cleanup()
    })

    it("different event types don't prevent each other", () => {
      let element = document.createElement('input')
      let clickCalled = false
      let mouseDownCalled = false
      let container = events(element)

      container.on([
        dom('click', (event: Event) => {
          clickCalled = true
          event.preventDefault()
        }),
        dom('mousedown', () => {
          mouseDownCalled = true
        }),
      ])

      element.click()
      element.dispatchEvent(new MouseEvent('mousedown'))

      expect(clickCalled).toBe(true)
      expect(mouseDownCalled).toBe(true)

      container.cleanup()
    })

    it('multiple handlers of same type execute in order', () => {
      let element = document.createElement('button')
      let order: number[] = []
      let container = events(element)

      container.on([
        dom('click', () => {
          order.push(1)
        }),
        dom('click', () => {
          order.push(2)
        }),
        dom('click', () => {
          order.push(3)
        }),
      ])

      element.click()

      expect(order).toEqual([1, 2, 3])

      container.cleanup()
    })
  })

  describe('cleanup()', () => {
    it('removes all event listeners', () => {
      let element = document.createElement('button')
      let called = false
      let container = events(element)

      container.on([
        dom('click', () => {
          called = true
        }),
      ])

      container.cleanup()
      element.click()

      expect(called).toBe(false)
    })

    it('is idempotent', () => {
      let element = document.createElement('button')
      let container = events(element)

      container.on([dom('click', () => {})])

      container.cleanup()
      container.cleanup()
      container.cleanup()

      expect(true).toBe(true)
    })
  })

  describe('EventTarget support', () => {
    it('works with window EventTarget', () => {
      let called = false
      let container = events(window)

      container.on([
        dom('resize', () => {
          called = true
        }),
      ])

      window.dispatchEvent(new Event('resize'))

      expect(called).toBe(true)

      container.cleanup()
    })

    it('works with document EventTarget', () => {
      let called = false
      let container = events(document)

      container.on([
        dom('DOMContentLoaded', () => {
          called = true
        }),
      ])

      document.dispatchEvent(new Event('DOMContentLoaded'))

      expect(called).toBe(true)

      container.cleanup()
    })

    it('works with generic EventTarget', () => {
      let target = new EventTarget()
      let called = false
      let container = events(target)

      container.on([
        dom('custom-event', () => {
          called = true
        }),
      ])

      target.dispatchEvent(new CustomEvent('custom-event'))

      expect(called).toBe(true)

      container.cleanup()
    })
  })

  describe('options support', () => {
    it('dom events support options object', () => {
      let element = document.createElement('button')
      let called = false
      let container = events(element)

      container.on([
        dom(
          'click',
          () => {
            called = true
          },
          { once: true },
        ),
      ])

      element.click()
      expect(called).toBe(true)

      // Reset called flag
      called = false

      // Click again - should not be called due to { once: true }
      element.click()
      expect(called).toBe(false)

      container.cleanup()
    })

    it('dom property syntax supports options object', () => {
      let element = document.createElement('button')
      let called = false
      let container = events(element)

      container.on([
        dom.click(
          () => {
            called = true
          },
          { once: true },
        ),
      ])

      element.click()
      expect(called).toBe(true)

      // Reset called flag
      called = false

      // Click again - should not be called due to { once: true }
      element.click()
      expect(called).toBe(false)

      container.cleanup()
    })
  })

  describe('events(target, handlers) overload', () => {
    it('returns cleanup function', () => {
      let element = document.createElement('button')
      let called = false

      let cleanup = events(element, [
        dom('click', () => {
          called = true
        }),
      ])

      element.click()
      expect(called).toBe(true)

      cleanup()
    })

    it('cleanup function works with preventDefault', () => {
      let element = document.createElement('button')
      let firstCalled = false
      let secondCalled = false

      let cleanup = events(element, [
        dom('click', (event: Event) => {
          firstCalled = true
          event.preventDefault()
        }),
        dom('click', () => {
          secondCalled = true
        }),
      ])

      element.click()

      expect(firstCalled).toBe(true)
      expect(secondCalled).toBe(false)

      cleanup()
    })

    it('cleanup removes listeners', () => {
      let element = document.createElement('button')
      let called = false

      let cleanup = events(element, [
        dom('click', () => {
          called = true
        }),
      ])

      cleanup()
      element.click()

      expect(called).toBe(false)
    })
  })

  describe('custom events', () => {
    it('are isolated from dom.click preventDefault - dom.click first', () => {
      // Create a simple custom event that uses dom.click internally
      let simpleCustom = createInteraction('simple', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { triggered: true } })
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let domClickCalled = false
      let customEventCalled = false

      let cleanup = events(element, [
        dom('click', (event: Event) => {
          domClickCalled = true
          event.preventDefault()
        }),
        simpleCustom((event: CustomEvent) => {
          customEventCalled = true
        }),
      ])

      element.click()

      expect(domClickCalled).toBe(true)
      expect(customEventCalled).toBe(true) // Should be called despite preventDefault

      cleanup()
    })

    it('are isolated from dom.click preventDefault - custom event first', () => {
      // Create a simple custom event that uses dom.click internally
      let simpleCustom = createInteraction('simple', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { triggered: true } })
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let customEventCalled = false
      let domClickCalled = false

      let cleanup = events(element, [
        simpleCustom((event: CustomEvent) => {
          customEventCalled = true
        }),
        dom('click', (event: Event) => {
          domClickCalled = true
          event.preventDefault()
        }),
      ])

      element.click()

      expect(customEventCalled).toBe(true)
      expect(domClickCalled).toBe(true)

      cleanup()
    })

    it('factoryOptions change triggers reattachment', () => {
      let configurableEvent = createInteraction('configurable', ({ dispatch, target }, options) => {
        let threshold = options?.threshold || 1

        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { threshold } })
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let receivedThresholds: number[] = []
      let container = events(element)

      // Initial setup
      container.on([
        configurableEvent(
          (event: CustomEvent) => {
            receivedThresholds.push(event.detail.threshold)
          },
          { threshold: 5 },
        ),
      ])

      element.click()

      // Change factoryOptions (should reattach)
      container.on([
        configurableEvent(
          (event: CustomEvent) => {
            receivedThresholds.push(event.detail.threshold)
          },
          { threshold: 10 },
        ),
      ])

      element.click()

      expect(receivedThresholds).toEqual([5, 10])
      container.cleanup()
    })

    it('same factoryOptions allows handler updates', () => {
      let configurableEvent = createInteraction('configurable', ({ dispatch, target }, options) => {
        let threshold = options?.threshold || 1

        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { threshold } })
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let callCount = 0
      let container = events(element)

      // Initial setup
      container.on([
        configurableEvent(
          () => {
            callCount = 1
          },
          { threshold: 5 },
        ),
      ])

      element.click()
      expect(callCount).toBe(1)

      // Same factoryOptions, different handler (should NOT reattach)
      container.on([
        configurableEvent(
          () => {
            callCount = 2
          },
          { threshold: 5 },
        ),
      ])

      element.click()
      expect(callCount).toBe(2)

      container.cleanup()
    })

    it('isolates handlers with different factoryOptions so they cannot prevent each other', () => {
      let thresholdEvent = createInteraction('threshold', ({ dispatch, target }, options) => {
        let threshold = options?.threshold || 1

        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { threshold } })
          }),
        ])

        return [cleanup]
      })

      let element = document.createElement('button')
      let firstCalled = false
      let secondCalled = false

      let cleanup = events(element, [
        thresholdEvent(
          (event: CustomEvent) => {
            firstCalled = true
            event.preventDefault()
          },
          { threshold: 40 },
        ),
        thresholdEvent(
          () => {
            secondCalled = true
          },
          { threshold: 10 },
        ),
      ])

      element.click()

      expect(firstCalled).toBe(true)
      expect(secondCalled).toBe(true) // Different options = different events = no preventDefault isolation

      cleanup()
    })
  })

  describe('reattachment behavior', () => {
    it('array length changes trigger reattachment', () => {
      let element = document.createElement('button')
      let clickCount = 0
      let keydownCount = 0
      let container = events(element)

      // Initial setup with 1 event
      container.on([
        dom('click', () => {
          clickCount++
        }),
      ])

      element.click()
      expect(clickCount).toBe(1)

      // Add another event (length change should reattach)
      container.on([
        dom('click', () => {
          clickCount++
        }),
        dom('keydown', () => {
          keydownCount++
        }),
      ])

      element.click()
      element.dispatchEvent(new KeyboardEvent('keydown'))

      expect(clickCount).toBe(2)
      expect(keydownCount).toBe(1)

      // Remove an event (length change should reattach)
      container.on([
        dom('click', () => {
          clickCount++
        }),
      ])

      element.click()
      element.dispatchEvent(new KeyboardEvent('keydown'))

      expect(clickCount).toBe(3)
      expect(keydownCount).toBe(1) // Should not increment

      container.cleanup()
    })

    it('isCustom flag change triggers reattachment', () => {
      let customEvent = createInteraction('test', ({ dispatch, target }) => {
        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { custom: true } })
          }),
        ])
        return [cleanup]
      })

      let element = document.createElement('button')
      let standardCalled = false
      let customCalled = false
      let container = events(element)

      // Initial setup with standard event
      container.on([
        dom('test', () => {
          standardCalled = true
        }),
      ])

      element.dispatchEvent(new CustomEvent('test'))
      expect(standardCalled).toBe(true)

      // Change to custom event with same type (isCustom change should reattach)
      container.on([
        customEvent(() => {
          customCalled = true
        }),
      ])

      element.click() // This triggers the custom event factory
      expect(customCalled).toBe(true)

      container.cleanup()
    })
  })

  describe('bind()', () => {
    it('types work correctly', () => {
      events(document.createElement('button'), [
        bind('click', (event) => {
          type Expected = EventWithTargets<Event, HTMLButtonElement, any>
          type T = Assert<Equal<Expected, typeof event>>
        }),
      ])
    })

    it('creates event definition', () => {
      let handler = () => {}
      let eventDef = bind('click', handler)

      expect(eventDef.type).toBe('click')
      expect(eventDef.handler).toBe(handler)
    })

    it('works with custom event names', () => {
      let handler = () => {}
      let eventDef = bind('custom-event', handler)

      expect(eventDef.type).toBe('custom-event')
      expect(eventDef.handler).toBe(handler)
    })

    it('works with kebab-case event names', () => {
      let handler = () => {}
      let eventDef = bind('some-custom-event', handler)

      expect(eventDef.type).toBe('some-custom-event')
      expect(eventDef.handler).toBe(handler)
    })

    it('works with generic event type', () => {
      let handler = (event: CustomEvent<{ value: string }>) => {
        expect(event).toBeInstanceOf(Event)
      }

      let eventDef = bind<CustomEvent<{ value: string }>>('custom', handler)
      expect(eventDef.type).toBe('custom')
      expect(eventDef.handler).toBe(handler)
    })

    it('works with generic currentTarget type', () => {
      let handler = () => {}
      let eventDef = bind<Event, HTMLButtonElement>('click', handler)

      expect(eventDef.type).toBe('click')
      expect(eventDef.handler).toBe(handler)
    })

    it('works with both generic event and target types', () => {
      let handler = () => {}
      let eventDef = bind<MouseEvent, HTMLButtonElement>('click', handler)

      expect(eventDef.type).toBe('click')
      expect(eventDef.handler).toBe(handler)
    })
  })

  describe('event spreading and duplication prevention', () => {
    it('calls event handlers only once when using ...on spread', () => {
      let element = document.createElement('div')
      let parentPressCount = 0
      let childPressCount = 0

      // Simulate the Tab component pattern that spreads ...on
      function ChildComponent({ on = [] }: { on?: EventDescriptor[] }) {
        let childElement = document.createElement('button')
        childElement.textContent = 'Child Button'

        events(childElement, [
          ...on, // Spread consumer events first
          dom('click', () => {
            childPressCount++
          }),
        ])

        element.appendChild(childElement)
        return childElement
      }

      // Create child with parent event handler via props
      let childElement = ChildComponent({
        on: [
          dom('click', () => {
            parentPressCount++
          }),
        ],
      })

      // Trigger click
      childElement.click()

      // Each handler should only be called once
      expect(parentPressCount).toBe(1)
      expect(childPressCount).toBe(1)
    })

    it('calls consumer press handler only once when spread into Tab-like component', () => {
      let consumerCallCount = 0
      let componentCallCount = 0

      // Create a press interaction
      let press = createInteraction('press', ({ target, dispatch }) => {
        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { triggered: true } })
          }),
        ])
        return [cleanup]
      })

      // Simulate the exact Tab component pattern
      function TabLikeComponent({ on = [] }: { on?: any[] }) {
        let element = document.createElement('button')

        // This is exactly what Tab does: spread consumer events, then add component events
        events(element, [
          ...on, // Consumer events spread here (this was causing the bug)
          press(() => {
            componentCallCount++
          }),
        ])

        return element
      }

      // Create component with consumer press handler (like <Tab on={[press(handler)]} />)
      let element = TabLikeComponent({
        on: [
          press(() => {
            consumerCallCount++
          }),
        ],
      })

      // Trigger a click
      element.click()

      // BOTH handlers should be called exactly once
      // Bug was: consumer called twice, component called once
      expect(consumerCallCount).toBe(1) // This was failing (was 2)
      expect(componentCallCount).toBe(1) // This was working correctly
    })

    it('calls press handlers with different options exactly once each (no duplication)', () => {
      let consumerCallCount = 0
      let componentCallCount = 0

      // Create a press interaction
      let press = createInteraction('press', ({ target, dispatch }) => {
        let cleanup = events(target, [
          dom('click', () => {
            dispatch({ detail: { triggered: true } })
          }),
        ])
        return [cleanup]
      })

      let element = document.createElement('button')

      // This recreates the exact scenario that was broken:
      // Consumer with options + Component without options
      let cleanup = events(element, [
        // Consumer press with options (was being called twice before fix)
        press(
          () => {
            consumerCallCount++
          },
          { hit: 100 },
        ),

        // Component press without options (was working correctly)
        press(() => {
          componentCallCount++
        }),
      ])

      // Trigger a click
      element.click()

      // Both handlers should be called exactly once
      // Before fix: consumerCallCount would be 2, componentCallCount would be 1
      // After fix: both should be 1
      expect(consumerCallCount).toBe(1)
      expect(componentCallCount).toBe(1)

      cleanup()
    })
  })

  describe('signal support', () => {
    it('provides abort signal as second argument', () => {
      let element = document.createElement('button')
      let capturedSignal: AbortSignal | undefined
      events(element, [
        dom('click', (_event, signal) => {
          capturedSignal = signal
        }),
      ])
      element.click()
      expect(capturedSignal).toBeInstanceOf(AbortSignal)
    })

    it('aborts on reentry into handler', () => {
      let element = document.createElement('button')

      let capturedSignal: AbortSignal | undefined

      events(element, [
        dom('click', (_event, signal) => {
          // only capture first signal
          if (!capturedSignal) {
            capturedSignal = signal
          }
        }),
      ])

      element.click()
      invariant(capturedSignal)
      expect(capturedSignal.aborted).toBe(false)
      element.click()
      expect(capturedSignal.aborted).toBe(true)
      expect(capturedSignal).toBeInstanceOf(AbortSignal)
    })

    it('provides a new signal on reentry into handler', () => {
      let element = document.createElement('button')

      let capturedSignals: AbortSignal[] = []

      events(element, [
        dom('click', (_event, signal) => {
          capturedSignals.push(signal)
        }),
      ])

      element.click()
      expect(capturedSignals.length).toBe(1)
      element.click()
      expect(capturedSignals.length).toBe(2)
      expect(capturedSignals[0]).not.toBe(capturedSignals[1])
      expect(capturedSignals[0].aborted).toBe(true)
      expect(capturedSignals[1].aborted).toBe(false)
    })
  })
})
