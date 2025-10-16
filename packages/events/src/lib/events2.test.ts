import { describe, it, expect, vi } from 'vitest'
import { bind, events, type EventDescriptor, type Interaction } from './events2.ts'
import type { Assert, Equal } from '../test/utils.ts'
import { invariant } from './invariant.ts'

describe('EventDescriptor type', () => {
  it('adds generic to event.currentTarget', () => {
    type D1 = EventDescriptor<HTMLElement>
    type Target = Parameters<D1['listener']>[0]['currentTarget']
    type T2 = Assert<Equal<Target, HTMLElement>>
    expect(true).toBe(true)
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
  // it('adds host events and dispatches custom events', () => {
  //   function Test(this: Interaction) {
  //     return [
  //       bind('host-event', () => {
  //         this.dispatchEvent()
  //       }),
  //     ]
  //   }
  //   let target = new EventTarget()
  //   let container = events(target)
  //   let mock = vi.fn()
  //   container.on([bind(Test, mock)])
  //   target.dispatchEvent(new Event('host-event'))
  //   expect(mock).toHaveBeenCalled()
  // })
  // it('uses interaction eventName', () => {
  //   let capturedType: string | undefined
  //   function Test(this: InteractionHandle) {
  //     capturedType = this.type
  //     return [
  //       bind('host-event', () => {
  //         this.dispatch()
  //       }),
  //     ]
  //   }
  //   Test.eventType = 'interaction-event-name'
  //   let target = new EventTarget()
  //   let container = events(target)
  //   let mock = vi.fn()
  //   container.on([bind(Test, mock)])
  //   expect(capturedType).toBe(Test.eventType)
  // })
  // it('has typesafe detail on dispatch', () => {
  //   function Test(this: InteractionHandle<number>) {
  //     return [
  //       bind('', () => {
  //         // @ts-expect-error
  //         this.dispatch({ detail: 'wrong' })
  //       }),
  //     ]
  //   }
  //   expect(true).toBe(true)
  // })
  // it('dispatches with custom event init', () => {
  //   const DETAIL_VALUE = 1
  //   function Test(this: InteractionHandle<number>) {
  //     return [
  //       bind('host-event', () => {
  //         this.dispatch({ detail: DETAIL_VALUE })
  //       }),
  //     ]
  //   }
  //   let target = new EventTarget()
  //   let container = events(target)
  //   let capturedDetail
  //   container.on([
  //     bind(Test, (event) => {
  //       capturedDetail = event.detail
  //     }),
  //   ])
  //   target.dispatchEvent(new Event('host-event'))
  //   expect(capturedDetail).toBe(DETAIL_VALUE)
  // })
  // it('enforces event type generic', () => {
  //   class TestEvent extends Event {
  //     val: string
  //     constructor(name: string, val: string) {
  //       super(name)
  //       this.val = val
  //     }
  //   }
  //   function Test(this: InteractionHandle<'test', TestEvent>) {
  //     return [
  //       bind('host-event', () => {
  //         // @ts-expect-error
  //         this.dispatch(new Event('test'))
  //       }),
  //     ]
  //   }
  //   expect(true).toBe(true)
  // })
})

// class TempoEvent extends Event {
//   constructor(
//     public type: 'tempo-change' | 'tempo-reset',
//     public tempo: number,
//   ) {
//     super(type, { bubbles: false })
//   }
// }

// type InferEventType<E extends Event> = E extends { type: infer Type } ? Type : never

// type Test = InferEventType<TempoEvent>
// //    ^?

// const e = new TempoEvent('tempo-change', 120)
// e.type
// ^?
