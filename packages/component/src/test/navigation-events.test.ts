import { expect } from '@remix-run/assert'
import { describe, it, mock, type TestContext } from '@remix-run/test'

import { Frame, navigate, run, updateUrl } from '../index.ts'
import type { NavigationEvent, ResolveFrame, ResolveFrameOptions } from '../index.ts'
import { jsx } from '../jsx-runtime.ts'

async function setup(t: TestContext, resolveFrame: ResolveFrame) {
  let initialUrl = window.location.href
  document.body.innerHTML = '<main>Initial</main>'
  let app = run({ loadModule: mock.fn(), resolveFrame })
  let events: NavigationEvent[] = []
  window.addEventListener('rmx:navigation', (event) => events.push(event), {
    capture: true,
    signal: t.signal,
  })
  app.addEventListener('error', () => {})
  t.after(() => {
    app.dispose()
    document.body.replaceChildren()
    window.history.replaceState(null, '', initialUrl)
  })
  await app.ready()
  return { app, events }
}

describe('rmx:navigation', () => {
  it('shares completion with the source event through redirects, URL, and focus handling', async (t) => {
    let finalUrl = new URL('?navigation=final', window.location.href).href
    let response = new Response(
      '<!doctype html><html><head></head><body><main><input id="destination-focus" autofocus></main></body></html><!-- rmx:flush document -->',
    )
    Object.defineProperties(response, {
      url: { value: finalUrl },
      redirected: { value: true },
    })
    let loads: Array<ResolveFrameOptions | undefined> = []
    let { events } = await setup(t, (_src, options) => {
      loads.push(options)
      return response
    })
    let release = Promise.withResolvers<void>()
    let redirectStarted = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        if (event.destination.url !== finalUrl) return
        event.intercept({
          handler() {
            redirectStarted.resolve()
            return release.promise
          },
        })
      },
      { signal: t.signal },
    )
    let anchor = document.createElement('a')
    anchor.href = '?navigation=redirect'
    document.body.append(anchor)
    let local: NavigationEvent | undefined
    anchor.addEventListener('rmx:navigation', (event) => {
      local = event
      event.stopPropagation()
    })
    let accepted = Promise.withResolvers<NavigationEvent>()
    window.addEventListener('rmx:navigation', accepted.resolve, {
      once: true,
      capture: true,
      signal: t.signal,
    })

    let from = window.navigation.currentEntry
    anchor.click()
    let original = await accepted.promise
    expect(original).toBeInstanceOf(Event)
    expect('detail' in original).toBe(false)
    expect(original.target).toBe(anchor)
    expect(original.frameTarget).toBe(undefined)
    expect(original.frameSrc).toBe(anchor.href)
    expect(original.to).toBe(anchor.href)
    expect(original.from).toBe(from)
    expect(original?.element).toBe(anchor)
    expect(original?.navigationType).toBe('push')
    let finished = false
    void original?.finished.then(() => (finished = true))
    await redirectStarted.promise

    expect(events).toHaveLength(2)
    expect(events[1]?.to).toBe(finalUrl)
    expect(events[1]?.frameSrc).toBe(original.frameSrc)
    expect(events[1]?.signal).toBe(original.signal)
    expect(original.to).toBe(anchor.href)
    expect(events[1]?.navigationType).toBe('push')
    expect(events[1]?.from).toBe(from)
    expect(loads).toHaveLength(1)
    expect(loads[0]?.navigationType).toBe(original.navigationType)
    expect(loads[0]?.from).toBe(original.from)
    expect(loads[0]?.target).toBe(original.frameTarget)
    expect(events[1]?.finished).toBe(original?.finished)
    expect(local).toBe(original)
    expect(local?.finished).toBe(original?.finished)
    expect(events[1]?.target).toBe(window)
    expect(original?.signal.aborted).toBe(false)
    expect(finished).toBe(false)
    release.resolve()
    let outcome = await original?.finished

    expect(outcome?.aborted).toBe(false)
    expect(window.location.href).toBe(finalUrl)
    expect(document.activeElement?.id).toBe('destination-focus')
  })

  it('announces accepted programmatic navigations synchronously and excludes frame reloads and URL updates', async (t) => {
    let { app, events } = await setup(
      t,
      () =>
        '<!doctype html><html><head></head><body><main>Updated</main></body></html><!-- rmx:flush document -->',
    )
    let seen: NavigationEvent | undefined
    window.navigation.addEventListener('navigate', () => (seen = events.at(-1)), {
      once: true,
      signal: t.signal,
    })
    let loading = navigate('?navigation=programmatic')
    expect(events).toHaveLength(1)
    expect(seen).toBe(events[0])
    expect(events[0]?.element).toBe(null)
    expect(events[0]?.frameTarget).toBe(undefined)
    await loading
    await events[0]?.finished
    await app.frames.top.reload()
    await updateUrl('?navigation=url-only')
    expect(events).toHaveLength(1)
    expect(events[0]?.signal.aborted).toBe(false)
  })

  it('notifies window before a detached source and preserves its form metadata', async (t) => {
    let form = document.createElement('form')
    form.method = 'post'
    form.action = '?navigation=detached'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    form.append(button)
    window.navigation.addEventListener('navigate', () => form.remove(), {
      once: true,
      signal: t.signal,
    })
    let { events } = await setup(t, () => '<html><head></head><body>Saved</body></html>')
    document.body.append(form)
    let local: NavigationEvent | undefined
    button.addEventListener('rmx:navigation', (event) => {
      expect(events).toHaveLength(1)
      local = event
    })
    let accepted = Promise.withResolvers<NavigationEvent>()
    window.addEventListener('rmx:navigation', accepted.resolve, {
      once: true,
      capture: true,
      signal: t.signal,
    })

    form.requestSubmit(button)
    let event = await accepted.promise
    await event.finished

    expect(events).toHaveLength(1)
    expect(event.target).toBe(window)
    expect(event.element).toBe(form)
    expect(event.submitter).toBe(button)
    expect(event.formData?.get('intent')).toBe('save')
    expect(local?.finished).toBe(event.finished)
  })

  it('captures a link navigation across a shadow root', async (t) => {
    let { events } = await setup(t, () => '<html><head></head><body>Next</body></html>')
    let host = document.createElement('div')
    let shadow = host.attachShadow({ mode: 'closed' })
    let anchor = document.createElement('a')
    anchor.href = '?navigation=shadow'
    shadow.append(anchor)
    document.body.append(host)
    let accepted = Promise.withResolvers<NavigationEvent>()
    window.addEventListener('rmx:navigation', accepted.resolve, {
      once: true,
      capture: true,
      signal: t.signal,
    })

    anchor.click()
    let event = await accepted.promise
    await event.finished

    expect(events).toHaveLength(1)
    expect(event.element).toBe(anchor)
    expect(event.composed).toBe(true)
  })

  it('settles superseded and disposed navigations without waiting for their resolver', async (t) => {
    let blocked = Promise.withResolvers<string>()
    t.after(() => blocked.resolve('<main>Late</main>'))
    let { app, events } = await setup(t, (src) =>
      src.includes('blocked')
        ? blocked.promise
        : '<!doctype html><html><head></head><body><main>Next</main></body></html><!-- rmx:flush document -->',
    )
    void navigate('?navigation=blocked').catch(() => {})
    let first = events[0]
    await navigate('?navigation=next')
    expect((await first?.finished)?.aborted).toBe(true)
    expect((await events[1]?.finished)?.aborted).toBe(false)
    void navigate('?navigation=blocked-again').catch(() => {})
    app.dispose()
    expect((await events[2]?.finished)?.aborted).toBe(true)
    expect(events[1]?.signal.aborted).toBe(false)
  })

  it('rejects failed navigation completion and aborts its signal', async (t) => {
    let failure = new Error('Navigation failed')
    let { events } = await setup(t, () => {
      throw failure
    })
    let loading = navigate('?navigation=failure').catch(() => {})
    let event = events[0]
    expect(event).toBeDefined()
    await expect(event?.finished).rejects.toBe(failure)
    await loading
    expect(event?.signal.aborted).toBe(true)
  })

  it('reports a targeted form submission and history traversal without announcing independent reloads', async (t) => {
    let loads: Array<ResolveFrameOptions | undefined> = []
    let { app, events } = await setup(t, (_src, options) => {
      loads.push(options)
      return options?.target ? '<p>Details</p>' : '<html><head></head><body>Page</body></html>'
    })
    await app.frames.top.replace(
      jsx('html', {
        children: [
          jsx('head', {}),
          jsx('body', { children: jsx(Frame, { name: 'details', src: '/details' }) }),
        ],
      }),
    )
    await t.waitFor(() => expect(app.frames.get('details')).toBeDefined())
    let form = document.createElement('form')
    form.method = 'post'
    form.action = '?navigation=form'
    form.setAttribute('data-rmx-target', 'details')
    form.setAttribute('data-rmx-src', '/details')
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'books'
    form.append(input)
    document.body.append(form)
    let submitted = Promise.withResolvers<NavigationEvent>()
    window.addEventListener('rmx:navigation', submitted.resolve, {
      once: true,
      capture: true,
      signal: t.signal,
    })

    form.requestSubmit()
    let event = await submitted.promise
    await event.finished
    expect(event.element).toBe(form)
    expect(event.frameTarget).toBe('details')
    expect(event.target).toBe(form)
    expect(loads.at(-1)?.target).toBe(event.frameTarget)
    expect(loads.at(-1)?.from).toBe(event.from)
    expect(loads.at(-1)?.navigationType).toBe(event.navigationType)
    expect(event.frameSrc).toBe('/details')
    expect(new URL(event.to).search).toBe('?navigation=form')
    expect(event.method).toBe('post')
    expect(event.formData?.get('query')).toBe('books')
    expect(event.encType).toBe('application/x-www-form-urlencoded')
    await app.frames.get('details')?.reload()
    expect(events).toHaveLength(1)

    let from = window.navigation.currentEntry
    await window.navigation.back().finished
    expect(events).toHaveLength(2)
    expect(events[1]?.from).toBe(from)
    expect(loads.at(-1)?.from).toBe(from)
    expect(loads.at(-1)?.navigationType).toBe('traverse')
    expect(events[1]?.navigationType).toBe('traverse')
    expect(events[1]?.element).toBe(null)
    expect(events[1]?.formData).toBe(undefined)
    expect(event.signal.aborted).toBe(false)
  })

  it('does not clear a replacement started by a window navigation listener', async (t) => {
    let { app, events } = await setup(t, () => '<html><head></head><body>Latest</body></html>')
    let replacement: Promise<void> | undefined
    window.addEventListener(
      'rmx:navigation',
      () => {
        replacement = navigate('?navigation=reentrant')
      },
      { once: true, capture: true, signal: t.signal },
    )

    await navigate('?navigation=original').catch(() => {})
    await replacement
    expect(events).toHaveLength(2)
    expect((await events[0]?.finished)?.aborted).toBe(true)
    expect((await events[1]?.finished)?.aborted).toBe(false)
    expect(new URL(window.location.href).search).toBe('?navigation=reentrant')
  })
})
