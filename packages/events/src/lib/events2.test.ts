import { describe, it, expect, vi } from 'vitest'
import { bind, createBinder, events, type EventDescriptor, type Interaction } from './events2.ts'
import type { Assert, Equal } from '../test/utils.ts'
import { invariant } from './invariant.ts'

describe('types', () => {
  describe('EventDescriptor', () => {
    // it('has literal event and currentTarget type', () => {
    //   type D = EventDescriptor<PointerEvent>
    //   type E = Parameters<D['listener']>[0]
    //   type T = Assert<Equal<E, EventWithTarget<PointerEvent, HTMLDivElement>>>
    // })
  })

  describe('bind', () => {
    it('provides literal event type', () => {
      type Target = HTMLButtonElement
      bind<Target, 'click', PointerEvent>('click', (event) => {
        type T2 = Assert<Equal<typeof event, EventWithTarget<PointerEvent, HTMLButtonElement>>>
      })
    })
  })

  describe('on', () => {
    it('infers event.currentTarget', () => {
      let target = document.createElement('div')
      events(target).on(
        bind('keydown', (event) => {
          type T1 = Assert<Equal<typeof event.currentTarget, HTMLDivElement>>
          type T2 = Assert<Equal<typeof event, KeyboardEvent>>
        }),
      )
    })

    it('adds generic to event.currentTarget and event type', () => {
      let target = document.createElement('div')
      events(target).on(
        bind('click', (event) => {
          type T = Assert<Equal<typeof event.currentTarget, HTMLDivElement>>
        }),
      )
    })
  })
})

describe('bind', () => {
  it('creates event descriptors', () => {
    let listener = () => {}
    let descriptor = bind('click', listener, { once: true })
    expect(descriptor).toEqual({
      type: 'click',
      listener,
      options: { once: true },
    })
  })

  it('defaults options to empty object', () => {
    let descriptor = bind('click', () => {})
    expect(descriptor.options).toEqual({})
  })

  it('adds type to listener currentTarget', () => {
    let descriptor = bind<HTMLButtonElement>('click', () => {})
    type Target = Parameters<typeof descriptor.listener>[0]['currentTarget']
    type T2 = Assert<Equal<Target, HTMLButtonElement>>
    expect(true).toBe(true)
  })

  it('infers event type', () => {
    function Test(this: Interaction<KeyboardEvent>) {
      return []
    }
    let click = bind<MouseEvent>('click', (event) => {
      event
    })
    let descriptor = bind([Test, 'test'], (event) => {
      let E = typeof event
      //  ^?
      type T = Assert<Equal<E, KeyboardEvent>>
    })
  })
})

describe('events', () => {
  it('adds events', () => {
    let target = new EventTarget()
    let container = events(target)
    let mock = vi.fn()
    container.on([bind('test', mock)])
    target.dispatchEvent(new Event('test'))
    expect(mock).toHaveBeenCalled()
  })

  it('aborts the controller on reentry', () => {
    let target = new EventTarget()
    let container = events(target)
    let capturedSignals: AbortSignal[] = []
    container.on([
      bind('test', (_, signal) => {
        capturedSignals.push(signal)
      }),
    ])
    target.dispatchEvent(new Event('test'))
    expect(capturedSignals.length).toBe(1)
    expect(capturedSignals[0].aborted).toBe(false)

    target.dispatchEvent(new Event('test'))
    expect(capturedSignals.length).toBe(2)
    expect(capturedSignals[0].aborted).toBe(true)
    expect(capturedSignals[1].aborted).toBe(false)
  })

  it('removes listeners when the controller is aborted', () => {
    let target = new EventTarget()
    let controller = new AbortController()
    let container = events(target, controller.signal)

    let mock = vi.fn()
    container.on([bind('test', mock)])

    target.dispatchEvent(new Event('test'))
    expect(mock).toHaveBeenCalled()

    controller.abort()
    target.dispatchEvent(new Event('test'))
    expect(controller.signal.aborted).toBe(true)
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('aborts the reentry signal when the container is aborted', () => {
    let target = new EventTarget()
    let controller = new AbortController()
    let container = events(target, controller.signal)

    let capturedSignal: AbortSignal | undefined

    container.on([
      bind('test', (_, signal) => {
        capturedSignal = signal
      }),
    ])

    target.dispatchEvent(new Event('test'))
    invariant(capturedSignal)
    expect(capturedSignal.aborted).toBe(false)

    controller.abort()
    expect(capturedSignal.aborted).toBe(true)
  })

  // This tests current behavior but we should think about if we want to
  // complicate our implementation to automatically remove the event listener
  // when a binding signal is provided and the container signal is aborted. We
  // don't control the binding controller, so we'd have to track if a binding
  // signal was provided and then add an event the controller signal to remove
  // the binding event listener.
  it('defers to a bindings signal instead of the container signal', () => {
    let target = new EventTarget()
    let containerController = new AbortController()
    let container = events(target, containerController.signal)
    let bindingController = new AbortController()
    let mock = vi.fn()

    container.on([
      bind('test', mock, {
        signal: bindingController.signal,
      }),
    ])

    target.dispatchEvent(new Event('test'))
    expect(mock).toHaveBeenCalled()

    containerController.abort()
    target.dispatchEvent(new Event('test'))
    expect(mock).toHaveBeenCalledTimes(2)
    // Potential change in behavior would be this:
    // expect(mock).toHaveBeenCalledTimes(1)
  })
})

describe('Interactions', () => {
  it('adds host events and dispatches custom events', () => {
    function Test(this: Interaction) {
      return [
        bind('host-event', () => {
          this.dispatchEvent(new Event('custom-event'))
        }),
      ]
    }
    let target = new EventTarget()
    let container = events(target)
    let mock = vi.fn()
    container.on([bind([Test, 'custom-event'], mock)])
    target.dispatchEvent(new Event('host-event'))
    expect(mock).toHaveBeenCalled()
  })

  it('only adds host events once', () => {
    let capturedHostCalls = 0
    function Test(this: Interaction) {
      return [
        bind('host-event', () => {
          capturedHostCalls++
          this.dispatchEvent(new Event('custom-event'))
        }),
      ]
    }
    let target = new EventTarget()
    let container = events(target)
    let mock = vi.fn()

    let custom = createBinder(Test, 'custom-event')
    // bind it twice
    container.on([custom(mock), custom(mock)])

    target.dispatchEvent(new Event('host-event'))
    expect(mock).toHaveBeenCalledTimes(2)
    expect(capturedHostCalls).toBe(1)
  })

  describe('createBinder', () => {
    it('creates a binder function', () => {
      function Test(this: Interaction) {
        return [
          bind('host-event', () => {
            this.dispatchEvent(new Event('custom-event'))
          }),
        ]
      }
      let target = new EventTarget()
      let container = events(target)
      let mock = vi.fn()

      let custom = createBinder(Test, 'custom-event')
      container.on([custom(mock)])

      target.dispatchEvent(new Event('host-event'))
      expect(mock).toHaveBeenCalled()
    })

    it('infers interaction event types', () => {
      class TempoEvent extends Event {
        constructor(
          public type: 'tempo-change' | 'tempo-reset',
          public tempo: number,
        ) {
          super(type, { bubbles: false })
        }
      }

      function Tempo(this: Interaction<TempoEvent>) {
        return [
          bind('host-event', () => {
            this.dispatchEvent(new TempoEvent('tempo-change', 120))
          }),
        ]
      }

      let tempoChange = createBinder(Tempo, 'tempo-change')

      bind([Tempo, 'tempo-change'], (event) => {
        event // TempoEvent
      })

      tempoChange((event) => {
        event // TempoEvent
      })

      expect(true).toBe(true)
    })

    it('does not require literal types on events', () => {
      function Test(this: Interaction) {
        return []
      }
      let tempoChange = createBinder(Test, 'anything')
      expect(true).toBe(true)
    })
  })

  it('infers event generic', () => {
    function Test(this: Interaction<KeyboardEvent>) {
      return [
        bind('host-event', () => {
          // @ts-expect-error
          this.dispatchEvent(new Event('wrong'))
        }),
      ]
    }

    expect(true).toBe(true)
  })
})

type EventWithTarget<E extends Event, T extends EventTarget> = Omit<E, 'currentTarget'> & {
  currentTarget: T
}
