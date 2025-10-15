import { describe, it, expect } from 'vitest'

import { events } from '../lib/events.ts'
import { escape } from './key.ts'

describe('key interactions', () => {
  it('escape custom event works', () => {
    let element = document.createElement('div')
    let called = false

    let cleanup = events(element, [
      escape(() => {
        called = true
      }),
    ])

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(called).toBe(true)

    cleanup()
  })

  it.skip('outerClick custom event works', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')
    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let called = false

    let cleanup = events(element, [
      // outerClick not implemented yet
    ])

    // Click on the outside element (not the target element)
    outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(called).toBe(true)

    cleanup()
  })
})
