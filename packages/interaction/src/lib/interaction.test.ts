import { describe, it, expect, vi } from 'vitest'

import {
  createContainer,
  defineInteraction,
  on,
  TypedEventTarget,
  type Dispatched,
  type EventListeners,
  type Interaction,
} from './interaction.ts'
import type { Assert, Equal } from './test/utils.ts'

describe('interaction', () => {
  describe('createContainer', () => {
    it('adds listeners to the target', () => {
      let target = new EventTarget()
      let container = createContainer(target)
      let listener = vi.fn()

      container.set({ test: listener })

      target.dispatchEvent(new Event('test'))
      expect(listener).toHaveBeenCalled()
    })

    it('updates listeners in place', () => {
      let target = new EventTarget()
      let container = createContainer(target)
      let listener1 = vi.fn()
      let listener2 = vi.fn()

      container.set({ test: listener1 })
      target.dispatchEvent(new Event('test'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(0)

      container.set({ test: listener2 })
      target.dispatchEvent(new Event('test'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('reapplies options when they change', () => {
      let target = new EventTarget()
      let spy = vi.spyOn(target, 'removeEventListener')
      let container = createContainer(target)

      let listener1 = vi.fn()
      let listener2 = vi.fn()

      container.set({ test: listener1 })
      target.dispatchEvent(new Event('test'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledTimes(0)

      container.set({ test: { capture: true, listener: listener2 } })
      target.dispatchEvent(new Event('test'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('supports arrays', () => {
      let target = new EventTarget()
      let container = createContainer(target)
      let listener1 = vi.fn()
      let listener2 = vi.fn()

      container.set({ test: [listener1, listener2] })
      target.dispatchEvent(new Event('test'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('retains stopImmediatePropagation semantics', () => {
      let target = new EventTarget()
      let container = createContainer(target)
      let firstListenerCalled = false
      let secondListenerCalled = false

      container.set({
        test: [
          (event) => {
            firstListenerCalled = true
            event.stopImmediatePropagation()
          },
          () => {
            secondListenerCalled = true
          },
        ],
      })
      target.dispatchEvent(new Event('test'))
      expect(firstListenerCalled).toBe(true)
      expect(secondListenerCalled).toBe(false)
    })

    it('removes all handlers when set({}) is called', () => {
      let target = new EventTarget()
      let container = createContainer(target)
      let listener1 = vi.fn()
      let listener2 = vi.fn()

      container.set({ test1: listener1, test2: listener2 })
      target.dispatchEvent(new Event('test1'))
      target.dispatchEvent(new Event('test2'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      container.set({})
      target.dispatchEvent(new Event('test1'))
      target.dispatchEvent(new Event('test2'))
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('throws when calling set after dispose', () => {
      let target = new EventTarget()
      let container = createContainer(target)
      container.dispose()
      expect(() => container.set({ test: () => {} })).toThrow('Container has been disposed')
    })

    describe('descriptors', () => {
      it('provides options with descriptors', () => {
        let target = new EventTarget()
        let listener = vi.fn()

        createContainer(target).set({
          test: { once: true, listener },
        })

        target.dispatchEvent(new Event('test'))
        expect(listener).toHaveBeenCalledTimes(1)
        target.dispatchEvent(new Event('test'))
        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('captures events', () => {
        let button = document.createElement('button')
        document.body.appendChild(button)

        let captured = false
        let bubbled = false

        createContainer(document.body).set({
          click: {
            capture: true,
            listener(event) {
              event.stopPropagation()
              captured = true
            },
          },
        })

        // add event to the target to test that it's not captured and prove its
        // all just normal DOM events by using button.addEventListener
        button.addEventListener('click', () => {
          bubbled = true
        })

        // dispatch from the button
        button.dispatchEvent(new Event('click', { bubbles: true }))
        expect(captured).toBe(true)
        expect(bubbled).toBe(false)
      })
    })

    describe('error handling', () => {
      it('dispatches error event when a listener throws synchronously', () => {
        let target = new EventTarget()
        let mock = vi.fn()
        let error = new Error('test')
        target.addEventListener('error', mock)
        let container = createContainer(target)
        container.set({
          test: () => {
            throw error
          },
        })
        target.dispatchEvent(new Event('test'))
        expect(mock).toHaveBeenCalledTimes(1)
        expect((mock.mock.calls[0][0] as ErrorEvent).error).toBe(error)
      })

      it('dispatches error event when a listener throws asynchronously', async () => {
        let target = new EventTarget()
        let mock = vi.fn()
        let error = new Error('test')
        target.addEventListener('error', mock)
        createContainer(target).set({
          async test() {
            // ensure the error is thrown asynchronously (next microtask)
            await Promise.resolve()
            throw error
          },
        })
        target.dispatchEvent(new Event('test'))
        // let the listener's awaited microtask run and reject
        await Promise.resolve()
        // run the container's dispatchError handler
        await Promise.resolve()
        expect(mock).toHaveBeenCalledTimes(1)
        expect((mock.mock.calls[0][0] as ErrorEvent).error).toBe(error)
      })
    })

    describe('types', () => {
      it('provides literal event and target types to listeners', () => {
        let button = document.createElement('button')
        createContainer(button).set({
          pointerdown: (event) => {
            type T = Assert<Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>>
          },
          keydown: [
            (event) => {
              type T = Assert<Equal<typeof event, Dispatched<KeyboardEvent, HTMLButtonElement>>>
            },
          ],
        })
      })

      it('restricts to known event types', () => {
        let button = document.createElement('button')
        createContainer(button).set({
          // @ts-expect-error - unknown event type
          unknown: () => {},
        })
      })

      it('uses generic Event for unknown targets', () => {
        let target = new EventTarget()
        createContainer(target).set({
          test: (event) => {
            type T = Assert<Equal<typeof event, Dispatched<Event, EventTarget>>>
          },
        })
      })
    })
  })

  describe('on', () => {
    it('creates a container and sets the listeners', () => {
      let target = new EventTarget()
      let listener = vi.fn()
      on(target, { test: listener })
      target.dispatchEvent(new Event('test'))
      expect(listener).toHaveBeenCalled()
    })

    describe('types', () => {
      it('provides literal event and target types to listeners', () => {
        let button = document.createElement('button')
        on(button, {
          pointerdown: (event) => {
            type T = Assert<Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>>
          },
          // @ts-expect-error - unknown event type
          test: () => {},
        })
      })
    })
  })

  describe('interactions', () => {
    it('adds host events and dispatches custom events', () => {
      let hostType = 'host-event'
      let myType = defineInteraction('my:type', Test)

      function Test(handle: Interaction) {
        handle.on(handle.target, {
          [hostType]: () => {
            handle.target.dispatchEvent(new Event(myType))
          },
        })
      }

      let target = new EventTarget()
      let listener = vi.fn()
      on(target, {
        // bind interaction type
        [myType]: listener,
      })

      // dispatch host type to test interaction dispatches the custom type
      target.dispatchEvent(new Event(hostType))
      expect(listener).toHaveBeenCalled()
    })

    it('only initializes interactions once', () => {
      let myType1 = defineInteraction('my:type-1', Test)
      let myType2 = defineInteraction('my:type-2', Test)

      let initialized = 0
      function Test() {
        initialized++
      }

      let target = new EventTarget()
      on(target, { [myType1]: () => {}, [myType2]: () => {} })
      on(target, { [myType1]: [() => {}, () => {}], [myType2]: [() => {}, () => {}] })

      expect(initialized).toBe(1)
    })
  })

  it('re-initializes interactions after dispose', () => {
    let hostType = 'host-event'
    let myType = defineInteraction('my:type', Test)

    function Test(handle: Interaction) {
      handle.on(handle.target, {
        [hostType]: () => {
          handle.target.dispatchEvent(new Event(myType))
        },
      })
    }

    let target = new EventTarget()
    let listener1 = vi.fn()
    let dispose1 = on(target, {
      [myType]: listener1,
    })

    target.dispatchEvent(new Event(hostType))
    expect(listener1).toHaveBeenCalledTimes(1)

    dispose1()

    let listener2 = vi.fn()
    on(target, {
      [myType]: listener2,
    })

    target.dispatchEvent(new Event(hostType))
    expect(listener2).toHaveBeenCalledTimes(1)
    expect(listener1).toHaveBeenCalledTimes(1)
  })

  describe('TypedEventTarget', () => {
    interface DrummerEventMap {
      kick: DrummerEvent
      snare: DrummerEvent
      hat: DrummerEvent
    }

    class DrummerEvent extends Event {
      type: keyof DrummerEventMap
      constructor(type: DrummerEvent['type']) {
        super(type)
        this.type = type
      }
    }

    class Drummer extends TypedEventTarget<DrummerEventMap> {}

    it('adds literal event class to listener', () => {
      let drummer = new Drummer()
      drummer.addEventListener('kick', (event) => {
        type T = Assert<Equal<typeof event, DrummerEvent>>
      })
      expect(true).toBe(true)
    })

    it('allows any type of event to be added to listener', () => {
      let drummer = new Drummer()
      drummer.addEventListener('not-in-the-map', (event) => {
        type T = Assert<Equal<typeof event, Event>>
      })
    })

    it('works with containers', () => {
      let drummer = new Drummer()
      on(drummer, {
        kick: (event) => {
          type T = Assert<Equal<typeof event, Dispatched<DrummerEvent, Drummer>>>
        },
      })
    })
  })

  describe('types', () => {
    it('provides EventListeners type', () => {
      let listeners: EventListeners<Document> = {
        keydown: (event) => {
          type T = Assert<Equal<typeof event, Dispatched<KeyboardEvent, Document>>>
        },

        // @ts-expect-error - unknown event type
        unknown: () => {},
      }

      let listeners2: EventListeners = {
        anything: (event) => {
          type T = Assert<Equal<typeof event, Dispatched<Event, EventTarget>>>
        },
      }
    })
  })
})
