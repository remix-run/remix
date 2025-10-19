import { describe, it, expect } from 'vitest'

import { dom, xhr, win, doc, ws } from './proxies.ts'
import { events } from './events.ts'
import type { EventWithTargets } from './events.ts'
import type { Assert, Equal } from '../test/utils.ts'

describe('dom', () => {
  // couple of smoke tests to make sure event.target, event.currentTarget, and
  // the event generally are correct. If both click and keydown are correct then
  // the rest should be correct too because it's all just mapping over the
  // lib.dom.ts types.
  it('provides correct types for click events', () => {
    dom.click((event) => {
      type Expected = EventWithTargets<MouseEvent, HTMLElement, EventTarget>
      type T = Assert<Equal<typeof event, Expected>>
      type T2 = Assert<Equal<typeof event.button, number>>
      // @ts-expect-error
      event.key
    })
  })

  it('provides correct types for keydown events', () => {
    dom.keydown((event) => {
      type Expected = EventWithTargets<KeyboardEvent, HTMLElement, EventTarget>
      type T = Assert<Equal<typeof event, Expected>>
      type T2 = Assert<Equal<typeof event.key, string>>
      // @ts-expect-error
      event.button
    })
  })

  it('creates an event definition using dom() function', () => {
    let handler = (event: Event) => {}
    let eventDef = dom('click', handler)

    expect(eventDef.type).toBe('click')
    expect(eventDef.handler).toBe(handler)
  })

  it('supports function call syntax', () => {
    let handler = (event: Event) => {}
    let eventDef = dom('click', handler)

    expect(eventDef.type).toBe('click')
    expect(eventDef.handler).toBe(handler)
    expect(eventDef.isCustom).toBeUndefined()
  })

  it('supports property access syntax', () => {
    let handler = (event: Event) => {}
    let eventDef = dom.click(handler)

    expect(eventDef.type).toBe('click')
    expect(eventDef.handler).toBe(handler)
    expect(eventDef.isCustom).toBeUndefined()
  })

  it('supports all standard DOM event names', () => {
    let handler = (event: Event) => {}

    expect(dom.mousedown(handler).type).toBe('mousedown')
    expect(dom.mouseup(handler).type).toBe('mouseup')
    expect(dom.mousemove(handler).type).toBe('mousemove')
    expect(dom.dragstart(handler).type).toBe('dragstart')
    expect(dom.dragend(handler).type).toBe('dragend')
    expect(dom.keydown(handler).type).toBe('keydown')
    expect(dom.keyup(handler).type).toBe('keyup')
  })

  it('supports custom event names', () => {
    let handler = (event: Event) => {}
    let eventDef = dom('custom-event', handler)

    expect(eventDef.type).toBe('custom-event')
    expect(eventDef.handler).toBe(handler)
  })

  it('supports kebab-case event names', () => {
    let handler = (event: Event) => {}
    let eventDef = dom('some-custom-event', handler)

    expect(eventDef.type).toBe('some-custom-event')
    expect(eventDef.handler).toBe(handler)
  })

  it('works with generic event types', () => {
    let clickHandler = (event: MouseEvent) => {
      expect(event).toBeInstanceOf(Event)
    }

    let eventDef = dom.click(clickHandler)
    expect(eventDef.type).toBe('click')
    expect(eventDef.handler).toBe(clickHandler)
  })

  it('supports generic types in function call syntax', () => {
    let customHandler = (event: CustomEvent<{ value: string }>) => {
      expect(event).toBeInstanceOf(Event)
    }

    let eventDef = dom<CustomEvent<{ value: string }>>('custom', customHandler)
    expect(eventDef.type).toBe('custom')
    expect(eventDef.handler).toBe(customHandler)
  })

  it('handles click events correctly', () => {
    let element = document.createElement('button')
    let called = false

    let cleanup = events(element, [
      dom.click(() => {
        called = true
      }),
    ])

    element.click()

    expect(called).toBe(true)

    cleanup()
  })

  it('handles load events correctly', () => {
    let img = document.createElement('img')
    let called = false

    let cleanup = events(img, [
      dom.load(() => {
        called = true
      }),
    ])

    img.dispatchEvent(new Event('load'))

    expect(called).toBe(true)

    cleanup()
  })

  it('handles error events correctly', () => {
    let img = document.createElement('img')
    let called = false

    let cleanup = events(img, [
      dom.error(() => {
        called = true
      }),
    ])

    img.dispatchEvent(new ErrorEvent('error'))

    expect(called).toBe(true)

    cleanup()
  })

  it('provides proper types for all helper methods', () => {
    let clickEvent = dom.click((event: MouseEvent) => {
      expect(event).toBeInstanceOf(Event)
    })

    let loadEvent = dom.load((event: Event) => {
      expect(event).toBeInstanceOf(Event)
    })

    let errorEvent = dom.error((event: Event) => {
      expect(event).toBeInstanceOf(Event)
    })

    expect(clickEvent.type).toBe('click')
    expect(loadEvent.type).toBe('load')
    expect(errorEvent.type).toBe('error')
  })

  it('provides HTMLElement-specific event properties', () => {
    let button = document.createElement('button')

    let cleanup = events(button, [
      dom('click', (event) => {
        expect(event.clientX).toBeDefined()
        expect(event.button).toBeDefined()
      }),

      dom.click((event) => {
        expect(event.clientX).toBeDefined()
      }),
    ])

    cleanup()
  })

  it('supports event listener options (capture, passive, once)', () => {
    let element = document.createElement('button')
    let clickCalled = false
    let scrollCalled = false
    let loadCalled = false

    let cleanup = events(element, [
      dom.click(
        () => {
          clickCalled = true
        },
        { capture: true },
      ),
      dom.scroll(
        () => {
          scrollCalled = true
        },
        { passive: true },
      ),
      dom.load(
        () => {
          loadCalled = true
        },
        { once: true },
      ),
    ])

    element.click()
    expect(clickCalled).toBe(true)

    element.dispatchEvent(new Event('scroll'))
    expect(scrollCalled).toBe(true)

    element.dispatchEvent(new Event('load'))
    expect(loadCalled).toBe(true)

    loadCalled = false
    element.dispatchEvent(new Event('load'))
    expect(loadCalled).toBe(false)

    cleanup()
  })

  it('captures events during the capture phase', () => {
    let container = document.createElement('div')
    let img = document.createElement('img')
    container.appendChild(img)

    let loadCalled = false

    let cleanup = events(container, [
      dom.load(
        () => {
          loadCalled = true
        },
        { capture: true },
      ),
    ])

    img.dispatchEvent(new Event('load', { bubbles: true }))
    expect(loadCalled).toBe(true)

    cleanup()
  })
})

describe('xhr', () => {
  it('provides correct types for XMLHttpRequest events', () => {
    let mockXhr = new EventTarget() as any as XMLHttpRequest

    let cleanup = events(mockXhr, [
      xhr('load', (event) => {
        expect(event.loaded).toBeDefined()
        expect(event.total).toBeDefined()
      }),

      xhr.progress((event) => {
        expect(event.loaded).toBeDefined()
      }),
    ])

    cleanup()
  })
})

describe('win', () => {
  it('provides correct types for Window events', () => {
    let mockWindow = new EventTarget() as any as Window

    let cleanup = events(mockWindow, [
      win('resize', (event) => {
        expect(event.view).toBeDefined()
      }),

      win.beforeunload((event) => {
        expect(event.returnValue).toBeDefined()
      }),
    ])

    cleanup()
  })
})

describe('doc', () => {
  it('provides correct types for Document events', () => {
    let mockDoc = new EventTarget() as any as Document

    let cleanup = events(mockDoc, [
      doc('DOMContentLoaded', (event) => {
        expect(event.type).toBe('DOMContentLoaded')
      }),

      doc.readystatechange((event) => {
        expect(event.type).toBe('readystatechange')
      }),
    ])

    cleanup()
  })
})

describe('ws', () => {
  it('provides correct types for WebSocket events', () => {
    let mockWs = new EventTarget() as any as WebSocket

    let cleanup = events(mockWs, [
      ws('message', (event) => {
        expect(event.data).toBeDefined()
      }),

      ws.close((event) => {
        expect(event.code).toBeDefined()
        expect(event.reason).toBeDefined()
      }),
    ])

    cleanup()
  })
})
