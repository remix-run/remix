import { expect } from '@remix-run/assert'
import { describe, it, mock, type TestContext } from '@remix-run/test'
import { navigate, startNavigationListener } from '../runtime/navigation.ts'
import type { FrameContent, FrameHandle, Handle } from '../runtime/component.ts'
import { waitForDom, withResolvers } from './utils.ts'
import { Frame } from '../runtime/frame.ts'
import { run } from '../runtime/run.ts'
import { jsx } from '../runtime/core/vnode.ts'

describe('traversal scroll', () => {
  function setup(t: TestContext) {
    let originalUrl = window.location.href
    let initialEntryKey = window.navigation.currentEntry?.key
    let listUrl = new URL('/scroll-list', originalUrl).href
    let detailUrl = new URL('/scroll-detail', originalUrl).href
    window.history.replaceState(null, '', listUrl)

    let page = document.createElement('div')
    page.style.height = '5000px'
    document.body.append(page)

    let nextLoad: (signal: AbortSignal) => Promise<void> = () => Promise.resolve()
    let topFrame = { src: listUrl } as FrameHandle
    let controller = new AbortController()
    startNavigationListener(controller.signal, {
      top: topFrame,
      get: () => topFrame,
      reloadFrame(_frame, options) {
        let signal = options?.signal ?? controller.signal
        let loaded = nextLoad(signal)
        nextLoad = () => Promise.resolve()
        return { signal, committed: loaded, finished: loaded.then(() => ({ signal })) }
      },
    })

    t.after(async () => {
      nextLoad = () => Promise.resolve()
      if (initialEntryKey && window.navigation.currentEntry?.key !== initialEntryKey) {
        await window.navigation.traverseTo(initialEntryKey).finished
      }
      controller.abort()
      window.history.replaceState(null, '', originalUrl)
      window.history.scrollRestoration = 'auto'
      page.remove()
      window.scrollTo(0, 0)
    })

    return {
      listUrl,
      detailUrl,
      // The next page load starts once its navigation has, and waits until it's released.
      holdNextLoad() {
        let [started, start] = withResolvers<void>()
        let [released, release] = withResolvers<void>()
        nextLoad = (signal) => {
          start()
          signal.addEventListener('abort', () => release(), { once: true })
          return released
        }
        return { started, release: () => release() }
      },
      // The browser's restoration on the next traversal leaves the window at `top`.
      restoreNextTraversalTo(top: number) {
        window.navigation.addEventListener(
          'navigate',
          (event) => {
            let scroll = event.scroll.bind(event)
            Object.defineProperty(event, 'scroll', {
              value() {
                scroll()
                window.scrollTo({ top, behavior: 'instant' })
              },
            })
          },
          { once: true, signal: controller.signal },
        )
      },
    }
  }

  it('returns the window to where the visitor left a page when the browser restores another position', async (t) => {
    let page = setup(t)
    window.scrollTo(0, 800)
    await navigate(page.detailUrl)
    window.scrollTo(0, 300)
    // WebKit restores the position of the page being left after a slow traversal.
    page.restoreNextTraversalTo(300)

    await window.navigation.back().finished

    expect(window.scrollY).toBe(800)
  })

  it('returns the window to where the visitor left a page with a fragment', async (t) => {
    let page = setup(t)
    await navigate(`${page.listUrl}#reviews`)
    window.scrollTo(0, 800)
    await navigate(page.detailUrl)
    page.restoreNextTraversalTo(0)

    await window.navigation.back().finished

    expect(window.location.hash).toBe('#reviews')
    expect(window.scrollY).toBe(800)
  })

  it('keeps the saved position of a page whose traversal is interrupted before rendering', async (t) => {
    let page = setup(t)
    window.scrollTo(0, 800)
    await navigate(page.detailUrl)
    window.scrollTo(0, 300)
    await navigate(new URL('/scroll-third', page.listUrl).href)
    window.scrollTo(0, 100)

    let load = page.holdNextLoad()
    window.history.back()
    await load.started
    let completed = waitForNavigationSuccess()
    window.history.back()
    await completed
    expect(window.scrollY).toBe(800)

    await window.navigation.forward().finished

    expect(window.scrollY).toBe(300)
  })

  it('leaves the window alone once the visitor scrolls during a traversal', async (t) => {
    let page = setup(t)
    window.scrollTo(0, 800)
    await navigate(page.detailUrl)
    // Off the top, where WebKit's scroll resynchronization after the push would scroll again.
    window.scrollTo(0, 300)

    let load = page.holdNextLoad()
    let back = window.navigation.back().finished
    await load.started
    window.dispatchEvent(new WheelEvent('wheel'))
    let scrollTo = t.mock.method(window, 'scrollTo')
    load.release()
    await back

    expect(scrollTo).not.toHaveBeenCalled()
  })

  async function setupReloadingPage(t: TestContext, frameCreation: 'server' | 'client' = 'server') {
    let originalUrl = window.location.href
    let initialEntryKey = getCurrentNavigationEntry().key
    let listUrl = new URL('/scroll-list', originalUrl).href
    let detailUrl = new URL('/scroll-detail', originalUrl).href
    let nextLoad: ((signal: AbortSignal) => Promise<void>) | undefined
    let nextContent: FrameContent | undefined
    function outerHtml(title: string) {
      return `<!-- rmx:f:content --><span>${title}</span><!-- /rmx:f --><script type="application/json" id="rmx-data">{"f":{"content":{"status":"resolved","name":"content","src":"/scroll-fragment"}}}</script>`
    }
    function pageHtml(title: string) {
      return `<html><head></head><body><main style="height: 5000px"><!-- rmx:f:outer -->${outerHtml(title)}<!-- /rmx:f --></main><aside><!-- rmx:f:sidebar --><!-- /rmx:f --></aside><script type="application/json" id="rmx-data">{"f":{"outer":{"status":"resolved","name":"outer","src":"/scroll-outer"},"sidebar":{"status":"resolved","name":"sidebar","src":"/scroll-sidebar"}}}</script></body></html>`
    }
    document.documentElement.innerHTML =
      frameCreation === 'server' ? pageHtml('List') : '<head></head><body></body>'
    let app = run({
      loadModule: mock.fn(),
      async resolveFrame(src, options) {
        let content = nextContent
        nextContent = undefined
        let load = nextLoad
        nextLoad = undefined
        if (load) {
          let signal = options?.signal
          if (!signal) throw new Error('Expected a reload abort signal')
          await load(signal)
        }
        if (content !== undefined) return content
        if (options?.target === 'sidebar') return ''
        let title = src === detailUrl ? 'Detail' : 'List'
        if (options?.target === 'outer') {
          return frameCreation === 'server'
            ? outerHtml(title)
            : [jsx(Frame, { name: 'content', src: '/scroll-fragment' })]
        }
        return options?.target ? `<span>${title}</span>` : pageHtml(title)
      },
    })
    t.after(async () => {
      nextLoad = undefined
      if (getCurrentNavigationEntry().key !== initialEntryKey) {
        await window.navigation.traverseTo(initialEntryKey).finished
      }
      app.dispose()
      document.body.textContent = ''
      window.scrollTo(0, 0)
    })
    await app.ready()
    if (frameCreation === 'client') {
      await app.frames.top.replace(
        jsx('main', {
          style: { height: '5000px' },
          children: jsx(Frame, { name: 'outer', src: '/scroll-outer' }),
        }),
      )
      await waitForDom(() => document.querySelector('main')?.textContent === 'List')
    }
    return {
      app,
      listUrl,
      detailUrl,
      async scrollTo(top: number) {
        if (window.scrollY === top) return
        let scrolled = new Promise<void>((resolve) =>
          window.addEventListener('scroll', () => resolve(), { once: true, signal: t.signal }),
        )
        window.scrollTo({ top, behavior: 'instant' })
        await scrolled
        expect(window.scrollY).toBe(top)
      },
      holdNextLoad() {
        let [started, start] = withResolvers<AbortSignal>()
        nextLoad = async (signal) => {
          start(signal)
          await new Promise<void>((resolve) =>
            signal.addEventListener('abort', () => resolve(), { once: true }),
          )
        }
        return started
      },
      deferNextLoad() {
        let [started, start] = withResolvers<AbortSignal>()
        let [released, release] = withResolvers<void>()
        nextLoad = async (signal) => {
          start(signal)
          signal.addEventListener('abort', () => release(), { once: true })
          await released
        }
        return { started, release: () => release() }
      },
      outerHtml,
      resolveNextWith(content: FrameContent) {
        nextContent = content
      },
      failNextLoad() {
        nextLoad = async () => {
          throw new Error('Reload failed')
        }
      },
    }
  }

  it('waits for a successor blocking child before scrolling a navigation', async (t) => {
    let page = await setupReloadingPage(t)
    let scrollCalls = mock.fn()
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let scroll = event.scroll.bind(event)
        t.mock.method(event, 'scroll', () => {
          scroll()
          scrollCalls()
        })
      },
      { once: true, signal: t.signal },
    )
    let completed = new Promise<void>((resolve) =>
      page.app.frames.top.addEventListener('reloadComplete', () => resolve(), {
        once: true,
        signal: t.signal,
      }),
    )
    let parentLoad = page.deferNextLoad()
    page.resolveNextWith(
      jsx('main', {
        style: { height: '5000px' },
        children: jsx(Frame, { name: 'content', src: '/replacement' }),
      }),
    )
    let settled = false
    let navigation = navigate(page.detailUrl).then(() => {
      settled = true
    })
    await parentLoad.started
    let childStarted = page.holdNextLoad()
    parentLoad.release()
    await childStarted
    let child = page.app.frames.get('content')
    if (!child) throw new Error('Expected a blocking child frame')
    let successorLoad = page.deferNextLoad()
    let successor = child.reload()
    await successorLoad.started
    await completed
    // The outgoing request has finished, and a later scroll event proves its callbacks ran.
    await page.scrollTo(600)
    expect(settled).toBe(false)
    expect(scrollCalls).not.toHaveBeenCalled()

    successorLoad.release()
    await successor
    await navigation
    expect(settled).toBe(true)
    expect(document.querySelector('main')?.textContent).toBe('List')
    expect(scrollCalls).toHaveBeenCalledTimes(1)
  })

  it('preserves a rendered page in history when its blocking client frame fails', async (t) => {
    let page = await setupReloadingPage(t)
    let entryCount = getCurrentNavigationEntry().index + 1
    let parentLoad = page.deferNextLoad()
    page.resolveNextWith(
      jsx('main', {
        style: { height: '5000px' },
        children: [
          jsx('h1', { children: 'Rendered page' }),
          jsx(Frame, { name: 'content', src: '/failing' }),
        ],
      }),
    )
    let navigation = navigate(page.detailUrl)
    await parentLoad.started
    page.failNextLoad()
    parentLoad.release()
    await navigation
    expect(document.querySelector('h1')?.textContent).toBe('Rendered page')
    expect(window.navigation.entries()).toHaveLength(entryCount + 1)
    await navigate(page.listUrl)
    expect(document.querySelector('main')?.textContent).toBe('List')
    expect(window.navigation.entries()).toHaveLength(entryCount + 2)
    await window.navigation.back().finished
    expect(window.location.href).toBe(page.detailUrl)
  })

  it('waits for a remounted blocking frame after its source changes during navigation', async (t) => {
    let page = await setupReloadingPage(t)
    let src = '/first-child'
    let update: (() => Promise<AbortSignal>) | undefined
    function Content(handle: Handle) {
      update = () => handle.update()
      return () =>
        jsx('main', {
          style: { height: '5000px' },
          children: jsx(Frame, { name: 'content', src }),
        })
    }
    let parentLoad = page.deferNextLoad()
    page.resolveNextWith(jsx(Content, {}))
    let settled = false
    let navigation = navigate(page.detailUrl).then(() => {
      settled = true
    })
    await parentLoad.started
    let childStarted = page.holdNextLoad()
    parentLoad.release()
    await childStarted
    let oldChild = page.app.frames.get('content')
    if (!oldChild || !update) throw new Error('Expected an updatable blocking frame')
    let successorLoad = page.deferNextLoad()
    src = '/second-child'
    await update()
    await successorLoad.started
    expect(page.app.frames.get('content')).not.toBe(oldChild)
    await page.scrollTo(600)
    expect(settled).toBe(false)
    successorLoad.release()
    await navigation
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await navigate(page.listUrl)
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
  })

  it('settles a navigation after its pending blocking child is removed', async (t) => {
    let page = await setupReloadingPage(t)
    let showChild = true
    let update: (() => Promise<AbortSignal>) | undefined
    function Content(handle: Handle) {
      update = () => handle.update()
      return () =>
        jsx('main', {
          style: { height: '5000px' },
          children: showChild ? jsx(Frame, { name: 'content', src: '/blocked' }) : 'Ready',
        })
    }
    let parentLoad = page.deferNextLoad()
    page.resolveNextWith(jsx(Content, {}))
    let navigation = navigate(page.detailUrl)
    await parentLoad.started
    let childStarted = page.holdNextLoad()
    parentLoad.release()
    await childStarted
    if (!update) throw new Error('Expected an updatable parent')
    showChild = false
    await update()
    await navigation
    expect(document.querySelector('main')?.textContent).toBe('Ready')
    await page.scrollTo(600)

    await navigate(page.listUrl)
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
  })

  it('saves the new position after a direct frame reload takes over a traversal', async (t) => {
    let page = await setupReloadingPage(t)
    await page.scrollTo(100)
    await navigate(page.detailUrl)

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    let navigationReloadSignal = await started
    await page.app.frames.top.reload()
    await back
    expect(navigationReloadSignal.aborted).toBe(true)
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('saves the new position after a top frame reload takes over a targeted traversal', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    let navigationReloadSignal = await started
    await page.app.frames.top.reload()
    await back
    expect(navigationReloadSignal.aborted).toBe(true)
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('saves the new position after an intermediate ancestor reload takes over a targeted traversal', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let inner = page.app.frames.get('content')
    let outer = page.app.frames.get('outer')
    if (!inner || !outer) throw new Error('Expected nested named frames')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    let navigationReloadSignal = await started
    await outer.reload()
    await back
    expect(navigationReloadSignal.aborted).toBe(true)
    expect(page.app.frames.get('content')).not.toBe(inner)
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('saves the new position after an intermediate ancestor re-resolves a client-created target', async (t) => {
    let page = await setupReloadingPage(t, 'client')
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    let navigationReloadSignal = await started
    await outer.reload()
    await back
    expect(navigationReloadSignal.aborted).toBe(true)
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('saves the new position when a top reload removes a client-rendered ancestor', async (t) => {
    let page = await setupReloadingPage(t)
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')
    await outer.replace(jsx(Frame, { name: 'content', src: '/scroll-fragment' }))
    await waitForDom(() => document.querySelector('main')?.textContent === 'List')
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    page.resolveNextWith(
      '<html><head></head><body><main style="height: 5000px">Replacement</main></body></html>',
    )
    await page.app.frames.top.reload()
    await back
    expect(document.querySelector('main')?.textContent).toBe('Replacement')
    await page.scrollTo(600)

    await navigate(new URL('/scroll-third', page.listUrl).href)
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
  })

  it('saves the new position after an ancestor replacement takes over a targeted traversal', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    let navigationReloadSignal = await started
    await outer.replace(page.outerHtml('Replacement'))
    await back
    expect(navigationReloadSignal.aborted).toBe(true)
    expect(document.querySelector('main')?.textContent).toBe('Replacement')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('saves the new position after a second ancestor reload replaces a blocked takeover', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    let originalTarget = page.app.frames.get('content')
    if (!outer || !originalTarget) throw new Error('Expected nested named frames')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    page.resolveNextWith(jsx(Frame, { name: 'content', src: '/replacement' }))
    let firstTakeover = outer.reload()
    let blockingChild = page.holdNextLoad()
    await blockingChild
    expect(page.app.frames.get('content')).not.toBe(originalTarget)

    await outer.reload()
    await firstTakeover
    await back
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('does not adopt replacement content before its blocking client frame resolves', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let blockingChild = page.holdNextLoad()
    await outer.replace(jsx(Frame, { name: 'content', src: '/replacement' }))
    await blockingChild
    await back
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('does not adopt unfinished replacement content when its blocking child reloads', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let blockingChild = page.holdNextLoad()
    await outer.replace(jsx(Frame, { name: 'content', src: '/replacement' }))
    await blockingChild
    let child = page.app.frames.get('content')
    if (!child) throw new Error('Expected a replacement child frame')
    let successorStarted = page.holdNextLoad()
    let successor = child.reload()
    await successorStarted
    await back
    await page.scrollTo(600)

    await window.navigation.forward().finished
    await successor
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('adopts replacement content after its blocking child supersedes an initial load', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let blockingChild = page.holdNextLoad()
    await outer.replace(jsx(Frame, { name: 'content', src: '/replacement' }))
    await blockingChild
    let child = page.app.frames.get('content')
    if (!child) throw new Error('Expected a replacement child frame')
    await child.reload()
    await back
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
  })

  it('adopts replacement content when its blocking child succeeds after a failed retry', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let blockingChild = page.holdNextLoad()
    await outer.replace(jsx(Frame, { name: 'content', src: '/replacement' }))
    await blockingChild
    let child = page.app.frames.get('content')
    if (!child) throw new Error('Expected a replacement child frame')
    page.failNextLoad()
    await expect(child.reload()).rejects.toThrow('Reload failed')
    await child.reload()
    await back
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
  })

  it('keeps a replacement blocked on nested content introduced by a successor child reload', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let blockingChild = page.holdNextLoad()
    await outer.replace(jsx(Frame, { name: 'content', src: '/replacement' }))
    await blockingChild
    let child = page.app.frames.get('content')
    if (!child) throw new Error('Expected a replacement child frame')
    page.resolveNextWith(jsx(Frame, { src: '/blocked-grandchild' }))
    let successor = child.reload()
    let grandchildStarted = page.holdNextLoad()
    await grandchildStarted
    await back
    await page.scrollTo(600)

    await window.navigation.forward().finished
    await successor
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('does not adopt a pending entry when an unrelated sibling commits', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let sidebar = page.app.frames.get('sidebar')
    if (!sidebar) throw new Error('Expected a sibling frame')

    let started = page.holdNextLoad()
    window.history.back()
    await started
    await sidebar.reload()
    await page.scrollTo(600)
    let completed = waitForNavigationSuccess()
    window.history.forward()
    await completed
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('does not adopt a pending entry when an older ancestor load commits', async (t) => {
    let page = await setupReloadingPage(t)
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let oldLoad = page.deferNextLoad()
    let oldReload = outer.reload()
    await oldLoad.started
    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    oldLoad.release()
    await oldReload
    await back
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('adopts a target reload while an ancestor replacement preserves it and blocks on a sibling', async (t) => {
    let page = await setupReloadingPage(t, 'client')
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    let target = page.app.frames.get('content')
    if (!outer || !target) throw new Error('Expected nested named frames')

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let siblingStarted = page.holdNextLoad()
    await outer.replace([
      jsx(Frame, { name: 'content', src: '/scroll-fragment' }),
      jsx(Frame, { name: 'unrelated', src: '/blocked-sibling' }),
    ])
    await siblingStarted
    expect(page.app.frames.get('content')).toBe(target)
    await target.reload()
    await back
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    expect(window.scrollY).toBe(600)
  })

  it('adopts a client frame update after overlapping empty replacements finish out of order', async (t) => {
    let page = await setupReloadingPage(t, 'client')
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')
    let src = '/scroll-fragment'
    let update: (() => Promise<AbortSignal>) | undefined
    function Content(handle: Handle) {
      update = () => handle.update()
      return () => jsx(Frame, { name: 'content', src })
    }
    let firstStream = new TransformStream<Uint8Array, Uint8Array>()
    let secondStream = new TransformStream<Uint8Array, Uint8Array>()
    let first = outer.replace(firstStream.readable)
    let second = outer.replace(secondStream.readable)
    await firstStream.writable.close()
    await first
    await secondStream.writable.close()
    await second
    await outer.replace(jsx(Content, {}))
    await waitForDom(() => document.querySelector('main')?.textContent === 'List')

    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    let target = page.app.frames.get('content')
    if (!target || !update) throw new Error('Expected an updatable client frame')
    src = '/replacement'
    await update()
    await waitForDom(() => document.querySelector('main')?.textContent === 'List')
    await back
    expect(document.querySelector('main')?.textContent).toBe('List')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
  })

  it('adopts an independent client update while an older parent stream remains open', async (t) => {
    let page = await setupReloadingPage(t, 'client')
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')
    let src = '/scroll-fragment'
    let update: (() => Promise<AbortSignal>) | undefined
    function Content(handle: Handle) {
      update = () => handle.update()
      return () => jsx(Frame, { name: 'content', src })
    }
    await outer.replace(jsx(Content, {}))
    await waitForDom(() => document.querySelector('main')?.textContent === 'List')
    let closeStream = () => {}
    let stream = new ReadableStream<Uint8Array>({
      start(controller) {
        closeStream = () => controller.close()
      },
    })
    let streaming = outer.replace(stream)
    try {
      await navigate(page.listUrl, { target: 'content' })
      await page.scrollTo(100)
      await navigate(page.detailUrl, { target: 'content' })
      let started = page.holdNextLoad()
      let back = window.navigation.back().finished
      await started
      if (!update) throw new Error('Expected an updatable client frame')
      src = '/replacement'
      await update()
      await waitForDom(() => document.querySelector('main')?.textContent === 'List')
      await back
      await page.scrollTo(600)

      await window.navigation.forward().finished
      let scrollTo = t.mock.method(window, 'scrollTo')
      await window.navigation.back().finished

      expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 600, behavior: 'instant' })
    } finally {
      closeStream()
      await streaming
    }
  })

  it('does not adopt a remounted child from an older ancestor response', async (t) => {
    let page = await setupReloadingPage(t, 'client')
    await navigate(page.listUrl, { target: 'content' })
    await page.scrollTo(100)
    await navigate(page.detailUrl, { target: 'content' })
    let outer = page.app.frames.get('outer')
    if (!outer) throw new Error('Expected an intermediate ancestor frame')

    let oldLoad = page.deferNextLoad()
    page.resolveNextWith([jsx(Frame, { name: 'renamed', src: '/older-child' })])
    let oldReload = outer.reload()
    await oldLoad.started
    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    oldLoad.release()
    await oldReload
    await back
    await page.scrollTo(600)

    await navigate(new URL('/scroll-third', page.listUrl).href)
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('preserves the saved position when a takeover reload fails before rendering', async (t) => {
    let page = await setupReloadingPage(t)
    await page.scrollTo(100)
    await navigate(page.detailUrl)

    let started = page.holdNextLoad()
    let back = window.navigation.back().finished
    await started
    page.failNextLoad()
    await expect(page.app.frames.top.reload()).rejects.toThrow('Reload failed')
    await back
    expect(document.querySelector('main')?.textContent).toBe('Detail')
    await page.scrollTo(600)

    await window.navigation.forward().finished
    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    // Chromium can apply its own restoration again after the handler finishes.
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 100, behavior: 'instant' })
  })

  it('leaves the window alone for an entry that restores scroll manually', async (t) => {
    let page = setup(t)
    window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 800)
    await navigate(page.detailUrl)
    window.scrollTo(0, 300)

    let scrollTo = t.mock.method(window, 'scrollTo')
    await window.navigation.back().finished

    expect(scrollTo).not.toHaveBeenCalled()
  })
})

function getCurrentNavigationEntry(): NavigationHistoryEntry {
  let entry = window.navigation.currentEntry
  if (!entry) throw new Error('Expected a current navigation entry')
  return entry
}

function waitForNavigationSuccess(): Promise<void> {
  return new Promise((resolve) => {
    window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
  })
}
