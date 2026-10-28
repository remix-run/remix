import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type TestContext } from '@remix-run/test'
import { navigate, replaceUrl, run } from '../index.ts'
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

    replaceUrl(destination.search)

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

    replaceUrl(`#${target.id}`)

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
    replaceUrl(replacement.href)

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

    replaceUrl(destination.search)

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

    replaceUrl(destination.search)

    expect(window.location.href).toBe(destination.href)
    expect(app.frames.top.src).toBe(destination.href)
    expect(window.navigation.currentEntry?.getState()).toMatchObject({
      $rmx: true,
      src: destination.href,
    })
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('preserves non-Remix state when used without a running app', () => {
    window.history.replaceState({ application: 'history-state' }, '', window.location.href)
    window.navigation.updateCurrentEntry({ state: { application: 'navigation-state' } })
    let destination = new URL('?variant=standalone', window.location.href)

    replaceUrl(destination.search)

    expect(window.location.href).toBe(destination.href)
    expect(window.history.state).toEqual({ application: 'history-state' })
    expect(window.navigation.currentEntry?.getState()).toEqual({ application: 'navigation-state' })
  })

  it('rejects cross-origin replacements without changing the URL or frame source', async (t) => {
    let { app, resolveFrame } = startApp(t)
    await app.ready()

    expect(() => replaceUrl('https://another-origin.example/product')).toThrow(DOMException)

    expect(window.location.href).toBe(originalHref)
    expect(app.frames.top.src).toBe(originalHref)
    expect(resolveFrame).not.toHaveBeenCalled()
  })

  it('rejects replacement during a navigation without aborting its frame load', async (t) => {
    let [started, resolveStarted] = withResolvers<AbortSignal>()
    let [pending, resolvePending] = withResolvers<void>()
    let calls = 0
    let app = run({
      loadModule: mock.fn(),
      async resolveFrame(_src, options) {
        calls++
        if (!options?.signal) throw new Error('Expected a navigation signal')
        resolveStarted(options.signal)
        await pending
        return '<html><head></head><body><h1>Loaded</h1></body></html>'
      },
    })
    await app.ready()
    let destination = new URL('?variant=pending', window.location.href)
    let navigating = navigate(destination.href)
    try {
      let signal = await started

      expect(() => replaceUrl('?variant=interrupted')).toThrow(
        'Cannot replace the URL during a navigation',
      )
      expect(signal.aborted).toBe(false)
      expect(window.location.href).toBe(destination.href)
      resolvePending()
      await navigating

      replaceUrl('?variant=settled')
      expect(window.location.search).toBe('?variant=settled')
      expect(calls).toBe(1)
    } finally {
      resolvePending()
      await navigating.catch(() => {})
      app.dispose()
    }
  })
})
