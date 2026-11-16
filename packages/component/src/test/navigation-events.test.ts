import { expect } from '@remix-run/assert'
import { describe, it, mock, type TestContext } from '@remix-run/test'

import { navigate, run } from '../index.ts'
import type { NavigationEvent, ResolveFrame } from '../index.ts'

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
  it('observes shadow-root links through redirects, URL, and focus handling', async (t) => {
    let finalUrl = new URL('?navigation=final', window.location.href).href
    let response = new Response(
      '<!doctype html><html><head></head><body><main><input id="destination-focus" autofocus></main></body></html><!-- rmx:flush document -->',
    )
    Object.defineProperties(response, {
      url: { value: finalUrl },
      redirected: { value: true },
    })
    let resolveFrame = mock.fn(() => response)
    let { events } = await setup(t, resolveFrame)
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
    let host = document.createElement('div')
    let shadow = host.attachShadow({ mode: 'closed' })
    let anchor = document.createElement('a')
    anchor.href = '?navigation=redirect'
    shadow.append(anchor)
    document.body.append(host)
    let accepted = Promise.withResolvers<NavigationEvent>()
    anchor.addEventListener('rmx:navigation', (event) => {
      expect(event.target).toBe(anchor)
      accepted.resolve(event)
      event.stopPropagation()
    })

    let from = window.navigation.currentEntry
    anchor.click()
    let original = await accepted.promise
    expect('detail' in original).toBe(false)
    expect(original.composed).toBe(true)
    expect(original.frameTarget).toBe(undefined)
    expect(original.frameSrc).toBe(anchor.href)
    expect(original.to).toBe(anchor.href)
    expect(original.from).toBe(from)
    expect(original.element).toBe(anchor)
    expect(original.navigationType).toBe('push')
    let finished = false
    void original.finished.then(() => (finished = true))
    await redirectStarted.promise

    expect(events).toHaveLength(2)
    expect(events[1]?.to).toBe(finalUrl)
    expect(events[1]?.frameSrc).toBe(original.frameSrc)
    expect(events[1]?.signal).toBe(original.signal)
    expect(original.to).toBe(anchor.href)
    expect(events[1]?.navigationType).toBe('push')
    expect(events[1]?.from).toBe(from)
    expect(resolveFrame).toHaveBeenCalledTimes(1)
    expect(events[1]?.finished).toBe(original.finished)
    expect(events[0]).toBe(original)
    expect(events[1]?.target).toBe(window)
    expect(original.signal.aborted).toBe(false)
    expect(finished).toBe(false)
    release.resolve()
    let outcome = await original.finished

    expect(outcome.aborted).toBe(false)
    expect(window.location.href).toBe(finalUrl)
    expect(document.activeElement?.id).toBe('destination-focus')
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

  it('does not clear a replacement started by a window navigation listener', async (t) => {
    let { events } = await setup(t, () => '<html><head></head><body>Latest</body></html>')
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
