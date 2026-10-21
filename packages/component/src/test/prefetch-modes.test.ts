import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { startPrefetching } from '../runtime/prefetch.ts'

function startTestPrefetching(t: TestContext) {
  let prefetchFrame = mock.fn()
  let controller = new AbortController()
  startPrefetching(controller.signal, prefetchFrame)
  t.after(() => controller.abort())
  return { prefetchFrame, controller }
}

function createLink(href: string, mode: 'render' | 'viewport') {
  let anchor = document.createElement('a')
  anchor.href = href
  anchor.setAttribute('data-rmx-prefetch', mode)
  anchor.textContent = 'Product'
  anchor.style.cssText = 'position: fixed; top: 0; left: 0; width: 100px; height: 20px'
  return anchor
}

function nextIntersection(anchor: HTMLAnchorElement): Promise<void> {
  return new Promise((resolve) => {
    let observer = new IntersectionObserver(() => {
      observer.disconnect()
      // Other observers can be notified after this one in the same task.
      setTimeout(resolve, 0)
    })
    observer.observe(anchor)
  })
}

describe('render and viewport prefetching', () => {
  beforeEach(() => {
    // The browser harness places each file's iframe below previously reported results.
    window.frameElement?.scrollIntoView({ block: 'start' })
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('prefetches existing render links at startup, including hidden links', (t) => {
    let anchor = createLink('/products/render', 'render')
    anchor.hidden = true
    document.body.append(anchor)

    let { prefetchFrame } = startTestPrefetching(t)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('discovers render links in newly inserted subtrees without activating templates', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let section = document.createElement('section')
    let anchor = createLink('/products/inserted', 'render')
    let template = document.createElement('template')
    template.content.append(createLink('/products/inert', 'render'))
    section.append(anchor, template)
    document.body.append(section)
    await Promise.resolve()

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('prefetches again when a render link changes destination, without repeating unrelated changes', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/first', 'render')
    document.body.append(anchor)
    await Promise.resolve()
    anchor.append(document.createElement('span'))
    anchor.target = '_self'
    await Promise.resolve()
    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    anchor.href = '/products/second'
    await Promise.resolve()

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('handles prefetch mode changes and href removal and restoration', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/changed', 'render')
    anchor.removeAttribute('data-rmx-prefetch')
    document.body.append(anchor)
    await Promise.resolve()
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.setAttribute('data-rmx-prefetch', 'render')
    await Promise.resolve()
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    anchor.removeAttribute('href')
    await Promise.resolve()
    anchor.href = '/products/restored'
    await Promise.resolve()
    expect(prefetchFrame).toHaveBeenCalledTimes(2)

    anchor.setAttribute('data-rmx-prefetch', 'viewport')
    await nextIntersection(anchor)
    expect(prefetchFrame).toHaveBeenCalledTimes(3)
  })

  it('preserves completed render work when a link moves within the document', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/moved', 'render')
    let section = document.createElement('section')
    document.body.append(anchor, section)
    await Promise.resolve()
    section.append(anchor)
    await Promise.resolve()

    expect(prefetchFrame).toHaveBeenCalledTimes(1)

    section.remove()
    await Promise.resolve()
    document.body.append(section)
    await Promise.resolve()
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
  })

  it('prefetches existing viewport links without requiring a scroll', async (t) => {
    let anchor = createLink('/products/visible', 'viewport')
    document.body.append(anchor)
    let { prefetchFrame } = startTestPrefetching(t)

    await nextIntersection(anchor)

    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('waits for viewport entry and does not repeat when a link leaves and returns', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/viewport', 'viewport')
    anchor.style.top = '200vh'
    document.body.append(anchor)
    await nextIntersection(anchor)
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.style.top = '0'
    await nextIntersection(anchor)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)

    anchor.style.top = '200vh'
    await nextIntersection(anchor)
    anchor.style.top = '0'
    await nextIntersection(anchor)
    expect(prefetchFrame).toHaveBeenCalledTimes(1)
  })

  it('observes a new destination on an already visible viewport link', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/first', 'viewport')
    document.body.append(anchor)
    await nextIntersection(anchor)
    anchor.href = '/products/second'
    await nextIntersection(anchor)

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
  })

  it('stops watching removed viewport links and links whose mode changes', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/removed', 'viewport')
    anchor.style.top = '200vh'
    document.body.append(anchor)
    await nextIntersection(anchor)
    anchor.remove()
    await Promise.resolve()
    anchor.style.top = '0'
    await nextIntersection(anchor)
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.setAttribute('data-rmx-prefetch', 'intent')
    document.body.append(anchor)
    await nextIntersection(anchor)
    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('applies navigation eligibility checks and reacts when an opt-out is removed', async (t) => {
    let { prefetchFrame } = startTestPrefetching(t)
    let anchor = createLink('/products/download', 'render')
    anchor.download = ''
    let crossOrigin = createLink('https://example.com/product', 'render')
    let current = createLink(location.href, 'render')
    let named = createLink('/products/named', 'viewport')
    named.setAttribute('data-rmx-target', 'details')
    let documentLink = createLink('/products/document', 'render')
    documentLink.setAttribute('data-rmx-document', '')
    let newTab = createLink('/products/new-tab', 'viewport')
    newTab.target = '_blank'
    document.body.append(anchor, crossOrigin, current, named, documentLink, newTab)
    await nextIntersection(named)
    expect(prefetchFrame).not.toHaveBeenCalled()

    anchor.removeAttribute('download')
    named.removeAttribute('data-rmx-target')
    await nextIntersection(named)
    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(anchor.href)
    expect(prefetchFrame).toHaveBeenCalledWith(named.href)
  })

  it('disposes both observers before pending mutations or viewport entries can trigger', async (t) => {
    let { prefetchFrame, controller } = startTestPrefetching(t)
    let render = createLink('/products/render', 'render')
    let viewport = createLink('/products/viewport', 'viewport')
    document.body.append(render, viewport)
    controller.abort()
    await nextIntersection(viewport)
    document.body.append(createLink('/products/later', 'render'))
    await Promise.resolve()

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('does not start discovery with an already aborted signal', async () => {
    let prefetchFrame = mock.fn()
    let anchor = createLink('/products/aborted', 'render')
    document.body.append(anchor)

    startPrefetching(AbortSignal.abort(), prefetchFrame)
    await Promise.resolve()

    expect(prefetchFrame).not.toHaveBeenCalled()
  })

  it('keeps render and intent modes working without IntersectionObserver', async (t) => {
    let descriptor = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver')
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: undefined,
    })
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, 'IntersectionObserver', descriptor)
    })
    let { prefetchFrame } = startTestPrefetching(t)
    let render = createLink('/products/render', 'render')
    let viewport = createLink('/products/viewport', 'viewport')
    let intent = createLink('/products/intent', 'render')
    intent.setAttribute('data-rmx-prefetch', 'intent')
    document.body.append(render, viewport, intent)
    await Promise.resolve()

    intent.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }),
    )

    expect(prefetchFrame).toHaveBeenCalledTimes(2)
    expect(prefetchFrame).toHaveBeenCalledWith(render.href)
    expect(prefetchFrame).toHaveBeenCalledWith(intent.href)
  })
})
