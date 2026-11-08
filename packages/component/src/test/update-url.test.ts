import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { navigate, updateUrl, run } from '../index.ts'
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

async function startPendingNavigation(t: TestContext) {
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
  await app.ready()
  let navigating = navigate('?variant=pending')
  void navigating.catch(() => {})
  return { app, navigating, signal: await started, complete, rejectPending, resolveFrame }
}

function stubGlobal(t: TestContext, name: string, value: unknown): void {
  let descriptor = Object.getOwnPropertyDescriptor(window, name)
  Object.defineProperty(window, name, { configurable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(window, name, descriptor)
    else Reflect.deleteProperty(window, name)
  })
}

async function expectAbortedUpdate(updating: Promise<AbortSignal>, reason?: unknown) {
  let signal = await updating
  expect(signal.aborted).toBe(true)
  if (reason !== undefined) expect(signal.reason).toBe(reason)
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

  it('replaces the URL synchronously, preserves state, and keeps reloads in sync', async (t) => {
    window.history.replaceState({ application: 'preserved' }, '', window.location.href)
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    window.navigation.updateCurrentEntry({
      state: { $rmx: true, src: '/partials/details', target: 'details', custom: 'preserved' },
    })
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
      custom: 'preserved',
    })
    expect(app.frames.top.src).toBe(destination.href)
    expect(resolveFrame).not.toHaveBeenCalled()
    await updating

    await app.frames.top.reload()
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(resolveFrame.mock.calls[0]?.arguments[0]).toBe(destination.href)
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
    expect(previousEntry.getState()).toEqual(previousState)
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

  it('preserves scroll/focus for fragment updates and keeps Back native', async (t) => {
    window.history.replaceState(null, '', '#old')
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let previousUrl = window.location.href
    let input = document.createElement('input')
    let spacer = document.createElement('div')
    spacer.style.height = '3000px'
    document.body.append(input, spacer)
    input.focus()
    window.scrollTo({ left: 0, top: 100, behavior: 'instant' })

    await updateUrl('#new', { history: 'push' })

    expect(window.scrollY).toBe(100)
    expect(document.activeElement).toBe(input)
    expect(app.frames.top.src).toBe(window.location.href)
    await window.navigation.back().finished
    expect(window.location.href).toBe(previousUrl)
    expect(app.frames.top.src).toBe(previousUrl)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('completes consecutive idle calls synchronously and keeps successful signals non-aborted', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let controller = new AbortController()
    let first = updateUrl('?variant=blue', { signal: controller.signal })
    expect(window.location.search).toBe('?variant=blue')
    let second = updateUrl('?variant=red')
    expect(window.location.search).toBe('?variant=red')
    let [firstSignal, secondSignal] = await Promise.all([first, second])

    controller.abort(new Error('Later cancellation'))
    expect(firstSignal.aborted).toBe(false)
    expect(secondSignal.aborted).toBe(false)
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('returns an aborted signal when a native listener cancels an update', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()
    let href = window.location.href
    let entry = window.navigation.currentEntry
    let state = entry?.getState()
    window.navigation.addEventListener('navigate', (event) => event.preventDefault(), {
      once: true,
      signal: t.signal,
    })

    await expectAbortedUpdate(updateUrl('?variant=blocked', { history: 'push' }))

    expect(window.location.href).toBe(href)
    expect(window.navigation.currentEntry).toBe(entry)
    expect(entry?.getState()).toEqual(state)
    expect(app.frames.top.src).toBe(href)
    expect(resolveFrame).not.toHaveBeenCalled()
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

    await expectAbortedUpdate(updateUrl('?variant=requested'))

    expect(window.location.href).toBe(guard.href)
    expect(window.history.state).toEqual(guardState)
    expect(window.navigation.currentEntry?.getState()).toEqual(guardState)
  })

  it('rejects native interception without waiting for its postcommit handler', async (t) => {
    let { app } = startApp(t)
    await app.ready()
    let original = window.location.href
    let [handler, finish] = withResolvers<void>()
    let listener = new AbortController()
    t.after(async () => {
      let transition = window.navigation.transition
      finish()
      await transition?.finished.catch(() => {})
      listener.abort()
    })
    window.navigation.addEventListener(
      'navigate',
      (event) =>
        event.intercept({ handler: () => handler, scroll: 'manual', focusReset: 'manual' }),
      { once: true, signal: listener.signal },
    )

    await expect(updateUrl('?variant=intercepted')).rejects.toHaveProperty(
      'name',
      'NotSupportedError',
    )
    expect(window.location.search).toBe('?variant=intercepted')
    expect(app.frames.top.src).toBe(original)
  })

  it('works without the Navigation API and keeps the top-frame source in sync', async (t) => {
    stubGlobal(t, 'navigation', undefined)
    let { app } = startApp(t)
    await app.ready()
    let destination = new URL('?variant=fallback', window.location.href)

    await updateUrl(destination.search, { history: 'push' })

    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
  })

  it('resolves relative URLs against the document base and treats an empty URL as unchanged', async (t) => {
    let base = document.createElement('base')
    base.href = '/another/base/'
    document.head.append(base)
    t.after(() => base.remove())
    let { app } = startApp(t)
    await app.ready()
    let destination = new URL('product?variant=blue', base.href)

    await updateUrl('product?variant=blue')
    await updateUrl('')

    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
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

  it('waits for navigation and applies only the latest call', async (t) => {
    let { app, navigating, signal, complete, resolveFrame } = await startPendingNavigation(t)
    let index = window.navigation.currentEntry?.index
    if (index === undefined) throw new Error('Expected a current entry')
    let first = updateUrl('?variant=blue', { history: 'push' })
    let last = updateUrl('?variant=red', { history: 'push' })
    let updates = Promise.all([first, last])
    expect(window.location.search).toBe('?variant=pending')
    expect(signal.aborted).toBe(false)
    window.navigation.updateCurrentEntry({
      state: { $rmx: true, src: '/stale', target: 'details', custom: 'destination' },
    })

    complete()
    await navigating
    let [superseded, updated] = await updates
    expect(superseded.aborted).toBe(true)
    expect(updated.aborted).toBe(false)
    expect(window.location.search).toBe('?variant=red')
    expect(window.navigation.currentEntry?.index).toBe(index + 1)
    expect(window.navigation.currentEntry?.getState()).toEqual({
      $rmx: true,
      src: window.location.href,
      target: undefined,
      custom: 'destination',
    })
    expect(app.frames.top.src).toBe(window.location.href)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
  })

  it('cancels waiting work without aborting navigation or reviving superseded calls', async (t) => {
    let { app, navigating, signal, complete } = await startPendingNavigation(t)
    let first = updateUrl('?variant=blue')
    let controller = new AbortController()
    let reason = new Error('Stale selection')
    let last = updateUrl('?variant=red', { signal: controller.signal })
    let updates = Promise.all([first, last])

    controller.abort(reason)
    let [superseded, canceled] = await updates
    expect(superseded.aborted).toBe(true)
    expect(canceled.aborted).toBe(true)
    expect(canceled.reason).toBe(reason)
    expect(signal.aborted).toBe(false)
    complete()
    await navigating
    expect(window.location.search).toBe('?variant=pending')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('does not supersede a pending update with an already aborted call', async (t) => {
    let { app, navigating, complete } = await startPendingNavigation(t)
    let first = updateUrl('?variant=blue')
    let reason = new Error('Already canceled')

    await expectAbortedUpdate(
      updateUrl('?variant=red', { signal: AbortSignal.abort(reason) }),
      reason,
    )
    complete()
    await navigating
    expect((await first).aborted).toBe(false)
    expect(window.location.search).toBe('?variant=blue')
    expect(app.frames.top.src).toBe(window.location.href)
  })

  it('aborts when precommit navigation changes the captured browser URL', async (t) => {
    let [precommit, commit] = withResolvers<void>()
    window.navigation.addEventListener(
      'navigate',
      (event) => event.intercept({ precommitHandler: () => precommit }),
      { once: true, signal: t.signal },
    )
    let navigating = window.navigation.navigate('/update-url/product?variant=pending')
    t.after(async () => {
      commit()
      await navigating.finished?.catch(() => {})
    })
    let updating = updateUrl('?variant=stale')
    expect(window.location.href).toBe(originalHref)

    commit()
    await navigating.finished
    await expectAbortedUpdate(updating)
    expect(window.location.pathname).toBe('/update-url/product')
    expect(window.location.search).toBe('?variant=pending')
  })

  it('aborts on an unrelated navigation even when its URL is unchanged', async (t) => {
    let { app, navigating, complete } = await startPendingNavigation(t)
    let href = window.location.href
    let updating = updateUrl('?variant=stale')
    let replacement = navigate(href, { history: 'replace' })

    await expectAbortedUpdate(updating)
    complete()
    await replacement
    await navigating.catch(() => {})
    expect(window.location.href).toBe(href)
    expect(app.frames.top.src).toBe(href)
  })

  it('propagates genuine navigation failures even when named AbortError', async (t) => {
    let { app, navigating, rejectPending } = await startPendingNavigation(t)
    app.addEventListener('error', (event) => event.preventDefault())
    let reason = new DOMException('Resolver failed without cancellation', 'AbortError')
    let rejected = expect(updateUrl('?variant=stale')).rejects.toBe(reason)

    rejectPending(reason)
    await rejected
    await navigating.catch(() => {})
    expect(window.location.search).toBe('?variant=pending')
  })
})
