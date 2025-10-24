import type { Assert, Equal } from '../test/utils.ts'
import {
  type EventWithTarget,
  type Interaction,
  TypedEventTarget,
  bind,
  createBinder,
  events,
} from './events2.ts'

import { describe, it, expect, vi } from 'vitest'

describe('types', () => {
  it('provides target and event on dispatched events', () => {
    let target = document.createElement('button')
    events(target).on(
      bind('keydown', (event) => {
        let target = event.currentTarget
        let key = event.key
        type T2 = Assert<Equal<typeof event, EventWithTarget<KeyboardEvent, HTMLButtonElement>>>
      }),
    )
  })

  it('provides types to multiple event bindings', () => {
    let target = document.createElement('button')
    events(target).on([
      bind('click', (event) => {
        type T2 = Assert<Equal<typeof event, EventWithTarget<PointerEvent, HTMLButtonElement>>>
      }),
      bind('keydown', (event) => {
        type T2 = Assert<Equal<typeof event, EventWithTarget<KeyboardEvent, HTMLButtonElement>>>
      }),
    ])
  })

  it('provides target and event on dispatched interaction events', () => {
    class TempoEvent extends Event {
      type: 'tempo-change' | 'tempo-reset'
      tempo: number
      constructor(type: TempoEvent['type'], tempo: TempoEvent['tempo']) {
        super(type, { bubbles: false })
        this.type = type
        this.tempo = tempo
      }
    }

    function Tempo(this: Interaction<TempoEvent>) {
      return [
        bind('host-event', () => {
          // correct
          this.dispatchEvent(new TempoEvent('tempo-change', 120))
          // @ts-expect-error - wrong event class
          this.dispatchEvent(new Event('wrong'))
          // @ts-expect-error - wrong event type
          this.dispatchEvent(new TempoEvent('wrong', 120))
        }),
      ]
    }

    let target = document.createElement('div')
    events(target).on([
      bind([Tempo, 'tempo-change'], (event) => {
        let target = event.currentTarget
        let tempo = event.tempo
        type T2 = Assert<Equal<typeof event, EventWithTarget<TempoEvent, HTMLDivElement>>>
      }),
      // @ts-expect-error - wrong event name
      bind([Tempo, 'wrong'], () => {}),
    ])
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
    expect(capturedSignal!.aborted).toBe(false)

    controller.abort()
    expect(capturedSignal!.aborted).toBe(true)
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
  it.todo('proxies stopPropagation and preventDefault to child events')

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
        type: 'tempo-change' | 'tempo-reset'
        tempo: number
        constructor(type: TempoEvent['type'], tempo: TempoEvent['tempo']) {
          super(type, { bubbles: false })
          this.type = type
          this.tempo = tempo
        }
      }

      function Tempo(this: Interaction<TempoEvent>) {
        return [
          bind('host-event', () => {
            this.dispatchEvent(new TempoEvent('tempo-change', 120))
          }),
        ]
      }

      let right = createBinder(Tempo, 'tempo-change')
      // @ts-expect-error - wrong event name
      let wrong = createBinder(Tempo, 'wrong')

      expect(true).toBe(true)
    })

    it('does not require literal types on events', () => {
      function Test(this: Interaction) {
        return []
      }
      // this shouldn't be a type error
      let tempoChange = createBinder(Test, 'anything')
      expect(true).toBe(true)
    })
  })
})

describe('reconciliation', () => {
  it('replaces handlers inline without remove/add event listeners', () => {
    let target = new EventTarget()
    let container = events(target)
    let mock = vi.fn()
    container.on([bind('test', mock)])
    target.dispatchEvent(new Event('test'))
    expect(mock).toHaveBeenCalled()

    let mock2 = vi.fn()
    container.on([bind('test', mock2)])
    target.dispatchEvent(new Event('test'))
    expect(mock2).toHaveBeenCalled()
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('replaces handlers when types change', () => {
    let target = new EventTarget()
    let addEventListenerSpy = vi.spyOn(target, 'addEventListener')
    let container = events(target)

    let removedMock = vi.fn()
    let addedMock = vi.fn()

    container.on([bind('test', removedMock)])
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1)

    container.on([bind('test-2', addedMock)])

    // should remove the listener
    target.dispatchEvent(new Event('test'))
    expect(removedMock).toHaveBeenCalledTimes(0)
    target.dispatchEvent(new Event('test-2'))
    expect(addedMock).toHaveBeenCalledTimes(1)
  })
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

  // todo: I think this is an implementation detail? not sure if we want to test
  // it('infers event map from the typed event target subclass', () => {
  //   type T = EventsFor<Drummer>
  //   type T2 = Assert<Equal<T, DrummerEventMap>>
  //   expect(true).toBe(true)
  // })

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
    expect(true).toBe(true)
  })
})

// vvvvvv Random other stuff Pedro was testing with vvvvv

declare const target: HTMLButtonElement
events(target).on({
  type: 'click',
  listener: (event) => {
    event.altKey
    event.currentTarget
    type t1 = Assert<Equal<typeof event, EventWithTarget<PointerEvent, typeof target>>>
    type t2 = Assert<Equal<typeof event.currentTarget, typeof target>>
  },
})

events(target).on(
  bind('click', (event) => {
    event.altKey
    event.currentTarget
    type t1 = Assert<Equal<typeof event, EventWithTarget<PointerEvent, typeof target>>>
    type t2 = Assert<Equal<typeof event.currentTarget, typeof target>>
  }),
)

// @ts-expect-error
events(target).on('nope')

events(target).on([
  bind('click', (event) => {
    event.movementX
    // @ts-expect-error - `key` isn't on `PointerEvent`
    event.key

    event.currentTarget
    type t1 = Assert<Equal<typeof event, EventWithTarget<PointerEvent, typeof target>>>
    type t2 = Assert<Equal<typeof event.currentTarget, typeof target>>
  }),
  bind('keydown', (event) => {
    event.key
    // @ts-expect-error - `movementX` isn't on `KeyboardEvent`
    event.movementX

    event.currentTarget
    type t1 = Assert<Equal<typeof event, EventWithTarget<KeyboardEvent, typeof target>>>
    type t2 = Assert<Equal<typeof event.currentTarget, typeof target>>
  }),
])

// === TypedEventTarget ============================================================================

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
let drummer = new Drummer()
drummer.addEventListener('kick', (event) => {
  type T = Assert<Equal<typeof event, DrummerEvent>>
})

drummer.addEventListener('not-in-the-map', (event) => {
  type T = Assert<Equal<typeof event, Event>>
})

// === Interactions ================================================================================

class TempoEvent extends Event {
  type: 'tempo-change' | 'tempo-reset'
  tempo: number
  constructor(type: TempoEvent['type'], tempo: TempoEvent['tempo']) {
    super(type, { bubbles: false })
    this.type = type
    this.tempo = tempo
  }
}

function Tempo(this: Interaction<TempoEvent>) {
  return [
    bind('host-event', () => {
      // correct
      this.dispatchEvent(new TempoEvent('tempo-change', 120))
      // @ts-expect-error - wrong event class
      this.dispatchEvent(new Event('wrong'))
      // @ts-expect-error - wrong event type
      this.dispatchEvent(new TempoEvent('wrong', 120))
    }),
  ]
}

events(target).on([
  bind('click', (event) => {}),
  bind([Tempo, 'tempo-change'], (event) => {
    let target = event.currentTarget
    let tempo = event.tempo
    type T2 = Assert<Equal<typeof event, EventWithTarget<TempoEvent, HTMLButtonElement>>>
  }),
  // @ts-expect-error - wrong event name
  bind([Tempo, 'wrong'], () => {}),
])
