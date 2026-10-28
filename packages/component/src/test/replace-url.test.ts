import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { createElement, createRoot, navigate, replaceUrl, run } from '../index.ts'
import type { Handle } from '../index.ts'
import { withResolvers } from './utils.ts'

function startApp(t: TestContext) {
  let resolveFrame = mock.fn(async (src: string) => {
    let variant = new URL(src).searchParams.get('variant') ?? 'Initial'
    return `<html><head></head><body><h1>${variant}</h1></body></html>`
  })
  let app = run({ loadModule: mock.fn(), resolveFrame })
  t.after(() => app.dispose())
  return { app, resolveFrame }
}

function startPendingApp(t: TestContext) {
  let [started, resolveStarted] = withResolvers<AbortSignal>()
  let [pending, resolvePending, rejectPending] = withResolvers<string | Response>()
  let resolveFrame = mock.fn(async (src: string, options?: { signal?: AbortSignal }) => {
    if (new URL(src).searchParams.get('variant') === 'pending') {
      if (!options?.signal) throw new Error('Expected a navigation signal')
      resolveStarted(options.signal)
      return pending
    }
    return '<html><head></head><body><h1>Successor</h1></body></html>'
  })
  let app = run({ loadModule: mock.fn(), resolveFrame })
  function complete() {
    resolvePending('<html><head></head><body><h1>Loaded</h1></body></html>')
  }
  t.after(async () => {
    complete()
    await window.navigation.transition?.finished.catch(() => {})
    app.dispose()
  })
  return { app, started, complete, resolvePending, rejectPending, resolveFrame }
}

function stubGlobal(t: TestContext, name: string, value: unknown): void {
  let descriptor = Object.getOwnPropertyDescriptor(window, name)
  Object.defineProperty(window, name, { configurable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(window, name, descriptor)
    else Reflect.deleteProperty(window, name)
  })
}

describe('replaceUrl', () => {
  let originalHref: string
  let originalHistoryState: unknown
  let originalNavigationState: unknown

  beforeEach(() => {
    originalHref = window.location.href
    originalHistoryState = window.history.state
    originalNavigationState = window.navigation.currentEntry?.getState()
  })

  afterEach(() => {
    window.history.replaceState(originalHistoryState, '', originalHref)
    if (originalNavigationState !== undefined) {
      window.navigation.updateCurrentEntry({ state: originalNavigationState })
    }
    document.body.textContent = ''
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  })

  it('replaces the URL synchronously and uses it for subsequent top-frame reloads', async (t) => {
    window.history.replaceState({ application: 'preserved' }, '', window.location.href)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let entryCount = window.navigation.entries().length
    let destination = new URL('?variant=blue', window.location.href)

    let replacing = replaceUrl(destination.search)

    expect(window.location.href).toBe(destination.href)
    expect(window.navigation.entries()).toHaveLength(entryCount)
    expect(window.history.state).toEqual({ application: 'preserved' })
    expect(window.navigation.currentEntry?.getState()).toMatchObject({
      $rmx: true,
      src: destination.href,
      target: undefined,
    })
    expect(app.frames.top.src).toBe(destination.href)
    expect(resolveFrame).not.toHaveBeenCalled()
    await replacing

    await app.frames.top.reload()
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(resolveFrame.mock.calls[0]?.arguments[0]).toBe(destination.href)
  })

  it('preserves scroll and focus when replacing only the fragment', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let input = document.createElement('input')
    let spacer = document.createElement('div')
    spacer.style.height = '3000px'
    let target = document.createElement('button')
    target.id = 'replacement-fragment'
    document.body.append(input, spacer, target)
    input.focus()
    window.scrollTo({ left: 0, top: 100, behavior: 'instant' })
    expect(window.scrollY).toBe(100)

    await replaceUrl(`#${target.id}`)

    expect(window.location.hash).toBe(`#${target.id}`)
    expect(window.scrollY).toBe(100)
    expect(document.activeElement).toBe(input)
    expect(app.frames.top.src).toBe(window.location.href)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('reloads the replaced URL on Back after navigating away', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    window.navigation.updateCurrentEntry({
      state: { $rmx: true, src: '/partials/details', target: 'details', custom: 'preserved' },
    })
    let replacement = new URL('?variant=red', window.location.href)
    await replaceUrl(replacement.href)

    expect(window.navigation.currentEntry?.getState()).toMatchObject({
      custom: 'preserved',
      target: undefined,
      src: replacement.href,
    })

    await navigate('?variant=blue')
    expect(document.querySelector('h1')?.textContent).toBe('blue')
    await window.navigation.back().finished

    expect(window.location.href).toBe(replacement.href)
    expect(app.frames.top.src).toBe(replacement.href)
    expect(document.querySelector('h1')?.textContent).toBe('red')
    expect(resolveFrame).toHaveBeenCalledTimes(2)
    expect(resolveFrame.mock.calls[1]?.arguments[0]).toBe(replacement.href)

    await window.navigation.forward().finished
    expect(document.querySelector('h1')?.textContent).toBe('blue')
    expect(resolveFrame).toHaveBeenCalledTimes(3)
  })

  it('works without the Navigation API and keeps the top-frame source in sync', async (t) => {
    stubGlobal(t, 'navigation', undefined)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let destination = new URL('?variant=fallback', window.location.href)
    let entryCount = window.history.length

    await replaceUrl(destination.search)

    expect(window.location.href).toBe(destination.href)
    expect(window.history.length).toBe(entryCount)
    expect(app.frames.top.src).toBe(destination.href)
    expect(resolveFrame).not.toHaveBeenCalled()
    await app.frames.top.reload()
    expect(resolveFrame.mock.calls[0]?.arguments[0]).toBe(destination.href)
  })

  it('preserves Remix state when sourceElement support is unavailable', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    stubGlobal(t, 'NavigateEvent', Event)
    let destination = new URL('?variant=unsupported', window.location.href)

    await replaceUrl(destination.search)

    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({
      $rmx: true,
      src: destination.href,
    })
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('preserves non-Remix state when used without a running app', async () => {
    window.history.replaceState({ application: 'history-state' }, '', window.location.href)
    window.navigation.updateCurrentEntry({ state: { application: 'navigation-state' } })
    let destination = new URL('?variant=standalone', window.location.href)

    await replaceUrl(destination.search)

    expect(window.location.href).toBe(destination.href)
    expect(window.history.state).toEqual({ application: 'history-state' })
    expect(window.navigation.currentEntry?.getState()).toEqual({ application: 'navigation-state' })
  })

  it('rejects cross-origin replacements without changing the URL or frame source', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()

    await expect(replaceUrl('https://another-origin.example/product')).rejects.toThrow(DOMException)

    expect(window.location.href).toBe(originalHref)
    expect(app.frames.top.src).toBe(originalHref)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('waits for the current navigation without aborting or reloading its frame', async (t) => {
    let { app, started, complete, resolveFrame } = startPendingApp(t)
    await app.ready()
    let destination = new URL('?variant=pending', window.location.href)
    let navigating = navigate(destination.href)
    let signal = await started
    let entryCount = window.navigation.entries().length
    window.navigation.updateCurrentEntry({ state: { application: 'destination-state' } })
    let settled = false
    let replacing = replaceUrl('?variant=settled').then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    expect(signal.aborted).toBe(false)
    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)

    complete()
    await navigating
    await replacing

    expect(window.location.search).toBe('?variant=settled')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toEqual({ application: 'destination-state' })
    expect(window.navigation.entries()).toHaveLength(entryCount)
    expect(document.querySelector('h1')?.textContent).toBe('Loaded')
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('rejects an already aborted signal without changing the URL or state', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let state = window.navigation.currentEntry?.getState()
    let reason = new Error('Replacement cancelled')

    await expect(
      replaceUrl('?variant=cancelled', { signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason)

    expect(window.location.href).toBe(originalHref)
    expect(app.frames.top.src).toBe(originalHref)
    expect(window.navigation.currentEntry?.getState()).toEqual(state)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('cancels the wait promptly when its component unmounts without aborting navigation', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let root = createRoot(document.createElement('div'))
    t.after(() => root.dispose())
    let ownerSignal: AbortSignal | undefined
    function Owner(handle: Handle) {
      ownerSignal = handle.signal
      return () => 'Owner'
    }
    root.render(createElement(Owner))
    root.flush()
    if (!ownerSignal) throw new Error('Expected a component signal')
    let navigating = navigate('?variant=pending')
    let navigationSignal = await started
    let replacing = replaceUrl('?variant=cancelled', { signal: ownerSignal })
    let result = replacing.catch((error: unknown) => error)

    root.render(null)
    root.flush()
    expect(await result).toBe(ownerSignal.reason)
    expect(navigationSignal.aborted).toBe(false)
    expect(window.location.search).toBe('?variant=pending')

    complete()
    await navigating
    expect(window.location.search).toBe('?variant=pending')
    expect(document.querySelector('h1')?.textContent).toBe('Loaded')
  })

  it('checks the signal again when navigation finishes', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let controller = new AbortController()
    let reason = new Error('Unmounted at settlement')
    let navigating = navigate('?variant=pending')
    await started
    let replacing = replaceUrl('?variant=cancelled', { signal: controller.signal })
    let rejected = expect(replacing).rejects.toBe(reason)
    void window.navigation.transition?.finished.then(() => controller.abort(reason))

    complete()
    await navigating
    await rejected
    expect(window.location.search).toBe('?variant=pending')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('waits for legacy transitions without to or committed properties', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending')
    await started
    let transition = window.navigation.transition
    if (!transition) throw new Error('Expected an active transition')
    Object.defineProperties(transition, {
      to: { value: undefined },
      committed: { value: undefined },
    })
    let replacing = replaceUrl('?variant=settled')

    complete()
    await navigating
    await replacing
    expect(window.location.search).toBe('?variant=settled')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('waits for precommit navigation and resolves relative URLs against its destination', async (t) => {
    let [started, resolveStarted] = withResolvers<void>()
    let [precommit, commit] = withResolvers<void>()
    let [pending, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      commit()
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({
          async precommitHandler() {
            resolveStarted()
            await precommit
          },
          handler: () => pending,
        })
      },
      { once: true, signal: listener.signal },
    )
    let navigating = window.navigation.navigate('/replace-url/product?variant=pending')
    await started
    let replacing = replaceUrl('details?variant=settled')
    expect(window.location.href).toBe(originalHref)

    commit()
    await navigating.committed
    expect(window.location.pathname).toBe('/replace-url/product')
    expect(window.location.search).toBe('?variant=pending')
    finish()
    await navigating.finished
    await replacing
    expect(window.location.pathname).toBe('/replace-url/details')
    expect(window.location.search).toBe('?variant=settled')
  })

  it('rejects if precommit redirects the captured transition to another destination', async (t) => {
    let [started, resolveStarted] = withResolvers<void>()
    let [precommit, commit] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      commit()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({
          async precommitHandler(controller) {
            resolveStarted()
            await precommit
            controller.redirect('/replace-url/redirected')
          },
        })
      },
      { once: true, signal: listener.signal },
    )
    let navigating = window.navigation.navigate('/replace-url/requested')
    await started
    let rejected = expect(replaceUrl('?variant=stale')).rejects.toHaveProperty('name', 'AbortError')

    commit()
    await navigating.finished
    await rejected
    expect(window.location.pathname).toBe('/replace-url/redirected')
    expect(window.location.search).toBe('')
  })

  it('rejects a replacement when another navigation supersedes the captured transition', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending').catch(() => {})
    await started
    let replacing = replaceUrl('?variant=stale')
    let rejected = expect(replacing).rejects.toHaveProperty('name', 'AbortError')

    await navigate('?variant=successor')
    await rejected
    complete()
    await navigating
    expect(window.location.search).toBe('?variant=successor')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(document.querySelector('h1')?.textContent).toBe('Successor')
  })

  it('rejects when a successor navigation starts from navigatesuccess, even to the same URL', async (t) => {
    let { app, started, complete, resolveFrame } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending').catch(() => {})
    await started
    let replacing = replaceUrl('?variant=stale')
    let rejected = expect(replacing).rejects.toHaveProperty('name', 'AbortError')
    let successor: Promise<void> | undefined
    let listener = new AbortController()
    t.after(() => listener.abort())
    window.navigation.addEventListener(
      'navigatesuccess',
      () => {
        successor = navigate(window.location.href, { history: 'replace' })
      },
      { once: true, signal: listener.signal },
    )

    complete()
    await navigating
    await rejected
    await successor
    expect(window.location.search).toBe('?variant=pending')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(resolveFrame).toHaveBeenCalledTimes(2)
  })

  it('rejects a pending replacement when the frame response redirects elsewhere', async (t) => {
    let { app, started, resolvePending } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending').catch(() => {})
    await started
    let replacing = replaceUrl('?variant=stale')
    let rejected = expect(replacing).rejects.toHaveProperty('name', 'AbortError')
    let destination = new URL('?variant=redirected', window.location.href)
    let [redirected, resolveRedirected] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => listener.abort())
    window.navigation.addEventListener(
      'navigatesuccess',
      () => {
        if (window.location.href === destination.href) resolveRedirected()
      },
      { signal: listener.signal },
    )
    let response = new Response('<html><head></head><body><h1>Redirected</h1></body></html>')
    Object.defineProperties(response, {
      redirected: { value: true },
      url: { value: destination.href },
    })

    resolvePending(response)
    await rejected
    await navigating
    await redirected
    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
    expect(document.querySelector('h1')?.textContent).toBe('Redirected')
  })

  it('propagates navigation failures without applying the pending replacement', async (t) => {
    let { app, started, rejectPending } = startPendingApp(t)
    app.addEventListener('error', (event) => event.preventDefault())
    await app.ready()
    let navigating = navigate('?variant=pending').catch(() => {})
    await started
    let reason = new Error('Frame failed')
    let rejected = expect(replaceUrl('?variant=stale')).rejects.toBe(reason)

    rejectPending(reason)
    await rejected
    await navigating
    expect(window.location.search).toBe('?variant=pending')
    expect(app.frames.top.src).toBe(window.location.href)
  })
})
