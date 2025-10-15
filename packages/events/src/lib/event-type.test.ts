import { describe, it, expect, vi } from 'vitest'
import { createEventType } from './event-type.ts'
import { events } from './events.ts'

describe('createEventType', () => {
  it('creates typed event descriptor and event creator', () => {
    type Detail = { value: number }
    let [change, createChange] = createEventType<Detail>('change')

    expect(typeof change).toBe('function')
    expect(typeof createChange).toBe('function')
  })

  it('creates properly configured CustomEvent', () => {
    type Detail = { index: number }
    let [, createChange] = createEventType<Detail>('change')

    let event = createChange({ detail: { index: 42 } })

    expect(event).toBeInstanceOf(CustomEvent)
    expect(event.type).toBe('change')
    expect(event.detail).toEqual({ index: 42 })
    expect(event.bubbles).toBe(true)
    expect(event.cancelable).toBe(true)
  })

  it('allows overriding CustomEvent options', () => {
    let [, createChange] = createEventType<{ test: boolean }>('change')

    let event = createChange({
      detail: { test: true },
      bubbles: false,
      cancelable: false,
    })

    expect(event.bubbles).toBe(false)
    expect(event.cancelable).toBe(false)
    expect(event.detail).toEqual({ test: true })
  })

  it('works with the events system', () => {
    type Detail = { message: string }
    let [change, createChange] = createEventType<Detail>('change')

    let target = new EventTarget()
    let handler = vi.fn()

    events(target, [change(handler)])

    let event = createChange({ detail: { message: 'hello' } })
    target.dispatchEvent(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'change',
        detail: { message: 'hello' },
      }),
      expect.any(AbortSignal),
    )
  })

  it('supports preventDefault chaining', () => {
    type Detail = { action: string }
    let [change, createChange] = createEventType<Detail>('change')

    let target = new EventTarget()
    let firstHandler = vi.fn((event: CustomEvent<Detail>) => {
      if (event.detail.action === 'prevent') {
        event.preventDefault()
      }
    })
    let secondHandler = vi.fn()

    events(target, [change(firstHandler), change(secondHandler)])

    // Test normal flow
    let allowedEvent = createChange({ detail: { action: 'allow' } })
    target.dispatchEvent(allowedEvent)

    expect(firstHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'allow' } }),
      expect.any(AbortSignal),
    )
    expect(secondHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'allow' } }),
      expect.any(AbortSignal),
    )

    firstHandler.mockClear()
    secondHandler.mockClear()

    // Test prevented flow
    let preventedEvent = createChange({ detail: { action: 'prevent' } })
    target.dispatchEvent(preventedEvent)

    expect(firstHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'prevent' } }),
      expect.any(AbortSignal),
    )
    expect(secondHandler).not.toHaveBeenCalled()
  })

  it('supports event listener options', () => {
    let [change] = createEventType('change')
    let target = new EventTarget()
    let handler = vi.fn()

    events(target, [change(handler, { once: true })])

    let event1 = new CustomEvent('change')
    let event2 = new CustomEvent('change')

    target.dispatchEvent(event1)
    target.dispatchEvent(event2)

    expect(handler).toHaveBeenCalledOnce()
  })

  it('works with DOM elements and bubbling', () => {
    type Detail = { clicked: boolean }
    let [click, createClick] = createEventType<Detail>('click')

    let parent = document.createElement('div')
    let child = document.createElement('button')
    parent.appendChild(child)

    let parentHandler = vi.fn()
    events(parent, [click(parentHandler)])

    let event = createClick({ detail: { clicked: true } })
    child.dispatchEvent(event)

    expect(parentHandler).toHaveBeenCalledOnce()
    let receivedEvent = parentHandler.mock.calls[0][0]
    expect(receivedEvent.detail).toEqual({ clicked: true })
    expect(receivedEvent.type).toBe('click')
    expect(receivedEvent.bubbles).toBe(true)
    expect(receivedEvent.cancelable).toBe(true)
  })

  it('does not require a detail', () => {
    let [, createChange] = createEventType('change')

    let event = createChange()

    expect(event.type).toBe('change')
    expect(event.detail).toBe(null)
  })

  it('requires a detail when detail type is provided', () => {
    let [, createChange] = createEventType<string>('change')

    // @ts-expect-error - detail is required
    let event = createChange()

    expect(event.type).toBe('change')
  })

  it('type checks prevent usage with wrong detail type', () => {
    // This test ensures TypeScript compilation would catch type errors
    type Detail = { count: number }
    let [, createChange] = createEventType<Detail>('change')

    // This should compile fine
    let validEvent = createChange({ detail: { count: 42 } })
    expect(validEvent.detail.count).toBe(42)

    // @ts-expect-error - wrong type
    createChange({ detail: { wrong: 'type' } }) // Type error
  })

  it('works with union types and switch statement type narrowing', () => {
    type ActionDetail = { type: 'action' }
    type ToggleDetail = { type: 'toggle'; checked: boolean }
    type SelectDetail = { type: 'select'; name: string; value: string }
    type DetailType = ActionDetail | ToggleDetail | SelectDetail

    let [, createEvent] = createEventType<DetailType>('menu-item')

    // This should compile and work - each union member should be acceptable
    let actionEvent = createEvent({ detail: { type: 'action' } })
    expect(actionEvent.detail).toEqual({ type: 'action' })

    let toggleEvent = createEvent({
      detail: { type: 'toggle', checked: true },
    })
    expect(toggleEvent.detail).toEqual({ type: 'toggle', checked: true })

    let selectEvent = createEvent({
      detail: { type: 'select', name: 'test', value: 'value' },
    })
    expect(selectEvent.detail).toEqual({
      type: 'select',
      name: 'test',
      value: 'value',
    })
  })
})
