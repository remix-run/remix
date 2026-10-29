import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { createElement, createRoot, navigate, updateUrl, run } from '../index.ts'
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
  let [pending, resolvePending, rejectPending] = withResolvers<string>()
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
  return { app, started, complete, rejectPending, resolveFrame }
}

function stubGlobal(t: TestContext, name: string, value: unknown): void {
  let descriptor = Object.getOwnPropertyDescriptor(window, name)
  Object.defineProperty(window, name, { configurable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(window, name, descriptor)
    else Reflect.deleteProperty(window, name)
  })
}

describe('updateUrl', () => {
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

  it('replaces the entry immediately and keeps reloads in sync without sourceElement support', async (t) => {
    window.history.replaceState({ application: 'preserved' }, '', window.location.href)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    stubGlobal(t, 'NavigateEvent', Event)
    let entryCount = window.navigation.entries().length
    let destination = new URL('?variant=blue', window.location.href)

    let updating = updateUrl(destination.search)

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
    await updating

    await app.frames.top.reload()
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(resolveFrame.mock.calls[0]?.arguments[0]).toBe(destination.href)
  })

  it('preserves scroll and focus when pushing only the fragment', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let input = document.createElement('input')
    let spacer = document.createElement('div')
    spacer.style.height = '3000px'
    let target = document.createElement('button')
    target.id = 'updated-fragment'
    document.body.append(input, spacer, target)
    input.focus()
    window.scrollTo({ left: 0, top: 100, behavior: 'instant' })
    expect(window.scrollY).toBe(100)

    await updateUrl(`#${target.id}`, { history: 'push' })

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
    await updateUrl(replacement.href)

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
  })

  it('pushes locally rendered state and reloads both URLs on Back and Forward', async (t) => {
    window.history.replaceState({ application: 'preserved' }, '', '?variant=red')
    let heading = document.createElement('h1')
    heading.textContent = 'red'
    document.body.append(heading)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let previousEntry = window.navigation.currentEntry
    if (!previousEntry) throw new Error('Expected a current navigation entry')
    let previousIndex = previousEntry.index
    let previousUrl = window.location.href
    let previousState = { $rmx: true, src: previousUrl, target: undefined, custom: 'preserved' }
    window.navigation.updateCurrentEntry({ state: previousState })
    heading.textContent = 'blue'
    let destination = new URL('?variant=blue', window.location.href)

    let updating = updateUrl(destination.search, { history: 'push' })

    expect(window.location.href).toBe(destination.href)
    expect(window.navigation.currentEntry?.index).toBe(previousIndex + 1)
    expect(window.navigation.entries()).toHaveLength(previousIndex + 2)
    expect(previousEntry.getState()).toEqual(previousState)
    expect(window.navigation.currentEntry?.getState()).toEqual({
      ...previousState,
      src: destination.href,
    })
    expect(window.history.state).toEqual({ application: 'preserved' })
    expect(app.frames.top.src).toBe(destination.href)
    expect(heading.textContent).toBe('blue')
    expect(resolveFrame).not.toHaveBeenCalled()
    await updating

    await window.navigation.back().finished
    expect(window.location.href).toBe(previousUrl)
    expect(app.frames.top.src).toBe(previousUrl)
    expect(document.querySelector('h1')?.textContent).toBe('red')

    await window.navigation.forward().finished
    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
    expect(document.querySelector('h1')?.textContent).toBe('blue')
    expect(resolveFrame.mock.calls.map((call) => call.arguments[0])).toEqual([
      previousUrl,
      destination.href,
    ])
  })

  it('works without the Navigation API and keeps the top-frame source in sync', async (t) => {
    let navigation = window.navigation
    let previousIndex = navigation.currentEntry?.index
    if (previousIndex === undefined) throw new Error('Expected a current navigation entry')
    stubGlobal(t, 'navigation', undefined)
    let { app } = startApp(t)
    await app.ready()
    let destination = new URL('?variant=fallback', window.location.href)

    await updateUrl(destination.search, { history: 'push' })

    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
    expect(navigation.currentEntry?.index).toBe(previousIndex + 1)
  })

  it('preserves non-Remix state when used without a running app', async () => {
    window.history.replaceState({ application: 'history-state' }, '', window.location.href)
    window.navigation.updateCurrentEntry({ state: { application: 'navigation-state' } })
    let destination = new URL('?variant=standalone', window.location.href)

    await updateUrl(destination.search, { history: 'replace' })

    expect(window.location.href).toBe(destination.href)
    expect(window.history.state).toEqual({ application: 'history-state' })
    expect(window.navigation.currentEntry?.getState()).toEqual({ application: 'navigation-state' })
  })

  it('rejects cross-origin updates without changing the URL or frame source', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()

    await expect(updateUrl('https://another-origin.example/product')).rejects.toHaveProperty(
      'name',
      'SecurityError',
    )

    expect(window.location.href).toBe(originalHref)
    expect(app.frames.top.src).toBe(originalHref)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('waits for the current navigation before pushing without aborting or reloading its frame', async (t) => {
    let { app, started, complete, resolveFrame } = startPendingApp(t)
    await app.ready()
    let destination = new URL('?variant=pending', window.location.href)
    let navigating = navigate(destination.href)
    let signal = await started
    let entry = window.navigation.currentEntry
    if (!entry) throw new Error('Expected a current navigation entry')
    let previousIndex = entry.index
    let settled = false
    let updating = updateUrl('?variant=settled', { history: 'push' }).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    expect(signal.aborted).toBe(false)
    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)

    window.navigation.updateCurrentEntry({
      state: { $rmx: true, src: '/stale', target: 'details', application: 'destination-state' },
    })
    complete()
    await navigating
    await updating

    expect(window.location.search).toBe('?variant=settled')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toEqual({
      $rmx: true,
      src: window.location.href,
      target: undefined,
      application: 'destination-state',
    })
    expect(window.navigation.currentEntry?.index).toBe(previousIndex + 1)
    expect(entry.getState()).toEqual({
      $rmx: true,
      src: '/stale',
      target: 'details',
      application: 'destination-state',
    })
    expect(document.querySelector('h1')?.textContent).toBe('Loaded')
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('rejects an already aborted signal without changing the URL or state', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let state = window.navigation.currentEntry?.getState()
    let reason = new Error('URL update cancelled')

    await expect(
      updateUrl('?variant=cancelled', { signal: AbortSignal.abort(reason) }),
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
    let entry = window.navigation.currentEntry
    let updating = updateUrl('?variant=cancelled', { history: 'push', signal: ownerSignal })
    let result = updating.catch((error: unknown) => error)

    root.render(null)
    root.flush()
    expect(await result).toBe(ownerSignal.reason)
    expect(navigationSignal.aborted).toBe(false)
    expect(window.location.search).toBe('?variant=pending')
    expect(window.navigation.currentEntry).toBe(entry)

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
    let updating = updateUrl('?variant=cancelled', { signal: controller.signal })
    let rejected = expect(updating).rejects.toBe(reason)
    // Abort after the wait resolves but before the update's continuation runs.
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
    let updating = updateUrl('?variant=settled')

    complete()
    await navigating
    await updating
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
    let navigating = window.navigation.navigate('/update-url/product?variant=pending')
    await started
    let updating = updateUrl('details?variant=settled')
    expect(window.location.href).toBe(originalHref)

    commit()
    await navigating.committed
    expect(window.location.pathname).toBe('/update-url/product')
    expect(window.location.search).toBe('?variant=pending')
    finish()
    await navigating.finished
    await updating
    expect(window.location.pathname).toBe('/update-url/details')
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
            controller.redirect('/update-url/redirected')
          },
        })
      },
      { once: true, signal: listener.signal },
    )
    let navigating = window.navigation.navigate('/update-url/requested')
    await started
    let rejected = expect(updateUrl('?variant=stale')).rejects.toHaveProperty('name', 'AbortError')

    commit()
    await navigating.finished
    await rejected
    expect(window.location.pathname).toBe('/update-url/redirected')
    expect(window.location.search).toBe('')
  })

  it('rejects an update when another navigation supersedes the captured transition', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending').catch(() => {})
    await started
    let updating = updateUrl('?variant=stale')
    let rejected = expect(updating).rejects.toHaveProperty('name', 'AbortError')

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
    let updating = updateUrl('?variant=stale')
    let rejected = expect(updating).rejects.toHaveProperty('name', 'AbortError')
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

  it('propagates navigation failures without applying the pending update', async (t) => {
    let { app, started, rejectPending } = startPendingApp(t)
    app.addEventListener('error', (event) => event.preventDefault())
    await app.ready()
    let navigating = navigate('?variant=pending').catch(() => {})
    await started
    let reason = new Error('Frame failed')
    let rejected = expect(updateUrl('?variant=stale')).rejects.toBe(reason)

    rejectPending(reason)
    await rejected
    await navigating
    expect(window.location.search).toBe('?variant=pending')
    expect(app.frames.top.src).toBe(window.location.href)
  })
})
