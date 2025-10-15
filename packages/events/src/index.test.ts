import { describe, it, expect } from 'vitest'

import { events, dom } from './index.ts'

describe('events', () => {
  it('basic usage', () => {
    let element = document.createElement('div')

    let clicked = false

    let cleanup = events(element, [
      dom.click(() => {
        clicked = !clicked
      }),
    ])

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(clicked).toBe(true)
    cleanup()
  })

  it('prevent default', () => {
    let element = document.createElement('button')
    let count = 0
    events(element, [
      dom.click((event) => {
        event.preventDefault()
        count++
      }),
      dom.click(() => {
        count++
      }),
    ])

    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(count).toBe(1)
  })

  it('target type inference with different elements', () => {
    let element = document.createElement('div')
    let clicked = false

    let cleanup = events(element, [
      dom.click((event) => {
        // Basic functionality test - can access currentTarget and event properties
        expect(event.currentTarget).toBe(element)
        expect(typeof event.clientX).toBe('number')
        clicked = true
      }),
    ])

    element.click()
    expect(clicked).toBe(true)
    cleanup()
  })

  it('event type inference', () => {
    let element = document.createElement('input')
    let eventList: string[] = []

    let cleanup = events(element, [
      dom.click((event) => {
        eventList.push('click')
        expect(typeof event.clientX).toBe('number') // MouseEvent property
      }),
      dom.input((event) => {
        eventList.push('input')
        expect(typeof event.type).toBe('string') // Basic Event property
      }),
      dom.keydown((event) => {
        eventList.push('keydown')
        expect(typeof event.key).toBe('string') // KeyboardEvent property
      }),
    ])

    element.click()
    element.dispatchEvent(new Event('input'))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(eventList).toEqual(['click', 'input', 'keydown'])
    cleanup()
  })

  it('event type inference for all DOM event maps', () => {
    let element = document.createElement('input')
    let eventList: string[] = []

    // Test various DOM events work correctly
    let cleanup = events(element, [
      dom.click(() => eventList.push('click')),
      dom.focus(() => eventList.push('focus')),
      dom('mouseenter', () => eventList.push('mouseenter')),
    ])

    element.click()
    element.dispatchEvent(new FocusEvent('focus'))
    element.dispatchEvent(new MouseEvent('mouseenter'))

    expect(eventList).toEqual(['click', 'focus', 'mouseenter'])
    cleanup()
  })

  it('events() function works correctly', () => {
    let element = document.createElement('button')
    let called = false

    let container = events(element)
    container.on([
      dom.click(() => {
        called = true
      }),
    ])

    element.click()
    expect(called).toBe(true)

    container.cleanup()
  })
})
