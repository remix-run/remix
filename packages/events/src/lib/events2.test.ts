import { describe, it, expect, vi } from 'vitest'
import { bind, events, type EventDescriptor } from './events2.ts'
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
})
