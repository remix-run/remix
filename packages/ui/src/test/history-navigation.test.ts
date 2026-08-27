import { expect } from '@remix-run/assert'
import { describe, it, mock, type TestContext } from '@remix-run/test'
import type { FrameHandle } from '../runtime/component.ts'
import { startHistoryNavigationListenerImpl } from '../runtime/history-navigation.ts'
import { navigate } from '../runtime/navigation.ts'

interface TestReloadOptions {
  formData?: FormData
  method?: string
  encType?: string
  signal?: AbortSignal
}

describe('History API navigation', () => {
  it('runs programmatic navigation with frame state and replace history', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let namedFrame = { src: '' } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    startHistoryDriver(t, { topFrame, namedFrame, reloadFrame })

    let destination = new URL(window.location.href)
    destination.searchParams.set('history-navigation', 'programmatic')
    await navigate(destination.href, {
      history: 'replace',
      resetScroll: false,
      src: '/account/details',
      target: 'account',
    })

    expect(window.location.href).toBe(destination.href)
    expect(topFrame.src).toBe(destination.href)
    expect(namedFrame.src).toBe('/account/details')
    expect(reloadFrame).toHaveBeenCalledTimes(1)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(getHistoryNavigationState()).toEqual({
      target: 'account',
      src: '/account/details',
      resetScroll: false,
      $rmx: true,
    })
  })

  it('replaces exact same-URL navigation by default', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })
    let entryId = getHistoryNavigationEntryId()

    await navigate(window.location.href)

    expect(getHistoryNavigationEntryId()).toBe(entryId)
  })

  it('pushes exact same-URL links by default', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })
    let entryId = getHistoryNavigationEntryId()
    let anchor = document.createElement('a')
    anchor.href = window.location.href
    document.body.append(anchor)

    anchor.click()
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    expect(getHistoryNavigationEntryId()).not.toBe(entryId)
  })

  it('pushes exact same-URL GET forms by default', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })
    let entryId = getHistoryNavigationEntryId()
    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    document.body.append(form)

    form.requestSubmit()
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    expect(getHistoryNavigationEntryId()).not.toBe(entryId)
  })

  it('uses the composed click target and link attributes', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let namedFrame = { src: '' } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, namedFrame, reloadFrame })

    let destination = new URL(window.location.href)
    destination.searchParams.set('history-navigation', 'link')
    let anchor = document.createElement('a')
    anchor.href = destination.href
    anchor.setAttribute('data-rmx-history', 'replace')
    anchor.setAttribute('data-rmx-reset-scroll', 'false')
    anchor.setAttribute('data-rmx-src', '/link/details')
    anchor.setAttribute('data-rmx-target', 'details')
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.append(path)
    anchor.append(svg)
    document.body.append(anchor)

    let event = new MouseEvent('click', { bubbles: true, cancelable: true })
    path.dispatchEvent(event)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    expect(event.defaultPrevented).toBe(true)
    expect(window.location.href).toBe(destination.href)
    expect(namedFrame.src).toBe('/link/details')
    expect(getHistoryNavigationState()).toEqual({
      target: 'details',
      src: '/link/details',
      resetScroll: false,
      $rmx: true,
    })
  })

  it('handles links inside SVG', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    let anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a')
    anchor.setAttribute('href', '/svg-link')
    let circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    anchor.append(circle)
    svg.append(anchor)
    document.body.append(svg)
    let event = new MouseEvent('click', { bubbles: true, cancelable: true })

    circle.dispatchEvent(event)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    expect(event.defaultPrevented).toBe(true)
    expect(window.location.pathname).toBe('/svg-link')
  })

  it('builds GET destinations with the submitter', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let action = new URL(window.location.href)
    action.search = '?stale=true'
    action.hash = '#results'
    let form = document.createElement('form')
    form.action = action.href
    form.method = 'get'
    form.setAttribute('data-rmx-history', 'replace')
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'remix frames'
    let textarea = document.createElement('textarea')
    textarea.name = 'note'
    textarea.value = 'first\nsecond'
    let submitter = document.createElement('button')
    submitter.name = 'intent'
    submitter.value = 'search'
    form.append(input, textarea, submitter)
    document.body.append(form)

    form.requestSubmit(submitter)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    let destination = new URL(window.location.href)
    expect(destination.searchParams.get('stale')).toBe(null)
    expect(destination.searchParams.get('query')).toBe('remix frames')
    expect(destination.searchParams.get('intent')).toBe('search')
    expect(destination.searchParams.get('note')).toBe('first\r\nsecond')
    expect(destination.hash).toBe('#results')
    expect(topFrame.src).toBe(destination.href)
    let reloadOptions = reloadFrame.mock.calls[0]?.arguments[1]
    expect(reloadOptions?.method).toBe(undefined)
    expect(reloadOptions?.formData).toBe(undefined)
  })

  it('passes non-GET form data and submitter overrides to a named frame', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let namedFrame = { src: '' } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, namedFrame, reloadFrame })

    let destination = new URL(window.location.href)
    destination.searchParams.set('history-navigation', 'form')
    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'get'
    form.setAttribute('data-rmx-history', 'replace')
    let input = document.createElement('input')
    input.name = 'displayName'
    input.value = 'Ada'
    let submitter = document.createElement('button')
    submitter.name = 'intent'
    submitter.value = 'save'
    submitter.setAttribute('formmethod', 'post')
    submitter.setAttribute('formenctype', 'multipart/form-data')
    submitter.setAttribute('data-rmx-src', '/account/form')
    submitter.setAttribute('data-rmx-target', 'account')
    form.append(input, submitter)
    document.body.append(form)

    form.requestSubmit(submitter)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    expect(window.location.href).toBe(destination.href)
    expect(topFrame.src).toBe(destination.href)
    expect(namedFrame.src).toBe('/account/form')
    let reloadOptions = reloadFrame.mock.calls[0]?.arguments[1]
    expect(reloadOptions?.method).toBe('post')
    expect(reloadOptions?.encType).toBe('multipart/form-data')
    expect(reloadOptions?.formData?.get('displayName')).toBe('Ada')
    expect(reloadOptions?.formData?.get('intent')).toBe('save')
    expect(reloadOptions?.signal).toBeInstanceOf(AbortSignal)
  })

  it('replaces top-frame redirects without reloading a second time', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let redirectedTo = new URL(window.location.href)
    redirectedTo.searchParams.set('history-navigation', 'redirected')
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
      redirectedTo: redirectedTo.href,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    await navigate('/requested', { history: 'replace' })

    expect(reloadFrame).toHaveBeenCalledTimes(1)
    expect(window.location.href).toBe(redirectedTo.href)
    expect(topFrame.src).toBe(redirectedTo.href)
    expect(getHistoryNavigationState()).toEqual({
      target: undefined,
      src: redirectedTo.href,
      resetScroll: true,
      $rmx: true,
    })
  })

  it('preserves manual scrolling across top-frame redirects', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
      redirectedTo: '/redirected',
    }))
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    startHistoryDriver(t, { topFrame, reloadFrame })

    await navigate('/requested', { history: 'replace', resetScroll: false })

    expect(window.location.pathname).toBe('/redirected')
    expect(scrollTo).not.toHaveBeenCalled()
    expect(getHistoryNavigationState()).toEqual({
      target: undefined,
      src: new URL('/redirected', window.location.href).href,
      resetScroll: false,
      $rmx: true,
    })
  })

  it('keeps the public URL when a named frame redirects', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let namedFrame = { src: '' } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
      redirectedTo: '/redirected-frame',
    }))
    startHistoryDriver(t, { topFrame, namedFrame, reloadFrame })

    let destination = new URL(window.location.href)
    destination.searchParams.set('history-navigation', 'named-redirect')
    await navigate(destination.href, {
      history: 'replace',
      src: '/requested-frame',
      target: 'details',
    })

    expect(window.location.href).toBe(destination.href)
    expect(topFrame.src).toBe(destination.href)
    expect(namedFrame.src).toBe('/requested-frame')
    expect(reloadFrame).toHaveBeenCalledTimes(1)
  })

  it('aborts a stale transition before committing its redirect', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let firstSignal: AbortSignal | undefined
    let reloadFrame = mock.fn(async (_frame: FrameHandle, options?: { signal?: AbortSignal }) => {
      if (reloadFrame.mock.calls.length === 1) {
        firstSignal = options?.signal
        await new Promise<void>((resolve) =>
          firstSignal?.addEventListener('abort', () => resolve()),
        )
        return {
          signal: firstSignal ?? new AbortController().signal,
          redirectedTo: '/stale-redirect',
        }
      }
      return { signal: options?.signal ?? new AbortController().signal }
    })
    startHistoryDriver(t, { topFrame, reloadFrame })

    let firstNavigation = navigate('/first', { history: 'replace' })
    await waitFor(() => firstSignal !== undefined)
    await navigate('/second', { history: 'replace' })

    let firstError: unknown
    try {
      await firstNavigation
    } catch (error) {
      firstError = error
    }

    expect(firstSignal?.aborted).toBe(true)
    expect(firstError).toBeInstanceOf(DOMException)
    if (!(firstError instanceof DOMException)) throw new Error('Expected an aborted navigation')
    expect(firstError.name).toBe('AbortError')
    expect(window.location.pathname).toBe('/second')
    expect(topFrame.src).toBe(new URL('/second', window.location.href).href)
  })

  it('does not let an older focus reset commit after it starts a new navigation', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let secondNavigation: Promise<void> | undefined
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => {
      if (new URL(topFrame.src).pathname === '/first-focus') {
        let autofocus = document.createElement('input')
        autofocus.setAttribute('autofocus', '')
        autofocus.addEventListener(
          'focus',
          () => {
            secondNavigation = navigate('/second-focus', { history: 'replace' })
          },
          { once: true },
        )
        document.body.append(autofocus)
      }
      return { signal: new AbortController().signal }
    })
    startHistoryDriver(t, { topFrame, reloadFrame })

    let firstNavigation = navigate('/first-focus', { history: 'replace' })
    let firstError: unknown
    try {
      await firstNavigation
    } catch (error) {
      firstError = error
    }
    await secondNavigation

    expect(firstError).toBeInstanceOf(DOMException)
    expect(window.location.pathname).toBe('/second-focus')
    expect(topFrame.src).toBe(new URL('/second-focus', window.location.href).href)
  })

  it('rejects failed programmatic navigation and allows the next navigation', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let failure = new Error('Route failed')
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => {
      if (new URL(topFrame.src).pathname === '/failed') throw failure
      return { signal: new AbortController().signal }
    })
    startHistoryDriver(t, { topFrame, reloadFrame })

    let error: unknown
    try {
      await navigate('/failed', { history: 'replace' })
    } catch (caught) {
      error = caught
    }
    await navigate('/recovered', { history: 'replace' })

    expect(error).toBe(failure)
    expect(window.location.pathname).toBe('/recovered')
  })

  it('restores traversal state and scroll after frame work finishes', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    startHistoryDriver(t, { topFrame, reloadFrame })

    await navigate('/first', { history: 'push' })
    await navigate('/second', { history: 'push' })
    window.history.back()
    await waitFor(() => reloadFrame.mock.calls.length === 3)

    expect(window.location.pathname).toBe('/first')
    expect(topFrame.src).toBe(new URL('/first', window.location.href).href)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('preserves unrelated history state and resets focus after completion', async (t) => {
    window.history.replaceState({ owner: 'app' }, '', window.location.href)
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => {
      let autofocus = document.createElement('input')
      autofocus.setAttribute('autofocus', '')
      document.body.append(autofocus)
      return { signal: new AbortController().signal }
    })
    startHistoryDriver(t, { topFrame, reloadFrame })

    await navigate('/focused', { history: 'replace' })

    expect(Reflect.get(window.history.state, 'owner')).toBe('app')
    expect(document.activeElement?.hasAttribute('autofocus')).toBe(true)
  })

  it('preserves unrelated history state when pushing a new entry', async (t) => {
    window.history.replaceState({ owner: 'app' }, '', window.location.href)
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    await navigate('/pushed', { history: 'push' })

    expect(Reflect.get(window.history.state, 'owner')).toBe('app')
  })

  it('restores scroll after layout-driven scroll events during a transition', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let finishReload: (() => void) | undefined
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => {
      await new Promise<void>((resolve) => {
        finishReload = resolve
      })
      return { signal: new AbortController().signal }
    })
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    startHistoryDriver(t, { topFrame, reloadFrame })

    let navigation = navigate('/layout-scroll', { history: 'replace' })
    await waitFor(() => finishReload !== undefined)
    window.dispatchEvent(new Event('scroll'))
    finishReload?.()
    await navigation

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('does not overwrite user scroll during a transition', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let finishReload: (() => void) | undefined
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => {
      await new Promise<void>((resolve) => {
        finishReload = resolve
      })
      return { signal: new AbortController().signal }
    })
    let scrollTo = t.mock.method(window, 'scrollTo', () => {})
    startHistoryDriver(t, { topFrame, reloadFrame })

    let navigation = navigate('/user-scroll', { history: 'replace' })
    await waitFor(() => finishReload !== undefined)
    window.dispatchEvent(new WheelEvent('wheel'))
    finishReload?.()
    await navigation

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('falls back to event.target when composedPath is unavailable', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let anchor = document.createElement('a')
    anchor.href = '/event-target'
    let child = document.createElement('span')
    anchor.append(child)
    document.body.append(anchor)
    let event = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'composedPath', { value: undefined })

    child.dispatchEvent(event)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    expect(event.defaultPrevented).toBe(true)
    expect(window.location.pathname).toBe('/event-target')
  })

  it('includes image submit coordinates in form data', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let form = document.createElement('form')
    form.action = '/image-submit'
    form.method = 'post'
    let submitter = document.createElement('input')
    submitter.type = 'image'
    submitter.name = 'save'
    form.append(submitter)
    document.body.append(form)

    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperties(click, {
      offsetX: { value: 7 },
      offsetY: { value: 11 },
    })
    submitter.dispatchEvent(click)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    let formData = reloadFrame.mock.calls[0]?.arguments[1]?.formData
    expect(formData?.get('save.x')).toBe('7')
    expect(formData?.get('save.y')).toBe('11')
  })

  it('does not reuse image coordinates from a canceled click', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let form = document.createElement('form')
    form.action = '/image-submit'
    form.method = 'post'
    let submitter = document.createElement('input')
    submitter.type = 'image'
    submitter.name = 'save'
    submitter.addEventListener('click', (event) => event.preventDefault(), { once: true })
    form.append(submitter)
    document.body.append(form)
    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperties(click, {
      offsetX: { value: 7 },
      offsetY: { value: 11 },
    })

    submitter.dispatchEvent(click)
    await Promise.resolve()
    form.requestSubmit(submitter)
    await waitFor(() => reloadFrame.mock.calls.length === 1)

    let formData = reloadFrame.mock.calls[0]?.arguments[1]?.formData
    expect(formData?.get('save.x')).toBe('0')
    expect(formData?.get('save.y')).toBe('0')
  })

  it('honors application form cancellation', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    let form = document.createElement('form')
    form.addEventListener('submit', (event) => event.preventDefault())
    document.body.append(form)
    startHistoryDriver(t, { topFrame, reloadFrame })

    form.requestSubmit()
    await Promise.resolve()

    expect(reloadFrame).not.toHaveBeenCalled()
  })

  it('honors application form cancellation from an earlier window listener', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    let form = document.createElement('form')
    document.body.append(form)
    window.addEventListener('submit', (event) => event.preventDefault(), {
      once: true,
    })
    startHistoryDriver(t, { topFrame, reloadFrame })

    form.requestSubmit()
    await Promise.resolve()

    expect(reloadFrame).not.toHaveBeenCalled()
  })

  it('leaves invalid forms to native constraint validation', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    let form = document.createElement('form')
    let input = document.createElement('input')
    input.required = true
    form.append(input)
    document.body.append(form)
    startHistoryDriver(t, { topFrame, reloadFrame })

    form.requestSubmit()
    await Promise.resolve()

    expect(input.matches(':invalid')).toBe(true)
    expect(reloadFrame).not.toHaveBeenCalled()
  })

  it('uses POST history defaults and data-rmx-history overrides', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let sameUrlForm = document.createElement('form')
    sameUrlForm.action = window.location.href
    sameUrlForm.method = 'post'
    document.body.append(sameUrlForm)
    let initialEntryId = getHistoryNavigationEntryId()

    sameUrlForm.requestSubmit()
    await waitFor(() => reloadFrame.mock.calls.length === 1)
    expect(getHistoryNavigationEntryId()).toBe(initialEntryId)

    sameUrlForm.setAttribute('data-rmx-history', 'push')
    sameUrlForm.requestSubmit()
    await waitFor(() => reloadFrame.mock.calls.length === 2)
    let pushedEntryId = getHistoryNavigationEntryId()
    expect(pushedEntryId).not.toBe(initialEntryId)

    let differentUrlForm = document.createElement('form')
    differentUrlForm.action = '/different-post'
    differentUrlForm.method = 'post'
    document.body.append(differentUrlForm)
    differentUrlForm.requestSubmit()
    await waitFor(() => reloadFrame.mock.calls.length === 3)

    expect(window.location.pathname).toBe('/different-post')
    expect(getHistoryNavigationEntryId()).not.toBe(pushedEntryId)
  })

  it('leaves interactions hidden from delegated events to native browser behavior', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let stoppedAnchor = document.createElement('a')
    stoppedAnchor.href = '#stopped-link'
    stoppedAnchor.addEventListener('click', (event) => event.stopPropagation())
    document.body.append(stoppedAnchor)
    stoppedAnchor.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.location.hash).toBe('#stopped-link')

    let host = document.createElement('div')
    let closedRoot = host.attachShadow({ mode: 'closed' })
    let closedAnchor = document.createElement('a')
    closedAnchor.href = '#closed-shadow-link'
    closedRoot.append(closedAnchor)
    document.body.append(host)
    closedAnchor.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.location.hash).toBe('#closed-shadow-link')

    expect(reloadFrame).not.toHaveBeenCalled()
  })

  it('leaves opted-out links and forms to native navigation', async (t) => {
    let topFrame = { src: window.location.href } as FrameHandle
    let reloadFrame = mock.fn(async (_frame: FrameHandle, _options?: TestReloadOptions) => ({
      signal: new AbortController().signal,
    }))
    startHistoryDriver(t, { topFrame, reloadFrame })

    let preventDocumentNavigation = (event: Event) => event.preventDefault()
    window.addEventListener('click', preventDocumentNavigation)
    window.addEventListener('submit', preventDocumentNavigation)
    t.after(() => {
      window.removeEventListener('click', preventDocumentNavigation)
      window.removeEventListener('submit', preventDocumentNavigation)
    })

    let anchor = document.createElement('a')
    anchor.href = '/document-link'
    anchor.setAttribute('data-rmx-document', '')
    let form = document.createElement('form')
    form.action = '/document-form'
    form.setAttribute('data-rmx-document', '')
    let base = document.createElement('base')
    base.target = '_blank'
    let baseTargetAnchor = document.createElement('a')
    baseTargetAnchor.href = '/base-target-link'
    baseTargetAnchor.target = ''
    let noHrefAnchor = document.createElement('a')
    let blobAnchor = document.createElement('a')
    let blobUrl = URL.createObjectURL(new Blob(['document']))
    blobAnchor.href = blobUrl
    t.after(() => URL.revokeObjectURL(blobUrl))
    let crossOriginAnchor = document.createElement('a')
    crossOriginAnchor.href = 'https://example.com/document-link'
    let downloadAnchor = document.createElement('a')
    downloadAnchor.href = '/report.csv'
    downloadAnchor.download = ''
    let targetedAnchor = document.createElement('a')
    targetedAnchor.href = '/targeted-link'
    targetedAnchor.target = '_blank'
    let baseTargetForm = document.createElement('form')
    baseTargetForm.action = '/base-target-form'
    baseTargetForm.target = ''
    let submitterTargetForm = document.createElement('form')
    submitterTargetForm.action = '/submitter-base-target-form'
    submitterTargetForm.target = '_self'
    let submitterTargetButton = document.createElement('button')
    submitterTargetButton.setAttribute('formtarget', '')
    submitterTargetForm.append(submitterTargetButton)
    document.head.append(base)
    t.after(() => base.remove())
    document.body.append(
      anchor,
      form,
      baseTargetAnchor,
      noHrefAnchor,
      blobAnchor,
      crossOriginAnchor,
      downloadAnchor,
      targetedAnchor,
      baseTargetForm,
      submitterTargetForm,
    )

    anchor.click()
    form.requestSubmit()
    baseTargetAnchor.click()
    noHrefAnchor.click()
    blobAnchor.click()
    crossOriginAnchor.click()
    downloadAnchor.click()
    targetedAnchor.click()
    baseTargetForm.requestSubmit()
    submitterTargetForm.requestSubmit(submitterTargetButton)
    await Promise.resolve()

    expect(reloadFrame).not.toHaveBeenCalled()
  })
})

function startHistoryDriver(
  t: TestContext,
  options: {
    topFrame: FrameHandle
    namedFrame?: FrameHandle
    reloadFrame: (
      frame: FrameHandle,
      options?: TestReloadOptions,
    ) => Promise<{ signal: AbortSignal; redirectedTo?: string }>
  },
): void {
  let originalUrl = window.location.href
  let originalState = window.history.state
  let originalBody = document.body.innerHTML
  let controller = new AbortController()
  startHistoryNavigationListenerImpl(controller.signal, {
    getTopFrame: () => options.topFrame,
    getNamedFrame: () => options.namedFrame,
    reloadFrame: options.reloadFrame,
  })
  t.after(() => {
    controller.abort()
    window.history.replaceState(originalState, '', originalUrl)
    document.body.innerHTML = originalBody
  })
}

function getHistoryNavigationState(): unknown {
  let state = window.history.state
  if (typeof state !== 'object' || state === null) return
  let entry = Reflect.get(state, '__remixNavigation')
  if (typeof entry !== 'object' || entry === null) return
  return Reflect.get(entry, 'navigation')
}

function getHistoryNavigationEntryId(): unknown {
  let state = window.history.state
  if (typeof state !== 'object' || state === null) return
  let entry = Reflect.get(state, '__remixNavigation')
  if (typeof entry !== 'object' || entry === null) return
  return Reflect.get(entry, 'id')
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('Timed out waiting for browser navigation')
}
