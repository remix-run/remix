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

function startPrecommitNavigation(t: TestContext, href: string, redirect?: string) {
  let [started, resolveStarted] = withResolvers<void>()
  let [precommit, commit] = withResolvers<void>()
  let listener = new AbortController()
  window.navigation.addEventListener(
    'navigate',
    (event) => {
      event.intercept({
        async precommitHandler(controller) {
          resolveStarted()
          await precommit
          if (redirect !== undefined) controller.redirect(redirect)
        },
      })
    },
    { once: true, signal: listener.signal },
  )
  let navigating = window.navigation.navigate(href)
  t.after(async () => {
    commit()
    await navigating.finished?.catch(() => {})
    listener.abort()
  })
  return { started, commit, navigating }
}

function stubGlobal(t: TestContext, name: string, value: unknown): void {
  let descriptor = Object.getOwnPropertyDescriptor(window, name)
  Object.defineProperty(window, name, { configurable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(window, name, descriptor)
    else Reflect.deleteProperty(window, name)
  })
}

async function expectCancelledUpdate(t: TestContext, history: 'push' | 'replace') {
  let { app, resolveFrame } = startApp(t)
  await app.ready()
  let href = window.location.href
  let state = { $rmx: true, target: 'details', src: '/partials/details', custom: 'preserved' }
  window.history.replaceState({ application: 'preserved' }, '', href)
  window.navigation.updateCurrentEntry({ state })
  let entry = window.navigation.currentEntry
  let entryCount = window.navigation.entries().length
  let listener = new AbortController()
  t.after(() => listener.abort())
  window.navigation.addEventListener('navigate', (event) => event.preventDefault(), {
    once: true,
    signal: listener.signal,
  })

  await expect(
    updateUrl(history === 'replace' ? href : '?variant=blocked', { history }),
  ).rejects.toHaveProperty('name', 'AbortError')

  expect(window.location.href).toBe(href)
  expect(window.navigation.currentEntry).toBe(entry)
  expect(window.navigation.entries()).toHaveLength(entryCount)
  expect(window.navigation.currentEntry?.getState()).toEqual(state)
  expect(window.history.state).toEqual({ application: 'preserved' })
  expect(app.frames.top.src).toBe(href)
  expect(resolveFrame).not.toHaveBeenCalled()
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

  it('leaves the previous entry unchanged when a native listener cancels a push', async (t) => {
    await expectCancelledUpdate(t, 'push')
  })

  it('rejects a canceled replacement even when the requested URL is unchanged', async (t) => {
    await expectCancelledUpdate(t, 'replace')
  })

  it('preserves state and source when an earlier capture listener hides the native event', async (t) => {
    window.history.replaceState({ application: 'preserved' }, '', window.location.href)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let state = window.navigation.currentEntry?.getState()
    let listener = new AbortController()
    t.after(() => listener.abort())
    window.navigation.addEventListener('navigate', (event) => event.stopImmediatePropagation(), {
      capture: true,
      once: true,
      signal: listener.signal,
    })

    await updateUrl('?variant=blue')

    expect(window.location.search).toBe('?variant=blue')
    expect(window.history.state).toEqual({ application: 'preserved' })
    expect(window.navigation.currentEntry?.getState()).toEqual({
      ...state,
      src: window.location.href,
    })
    expect(app.frames.top.src).toBe(window.location.href)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('waits for native interception while synchronizing the committed URL immediately', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let [handler, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({ handler: () => handler, scroll: 'manual', focusReset: 'manual' })
      },
      { once: true, signal: listener.signal },
    )
    let settled = false
    let updating = updateUrl('?variant=intercepted').then(() => {
      settled = true
    })

    expect(window.location.search).toBe('?variant=intercepted')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({ src: window.location.href })
    await Promise.resolve()
    expect(settled).toBe(false)
    finish()
    await updating
    expect(settled).toBe(true)
  })

  it('synchronizes a native precommit update after it commits', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let original = window.location.href
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
          precommitHandler: () => precommit,
          scroll: 'manual',
          focusReset: 'manual',
        })
      },
      { once: true, signal: listener.signal },
    )
    let updating = updateUrl('?variant=precommit')

    expect(window.location.href).toBe(original)
    expect(app.frames.top.src).toBe(original)
    commit()
    await updating
    expect(window.location.search).toBe('?variant=precommit')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({ src: window.location.href })
  })

  it('propagates native interception failure while keeping the committed URL synchronized', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let reason = new Error('Native handler failed')
    let listener = new AbortController()
    t.after(() => listener.abort())
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({ handler: () => Promise.reject(reason) })
      },
      { once: true, signal: listener.signal },
    )

    await expect(updateUrl('?variant=committed')).rejects.toBe(reason)

    expect(window.location.search).toBe('?variant=committed')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({ src: window.location.href })
  })

  it('rejects native precommit failure without changing the URL or state', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let href = window.location.href
    let state = window.navigation.currentEntry?.getState()
    let reason = new Error('Native precommit failed')
    let listener = new AbortController()
    t.after(() => listener.abort())
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({ precommitHandler: () => Promise.reject(reason) })
      },
      { once: true, signal: listener.signal },
    )

    await expect(updateUrl('?variant=failed')).rejects.toBe(reason)

    expect(window.location.href).toBe(href)
    expect(app.frames.top.src).toBe(href)
    expect(window.navigation.currentEntry?.getState()).toEqual(state)
  })

  it('cancels a native precommit wait while keeping its later commit synchronized', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let href = window.location.href
    let [precommit, commit] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      commit()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({ precommitHandler: () => precommit })
      },
      { once: true, signal: listener.signal },
    )
    let controller = new AbortController()
    let reason = new Error('Owner disconnected')
    let rejected = expect(updateUrl('?variant=late', { signal: controller.signal })).rejects.toBe(
      reason,
    )
    let transition = window.navigation.transition
    if (!transition) throw new Error('Expected native interception')

    controller.abort(reason)
    await rejected
    expect(window.location.href).toBe(href)
    commit()
    await transition.finished
    expect(window.location.search).toBe('?variant=late')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({ src: window.location.href })
  })

  it('applies consecutive idle updates synchronously without superseding settled calls', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let first = updateUrl('?variant=blue')
    expect(window.location.search).toBe('?variant=blue')
    let second = updateUrl('?variant=red')
    expect(window.location.search).toBe('?variant=red')

    await Promise.all([first, second])
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('preserves a guard replacement when the native update is canceled', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let guard = new URL('?variant=guard', window.location.href)
    let guardState = { application: 'guard' }
    let listener = new AbortController()
    t.after(() => listener.abort())
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.preventDefault()
        window.history.replaceState(guardState, '', guard.href)
        window.navigation.updateCurrentEntry({ state: guardState })
      },
      { once: true, signal: listener.signal },
    )

    await expect(updateUrl('?variant=requested')).rejects.toHaveProperty('name', 'AbortError')

    expect(window.location.href).toBe(guard.href)
    expect(window.history.state).toEqual(guardState)
    expect(window.navigation.currentEntry?.getState()).toEqual(guardState)
  })

  it('rejects a canceled update before its guard replacement completes precommit', async (t) => {
    let [precommit, commit] = withResolvers<void>()
    let listener = new AbortController()
    let successor: ReturnType<Navigation['navigate']> | undefined
    t.after(async () => {
      commit()
      await successor?.finished?.catch(() => {})
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.preventDefault()
        window.navigation.addEventListener(
          'navigate',
          (event) => event.intercept({ precommitHandler: () => precommit }),
          { once: true, signal: listener.signal },
        )
        successor = window.navigation.navigate('?variant=guard', { state: { guard: true } })
      },
      { once: true, signal: listener.signal },
    )
    let settled = false
    let updating = updateUrl('?variant=requested').catch((error: unknown) => {
      settled = true
      return error
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(true)
    expect(await updating).toHaveProperty('name', 'AbortError')
    expect(window.location.href).toBe(originalHref)
    if (!successor?.finished) throw new Error('Expected a guard navigation')
    commit()
    await successor.finished
    expect(window.location.search).toBe('?variant=guard')
    expect(window.navigation.currentEntry?.getState()).toEqual({ guard: true })
  })

  it('keeps the top-frame source in sync during fragment-only Back and Forward', async (t) => {
    window.history.replaceState(null, '', '#old')
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let previousUrl = window.location.href
    await updateUrl('#new', { history: 'push' })
    let nextUrl = window.location.href

    await window.navigation.back().finished
    expect(window.location.href).toBe(previousUrl)
    expect(app.frames.top.src).toBe(previousUrl)
    expect(resolveFrame).not.toHaveBeenCalled()
    await window.navigation.forward().finished
    expect(window.location.href).toBe(nextUrl)
    expect(app.frames.top.src).toBe(nextUrl)
    expect(resolveFrame).not.toHaveBeenCalled()
    await window.navigation.back().finished
    await app.frames.top.reload()
    expect(resolveFrame.mock.calls[0]?.arguments[0]).toBe(previousUrl)
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

  it('leaves rendering to the application on Back without the Navigation API', async (t) => {
    stubGlobal(t, 'navigation', undefined)
    window.history.replaceState(null, '', '?variant=red')
    let heading = document.createElement('h1')
    heading.textContent = 'red'
    document.body.append(heading)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let previousUrl = window.location.href
    heading.textContent = 'blue'
    await updateUrl('?variant=blue', { history: 'push' })

    let popped = new Promise<void>((resolve) => {
      window.addEventListener(
        'popstate',
        () => {
          if (window.location.href === previousUrl) resolve()
        },
        { signal: t.signal },
      )
    })
    window.history.back()
    await popped

    expect(window.location.href).toBe(previousUrl)
    expect(app.frames.top.src).toBe(previousUrl)
    expect(heading.textContent).toBe('blue')
    expect(resolveFrame).not.toHaveBeenCalled()
    await app.frames.top.reload()
    expect(resolveFrame.mock.calls[0]?.arguments[0]).toBe(previousUrl)
  })

  it('keeps the current URL for an empty string even with a document base URL', async (t) => {
    window.history.replaceState(null, '', '?variant=empty#details')
    let base = document.createElement('base')
    base.href = '/another/base/'
    document.head.append(base)
    t.after(() => base.remove())
    let { app } = startApp(t)
    await app.ready()
    let href = window.location.href

    await updateUrl('')

    expect(window.location.href).toBe(href)
    expect(app.frames.top.src).toBe(href)
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

  it('applies updates waiting for the same navigation in call order', async (t) => {
    let { app, started, complete, resolveFrame } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending')
    await started
    let first = updateUrl('?variant=blue', { history: 'push' })
    let second = updateUrl('?variant=red', { history: 'push' })
    // Observe both rejections immediately so a failing implementation cannot leak one.
    let updates = Promise.allSettled([first, second])

    complete()
    await navigating
    expect(await updates).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ])
    expect(window.location.search).toBe('?variant=red')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    await window.navigation.back().finished
    expect(window.location.search).toBe('?variant=blue')
  })

  it('waits for the previous queued update native handler before applying the next URL', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending')
    await started
    let [intercepted, resolveIntercepted] = withResolvers<void>()
    let [handler, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({
          handler: () => {
            resolveIntercepted()
            return handler
          },
        })
      },
      { once: true, signal: listener.signal },
    )
    let first = updateUrl('?variant=blue', { history: 'push' })
    let second = updateUrl('?variant=red', { history: 'push' })
    let updates = Promise.all([first, second])

    complete()
    await navigating
    await intercepted
    expect(window.location.search).toBe('?variant=blue')
    finish()
    await updates
    expect(window.location.search).toBe('?variant=red')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('queues a call from the native commit before synchronizing the previous update', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let [precommit, commit] = withResolvers<void>()
    let [second, resolveSecond, rejectSecond] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      commit()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => event.intercept({ precommitHandler: () => precommit }),
      { once: true, signal: listener.signal },
    )
    window.navigation.addEventListener(
      'currententrychange',
      () => {
        void updateUrl('?variant=red', { history: 'push' }).then(resolveSecond, rejectSecond)
      },
      { once: true, signal: listener.signal },
    )
    let first = updateUrl('?variant=blue', { history: 'push' })
    let updates = Promise.all([first, second])

    commit()
    await updates
    expect(window.location.search).toBe('?variant=red')
    expect(app.frames.top.src).toBe(window.location.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({ src: window.location.href })
  })

  it('applies a queued successor after the previous committed native handler fails', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let [handler, finish, fail] = withResolvers<void>()
    let reason = new Error('Native handler failed after commit')
    let listener = new AbortController()
    t.after(() => {
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => event.intercept({ handler: () => handler }),
      { once: true, signal: listener.signal },
    )
    let first = updateUrl('?variant=blue')
    let second = updateUrl('?variant=red')
    let updates = Promise.allSettled([first, second])

    fail(reason)
    expect(await updates).toEqual([
      { status: 'rejected', reason },
      { status: 'fulfilled', value: undefined },
    ])
    expect(window.location.search).toBe('?variant=red')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('keeps a queued successor waiting after canceling an issued native precommit update', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let original = window.location.href
    let [precommit, commit] = withResolvers<void>()
    let [handler, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      commit()
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.intercept({ precommitHandler: () => precommit, handler: () => handler })
      },
      { once: true, signal: listener.signal },
    )
    let controller = new AbortController()
    let reason = new Error('Stale selection')
    let rejected = expect(updateUrl('?variant=blue', { signal: controller.signal })).rejects.toBe(
      reason,
    )
    let second = updateUrl('?variant=red')
    let transition = window.navigation.transition
    if (!transition) throw new Error('Expected native interception')

    controller.abort(reason)
    await rejected
    expect(window.location.href).toBe(original)
    commit()
    await transition.committed
    expect(window.location.search).toBe('?variant=blue')
    expect(app.frames.top.src).toBe(window.location.href)
    finish()
    await second
    expect(window.location.search).toBe('?variant=red')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('invalidates queued calls when an unrelated same-URL navigation interrupts an update', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let [handler, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => event.intercept({ handler: () => handler }),
      { once: true, signal: listener.signal },
    )
    let first = updateUrl('?variant=blue')
    let second = updateUrl('?variant=red')
    let updates = Promise.allSettled([first, second])
    let href = window.location.href

    await navigate(href, { history: 'replace' })
    let results = await updates
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    for (let result of results) {
      if (result.status !== 'rejected') throw new Error('Expected a rejected URL update')
      expect(result.reason).toHaveProperty('name', 'AbortError')
    }
    expect(window.location.href).toBe(href)
    expect(app.frames.top.src).toBe(href)
  })

  it('cancels one queued update without blocking later replacements', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending')
    await started
    let controller = new AbortController()
    let reason = new Error('Stale selection')
    let first = updateUrl('?variant=blue', { signal: controller.signal })
    let second = updateUrl('?variant=red')
    let updates = Promise.allSettled([first, second])

    controller.abort(reason)
    complete()
    await navigating
    expect(await updates).toEqual([
      { status: 'rejected', reason },
      { status: 'fulfilled', value: undefined },
    ])
    expect(window.location.search).toBe('?variant=red')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('rejects later queued updates when a native guard replaces the first update', async (t) => {
    let { app, started, complete } = startPendingApp(t)
    await app.ready()
    let navigating = navigate('?variant=pending')
    await started
    let first = updateUrl('?variant=blue')
    let second = updateUrl('?variant=red')
    let updates = Promise.allSettled([first, second])
    let listener = new AbortController()
    t.after(() => listener.abort())
    let guardState = { application: 'guard' }
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        event.preventDefault()
        window.history.replaceState(guardState, '', '?variant=guard')
        window.navigation.updateCurrentEntry({ state: guardState })
      },
      { once: true, signal: listener.signal },
    )

    complete()
    await navigating
    let results = await updates
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    for (let result of results) {
      if (result.status !== 'rejected') throw new Error('Expected a rejected URL update')
      expect(result.reason).toHaveProperty('name', 'AbortError')
    }
    expect(window.location.search).toBe('?variant=guard')
    expect(window.navigation.currentEntry?.getState()).toEqual(guardState)
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

  it('waits for a committed legacy reload that retains its current entry', async (t) => {
    let [pending, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(() => {
      finish()
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) => event.intercept({ handler: () => pending }),
      {
        once: true,
        signal: listener.signal,
      },
    )
    let reloading = window.navigation.reload()
    await reloading.committed
    let transition = window.navigation.transition
    if (!transition) throw new Error('Expected an active reload transition')
    Object.defineProperty(transition, 'to', { value: undefined })
    expect(transition.from.id).toBe(window.navigation.currentEntry?.id)
    let updating = updateUrl('?variant=after-reload')
    let result = updating.catch((error: unknown) => error)

    finish()
    await reloading.finished
    expect(await result).toBeUndefined()
    expect(window.location.search).toBe('?variant=after-reload')
  })

  it('rejects when precommit navigation changes the browser URL captured at invocation', async (t) => {
    let { started, commit, navigating } = startPrecommitNavigation(
      t,
      '/update-url/product?variant=pending',
    )
    await started
    let rejected = expect(updateUrl('details?variant=stale')).rejects.toHaveProperty(
      'name',
      'AbortError',
    )
    expect(window.location.href).toBe(originalHref)

    commit()
    await navigating.finished
    await rejected
    expect(window.location.pathname).toBe('/update-url/product')
    expect(window.location.search).toBe('?variant=pending')
  })

  it('waits for an uncommitted legacy navigation when the browser URL stays the same', async (t) => {
    let { started, commit, navigating } = startPrecommitNavigation(t, originalHref)
    await started
    let transition = window.navigation.transition
    if (!transition) throw new Error('Expected an active transition')
    Object.defineProperty(transition, 'to', { value: undefined })
    let updating = updateUrl('?variant=settled')
    let result = updating.catch((error: unknown) => error)

    commit()
    await navigating.finished
    expect(await result).toBeUndefined()
    expect(window.location.search).toBe('?variant=settled')
  })

  it('rejects a captured transition redirect that changes the browser URL', async (t) => {
    let { started, commit, navigating } = startPrecommitNavigation(
      t,
      '/update-url/requested',
      '/update-url/redirected',
    )
    await started
    let rejected = expect(updateUrl('?variant=stale')).rejects.toHaveProperty('name', 'AbortError')

    commit()
    await navigating.finished
    await rejected
    expect(window.location.pathname).toBe('/update-url/redirected')
    expect(window.location.search).toBe('')
  })

  it('allows a captured transition redirect that commits the browser URL from invocation', async (t) => {
    let { started, commit, navigating } = startPrecommitNavigation(
      t,
      '/update-url/requested',
      originalHref,
    )
    await started
    let updating = updateUrl('?variant=settled')
    let result = updating.catch((error: unknown) => error)

    commit()
    await navigating.finished
    expect(await result).toBeUndefined()
    expect(window.location.search).toBe('?variant=settled')
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
