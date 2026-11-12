import { expect } from '@remix-run/assert'
import { describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'

import { clientEntry, defaultResolveFrame, Frame, navigate, run, spaResponse } from '../index.ts'
import type { FrameCommit, LoadModule, ResolveFrameOptions } from '../index.ts'
import { jsx } from '../jsx-runtime.ts'
import { renderToStream, renderToString } from '../server/stream.ts'

function page(text: string): Response {
  return new Response(
    `<!doctype html><html><head><style>::view-transition-group(*) { animation-duration: 1ms }</style></head><body><main id="commit-page">${text}</main></body></html><!-- rmx:flush document -->`,
    { headers: { 'Content-Type': 'text/html', 'X-Test-Page': text } },
  )
}

async function setup(
  t: TestContext,
  commit: FrameCommit,
  fetchImpl?: typeof fetch,
  loadModule: LoadModule = mock.fn(),
) {
  let initialUrl = window.location.href
  let initialKey = window.navigation.currentEntry?.key
  document.body.innerHTML = '<main id="commit-page">initial</main>'
  let cleaningUp = false
  let fetchFrame: typeof fetch = async (input) => {
    let url = new URL(String(input), initialUrl)
    return page(url.searchParams.get('commit-page') ?? 'initial')
  }
  let transitions: ViewTransition[] = []
  let loads: Array<{ src: string; options?: ResolveFrameOptions }> = []
  let nativeStart = document.startViewTransition.bind(document)
  t.mock.method(document, 'startViewTransition', (update: ViewTransitionUpdateCallback) => {
    let transition = nativeStart(update)
    transitions.push(transition)
    return transition
  })
  let app = run({
    loadModule,
    resolveFrame(src, options) {
      loads.push({ src, options })
      return defaultResolveFrame(src, options, {
        fetch: cleaningUp ? fetchFrame : (fetchImpl ?? fetchFrame),
        commit: cleaningUp ? undefined : commit,
      })
    },
  })
  let errors: unknown[] = []
  app.addEventListener('error', (event) => errors.push(event.error))
  t.after(async () => {
    cleaningUp = true
    try {
      if (initialKey && window.navigation.currentEntry?.key !== initialKey) {
        await window.navigation.traverseTo(initialKey).finished
      }
    } finally {
      app.dispose()
      document.body.replaceChildren()
      window.history.replaceState(null, '', initialUrl)
    }
  })
  await app.ready()
  return {
    app,
    errors,
    transitions,
    loads,
    url(value: string) {
      let url = new URL(initialUrl)
      url.searchParams.set('commit-page', value)
      return url.href
    },
  }
}

async function serverFramePage() {
  let hydrating = false
  let Entry = clientEntry('/entry.js#Entry', function Entry() {
    return () =>
      hydrating
        ? jsx(Frame, { name: 'client-child', src: '/client-child' })
        : jsx('p', { children: 'Server content' })
  })
  let html = await new Response(
    renderToStream(
      jsx('html', {
        children: [
          jsx('head', {}),
          jsx('body', {
            children: jsx(Frame, { name: 'server-wrapper', src: '/server-wrapper' }),
          }),
        ],
      }),
      { resolveFrame: () => renderToString(jsx(Entry, {})) },
    ),
  ).text()
  hydrating = true
  return { html, Entry }
}

describe('defaultResolveFrame commit', () => {
  it('defers the swap and commits once with the original response', async (t) => {
    let ready = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    let response = page('next')
    let fixture = await setup(
      t,
      async (commitFrame, options) => {
        expect(options.response).toBe(response)
        expect(options.to).toBe(fixture.url('next'))
        expect(response.bodyUsed).toBe(false)
        ready.resolve()
        await release.promise
        let completed = commitFrame()
        expect(commitFrame()).toBe(completed)
        await completed
        expect(document.getElementById('commit-page')?.textContent).toBe('next')
      },
      async () => response,
    )
    let pending = navigate(fixture.url('next'))
    await ready.promise
    expect(document.getElementById('commit-page')?.textContent).toBe('initial')
    release.resolve()
    await pending
    expect(fixture.errors).toEqual([])
  })

  it('wraps push, replace, Back, and Forward in native view transitions', async (t) => {
    let fixture = await setup(t, async (commitFrame) => {
      let transition = document.startViewTransition(commitFrame)
      void transition.ready.catch(() => {})
      await transition.finished
    })
    await navigate(fixture.url('push'))
    await fixture.transitions[0]?.ready
    await fixture.transitions[0]?.finished
    await navigate(fixture.url('replace'), { history: 'replace' })
    await fixture.transitions[1]?.ready
    await fixture.transitions[1]?.finished
    await window.navigation.back().finished
    await fixture.transitions[2]?.ready
    await fixture.transitions[2]?.finished
    await window.navigation.forward().finished
    await fixture.transitions[3]?.ready
    await fixture.transitions[3]?.finished
    expect(fixture.transitions.length).toBe(4)
    expect(fixture.errors).toEqual([])
  })

  it('commits a GET form submission with its encoded destination', async (t) => {
    let initialUrl = window.location.href
    let completed = Promise.withResolvers<void>()
    let destinations: string[] = []
    let fixture = await setup(t, (commitFrame, { to }) => {
      destinations.push(to)
      let committed = commitFrame()
      completed.resolve(committed)
      return committed
    })
    let form = document.createElement('form')
    form.method = 'get'
    form.action = initialUrl
    let input = document.createElement('input')
    input.name = 'commit-page'
    input.value = 'search results'
    form.append(input)
    document.body.append(form)
    let destination = new URL(initialUrl)
    destination.search = new URLSearchParams({ 'commit-page': input.value }).toString()

    form.requestSubmit()
    await completed.promise

    expect(destinations).toEqual([destination.href])
    expect(fixture.loads.map((load) => load.src)).toEqual([destination.href])
    expect(fixture.loads[0]?.options?.transition?.navigationType).toBe('push')
    expect(window.navigation.transition).toBe(null)
    expect(window.location.href).toBe(destination.href)
    expect(document.getElementById('commit-page')?.textContent).toBe(input.value)
    expect(fixture.errors).toEqual([])
  })

  it('commits a browser reload with its reload transition', async (t) => {
    let initialUrl = window.location.href
    let completed = Promise.withResolvers<void>()
    let destinations: string[] = []
    let fixture = await setup(
      t,
      (commitFrame, { to }) => {
        destinations.push(to)
        let committed = commitFrame()
        completed.resolve(committed)
        return committed
      },
      async () => page('reloaded'),
    )

    await window.navigation.reload().finished
    await completed.promise

    expect(destinations).toEqual([initialUrl])
    expect(fixture.loads.map((load) => load.src)).toEqual([initialUrl])
    expect(fixture.loads[0]?.options?.transition?.navigationType).toBe('reload')
    expect(fixture.loads[0]?.options?.transition?.from.url).toBe(initialUrl)
    expect(window.navigation.transition).toBe(null)
    expect(window.location.href).toBe(initialUrl)
    expect(document.getElementById('commit-page')?.textContent).toBe('reloaded')
    expect(fixture.errors).toEqual([])
  })

  it('finishes an animated redirect after its final URL and focus are applied', async (t) => {
    let destination = ''
    let completed = Promise.withResolvers<void>()
    let calls = 0
    let response = page('redirected')
    let fixture = await setup(
      t,
      async (commitFrame, { signal, response: received, to }) => {
        calls++
        expect(received).toBe(response)
        expect(to).toBe(destination)
        expect(window.location.href).toBe(fixture.url('redirect'))
        expect(fixture.loads[0]?.options?.transition).toBe(window.navigation.transition)
        expect(fixture.loads[0]?.options?.transition?.navigationType).toBe('push')
        let transition = document.startViewTransition(async () => {
          await commitFrame()
          expect(window.location.href).toBe(destination)
          expect(document.activeElement).toBe(document.body)
          expect(signal.aborted).toBe(false)
          completed.resolve()
        })
        void transition.ready.catch(() => {})
        await transition.finished
      },
      async () => response,
    )
    destination = fixture.url('destination')
    Object.defineProperties(response, {
      redirected: { value: true },
      url: { value: destination },
    })
    await navigate(fixture.url('redirect')).catch(() => {})
    await completed.promise
    await fixture.transitions[0]?.ready
    await fixture.transitions[0]?.finished
    expect(document.getElementById('commit-page')?.textContent).toBe('redirected')
    expect(calls).toBe(1)
    expect(fixture.loads).toHaveLength(1)
    expect(fixture.errors).toEqual([])
  })

  it('aborts a never-settling commit wrapper when Back interrupts a pending navigation', async (t) => {
    let initialUrl = window.location.href
    let ready = Promise.withResolvers<{ signal: AbortSignal; commitFrame(): Promise<void> }>()
    let restored = Promise.withResolvers<void>()
    let fixture = await setup(t, (commitFrame, { signal, to }) => {
      if (to === fixture.url('blocked')) {
        ready.resolve({ signal, commitFrame })
        // Never settles, so only cancellation can release this navigation.
        return new Promise<void>(() => {})
      }
      return commitFrame().then(() => restored.resolve())
    })

    let pending = navigate(fixture.url('blocked')).catch(() => {})
    let deferred = await ready.promise
    expect(deferred.signal.aborted).toBe(false)
    expect(document.getElementById('commit-page')?.textContent).toBe('initial')

    // WebKit can reject the traversal's finished promise even though Back renders successfully.
    // Wait for the restored frame's commit instead.
    void window.navigation.back().finished?.catch(() => {})
    await pending
    expect(deferred.signal.aborted).toBe(true)

    await restored.promise
    await deferred.commitFrame()
    expect(document.getElementById('commit-page')?.textContent).toBe('initial')
    expect(window.location.href).toBe(initialUrl)
    expect(fixture.loads.map((load) => load.src)).toEqual([fixture.url('blocked'), initialUrl])
    expect(fixture.errors).toEqual([])
  })

  it('provides the resolved destination for redirects carried by SPA responses', async (t) => {
    let destination = ''
    let completed = Promise.withResolvers<void>()
    let fixture = await setup(
      t,
      async (commitFrame, { to, response }) => {
        expect(response.url).toBe('')
        expect(to).toBe(destination)
        await commitFrame()
        expect(window.location.href).toBe(destination)
        completed.resolve()
      },
      async () =>
        spaResponse.finalize(
          spaResponse.create(jsx('main', { id: 'commit-page', children: 'redirected' })),
          destination,
        ),
    )
    destination = fixture.url('spa-destination')
    await navigate(fixture.url('spa-redirect')).catch(() => {})
    await completed.promise
    expect(fixture.loads).toHaveLength(1)
    expect(document.getElementById('commit-page')?.textContent).toBe('redirected')
    expect(fixture.errors).toEqual([])
  })

  it('keeps the cancellation signal active after rendering while an animation runs', async (t) => {
    let firstSignal: AbortSignal | undefined
    let fixture = await setup(
      t,
      async (commitFrame, { signal, response }) => {
        let first = response.headers.get('X-Test-Page') === 'first'
        if (first) firstSignal = signal
        let transition = document.startViewTransition(commitFrame)
        let skip = () => transition.skipTransition()
        signal.addEventListener('abort', skip, { once: true })
        void transition.ready.catch(() => {})
        try {
          await transition.finished
        } finally {
          signal.removeEventListener('abort', skip)
        }
      },
      async (input) => {
        let first = String(input).includes('first')
        let response = page(first ? 'first' : 'latest')
        if (!first) return response
        return new Response((await response.text()).replace('1ms', '100s'), {
          headers: response.headers,
        })
      },
    )
    await navigate(fixture.url('first'))
    await fixture.transitions[0]?.ready
    expect(firstSignal?.aborted).toBe(false)
    await navigate(fixture.url('latest'))
    await fixture.transitions[0]?.finished
    await fixture.transitions[1]?.ready
    await fixture.transitions[1]?.finished
    expect(firstSignal?.aborted).toBe(true)
    expect(document.getElementById('commit-page')?.textContent).toBe('latest')
  })

  it('falls back when the callback returns or throws without committing', async (t) => {
    let fixture = await setup(t, (_commitFrame, { response }) => {
      if (response.headers.get('X-Test-Page') === 'throw') throw new Error('Commit wrapper failed')
    })
    await navigate(fixture.url('return'))
    expect(document.getElementById('commit-page')?.textContent).toBe('return')
    await navigate(fixture.url('throw'))
    expect(document.getElementById('commit-page')?.textContent).toBe('throw')
    expect(fixture.errors.map(String)).toEqual(['Error: Commit wrapper failed'])
  })

  it('waits for a streamed response and preserves rendering failures', async (t) => {
    let body = new TransformStream<Uint8Array, Uint8Array>()
    let writer = body.writable.getWriter()
    let ready = Promise.withResolvers<void>()
    let commitResult: Promise<void> | undefined
    let fixture = await setup(
      t,
      (commitFrame) => {
        commitResult = commitFrame()
        ready.resolve()
        return commitResult
      },
      async (input) =>
        String(input).includes('broken') ? new Response(body.readable) : page('recovered'),
    )
    let pending = navigate(fixture.url('broken'))
    let failure = expect(pending).rejects.toThrow('Broken body')
    await ready.promise
    await writer.write(new TextEncoder().encode('<!doctype html><html><head></head><body>'))
    let rejected = expect(commitResult).rejects.toThrow('Broken body')
    await writer.abort(new Error('Broken body'))
    await failure
    await rejected
    expect(fixture.errors.map(String)).toEqual(['Error: Broken body'])
    await navigate(fixture.url('recovered'))
    expect(document.getElementById('commit-page')?.textContent).toBe('recovered')
  })

  it('wraps initial client-frame loads and aborts completed wrappers on reload and disposal', async (t) => {
    let initial = Promise.withResolvers<void>()
    let reloaded = Promise.withResolvers<void>()
    let signals: AbortSignal[] = []
    let fixture = await setup(
      t,
      async (commitFrame, { signal, to }) => {
        signals.push(signal)
        expect(to).toBe(signals.length === 1 ? '/details' : '/updated-details')
        expect(fixture.loads.at(-1)?.options?.transition).toBeUndefined()
        await commitFrame()
        expect(window.navigation.transition).toBe(null)
        if (signals.length === 1) initial.resolve()
        else reloaded.resolve()
      },
      async (input) => new Response(`<p id="details-value">${String(input)}</p>`),
    )
    await fixture.app.frames.top.replace(jsx(Frame, { name: 'details', src: '/details' }))
    await initial.promise
    expect(document.getElementById('details-value')?.textContent).toBe('/details')
    let details = fixture.app.frames.get('details')
    expect(details).toBeDefined()
    await details?.reload({ src: '/updated-details' })
    await reloaded.promise
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
    expect(document.getElementById('details-value')?.textContent).toBe('/updated-details')
    await fixture.app.frames.top.replace(await page('removed').text())
    expect(signals[1]?.aborted).toBe(true)
    expect(fixture.errors).toEqual([])
  })

  it('inherits navigation through nested blocking commits and clears it on reload', async (t) => {
    let completed = Promise.withResolvers<void>()
    let committed = 0
    let fixture = await setup(
      t,
      async (commitFrame) => {
        await commitFrame()
        expect(document.getElementById('nested-value')?.textContent).toBe('nested')
        expect(window.navigation.transition).toBe(null)
        if (++committed === 3) completed.resolve()
      },
      async (input) => {
        if (String(input) === '/nested') {
          return new Response('<p id="nested-value">nested</p>')
        }
        if (String(input) === '/details') {
          return spaResponse.create(jsx(Frame, { name: 'nested', src: '/nested' }))
        }
        return spaResponse.create(
          jsx('html', {
            children: [
              jsx('head', {}),
              jsx('body', { children: jsx(Frame, { name: 'details', src: '/details' }) }),
            ],
          }),
        )
      },
    )
    await navigate(fixture.url('nested'))
    await completed.promise
    let transition = fixture.loads[0]?.options?.transition
    expect(transition?.navigationType).toBe('push')
    expect(fixture.loads.map((load) => load.options?.transition)).toEqual([
      transition,
      transition,
      transition,
    ])

    await fixture.app.frames.get('details')?.reload()
    expect(fixture.loads.slice(3).map((load) => [load.src, load.options?.transition])).toEqual([
      ['/details', undefined],
      ['/nested', undefined],
    ])
    expect(fixture.errors).toEqual([])
  })

  it('associates refreshed lazy-frame commits with navigation while explicit reloads stay independent', async (t) => {
    let completed = Promise.withResolvers<void>()
    let refreshed = Promise.withResolvers<void>()
    let signals: AbortSignal[] = []
    let fixture = await setup(
      t,
      async (commitFrame, { to, signal }) => {
        await commitFrame()
        if (to !== '/lazy') return
        signals.push(signal)
        expect(window.navigation.transition).toBe(null)
        if (signals.length === 1) completed.resolve()
        else refreshed.resolve()
      },
      async (input) => {
        if (String(input) === '/lazy') return new Response('<p>Loaded</p>')
        return new Response(
          await renderToString(
            jsx('html', {
              children: [
                jsx('head', {}),
                jsx('body', {
                  children: jsx('section', {
                    style: { position: 'fixed', top: '100000px' },
                    children: jsx(Frame, {
                      name: 'lazy',
                      src: '/lazy',
                      loading: 'lazy',
                      fallback: jsx('p', { children: 'Waiting' }),
                    }),
                  }),
                }),
              ],
            }),
          ),
        )
      },
    )
    await navigate(fixture.url('first'))
    let frame = fixture.app.frames.get('lazy')
    expect(frame).toBeDefined()
    await frame?.reload()
    await completed.promise
    expect(fixture.loads.at(-1)?.options?.transition).toBeUndefined()

    await navigate(fixture.url('second'))
    await refreshed.promise
    let topLoad = fixture.loads.findLast((load) => load.src === fixture.url('second'))
    expect(topLoad?.options?.transition?.navigationType).toBe('push')
    expect(fixture.loads.at(-1)?.options?.transition).toBe(topLoad?.options?.transition)
    expect(fixture.app.frames.get('lazy')).toBe(frame)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
    expect(window.location.href).toBe(fixture.url('second'))
    expect(fixture.errors).toEqual([])
  })

  it('waits for redirected navigation in client frames hydrated inside new server frames', async (t) => {
    let { html, Entry } = await serverFramePage()
    let destination = ''
    let completed = Promise.withResolvers<void>()
    let fixture = await setup(
      t,
      (commitFrame, { to, signal }) => {
        let committed = commitFrame()
        if (to === '/client-child') {
          completed.resolve(
            committed.then(() => {
              expect(window.location.href).toBe(destination)
              expect(window.navigation.transition).toBe(null)
              expect(signal.aborted).toBe(false)
              expect(document.getElementById('client-value')?.textContent).toBe('Client content')
            }),
          )
        }
        return committed
      },
      async (input) => {
        if (String(input) === '/client-child') {
          return new Response('<p id="client-value">Client content</p>')
        }
        let response = new Response(html)
        Object.defineProperties(response, {
          redirected: { value: true },
          url: { value: destination },
        })
        return response
      },
      () => Entry,
    )
    destination = fixture.url('destination')
    let completion = expect(completed.promise).resolves.toBeUndefined()
    await navigate(fixture.url('server-frame')).catch(() => {})
    await completion
    expect(fixture.errors).toEqual([])
  })

  it('aborts hydrated client frame hooks before a superseding navigation renders', async (t) => {
    let { html, Entry } = await serverFramePage()
    let ready = Promise.withResolvers<{ signal: AbortSignal; commitFrame(): Promise<void> }>()
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    let fixture = await setup(
      t,
      (commitFrame, { to, signal }) => {
        if (to === '/client-child') {
          ready.resolve({ signal, commitFrame })
          return new Promise<void>(() => {})
        }
        return commitFrame()
      },
      async (input) => {
        if (String(input) === '/client-child') return new Response('<p>Stale content</p>')
        if (String(input).includes('latest')) {
          requested.resolve()
          await release.promise
          return page('latest')
        }
        return new Response(html)
      },
      () => Entry,
    )
    let pending = navigate(fixture.url('server-frame')).catch(() => {})
    let deferred = await ready.promise
    let latest = navigate(fixture.url('latest'))
    await requested.promise
    let abortedBeforeRender = deferred.signal.aborted
    release.resolve()
    await latest
    await pending
    expect(abortedBeforeRender).toBe(true)
    await deferred.commitFrame()
    expect(document.getElementById('commit-page')?.textContent).toBe('latest')
    expect(fixture.errors).toEqual([])
  })

  it('resolves an in-progress commit on cancellation without waiting for the response body', async (t) => {
    let body = new TransformStream<Uint8Array, Uint8Array>()
    let writer = body.writable.getWriter()
    let ready = Promise.withResolvers<void>()
    let cancelled = Promise.withResolvers<void>()
    let fixture = await setup(
      t,
      async (commitFrame, { signal, response }) => {
        let streaming = response.headers.get('X-Streaming') === 'true'
        let pending = commitFrame()
        if (streaming) ready.resolve()
        await pending
        if (streaming) {
          expect(signal.aborted).toBe(true)
          cancelled.resolve()
        }
      },
      async (input) =>
        String(input).includes('stream')
          ? new Response(body.readable, { headers: { 'X-Streaming': 'true' } })
          : page('latest'),
    )
    let pending = navigate(fixture.url('stream')).catch(() => {})
    await ready.promise
    await writer.write(new TextEncoder().encode('<!doctype html><html><head></head><body>'))
    await navigate(fixture.url('latest'))
    await cancelled.promise
    await pending
    await writer.abort().catch(() => {})
    expect(document.getElementById('commit-page')?.textContent).toBe('latest')
    expect(fixture.errors).toEqual([])
  })

  it('aborts a waiting wrapper when its runtime is disposed', async (t) => {
    let ready = Promise.withResolvers<{ commitFrame(): Promise<void>; signal: AbortSignal }>()
    let fixture = await setup(t, (commitFrame, { signal }) => {
      ready.resolve({ commitFrame, signal })
      return new Promise<void>(() => {})
    })
    let pending = navigate(fixture.url('disposed')).catch(() => {})
    let waiting = await ready.promise
    fixture.app.dispose()
    expect(waiting.signal.aborted).toBe(true)
    await waiting.commitFrame()
    await pending
    expect(document.getElementById('commit-page')?.textContent).toBe('initial')
  })

  it('resynchronizes WebKit scrolling with a nonanimated commit hook', async (t) => {
    t.mock.getter(
      navigator,
      'userAgent',
      () => 'Mozilla/5.0 AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
    )
    let fixture = await setup(
      t,
      (commitFrame) => commitFrame(),
      async () => page('<div style="height:4000px">next</div>'),
    )
    document.body.innerHTML = '<main style="height:4000px">initial</main>'
    window.scrollTo(0, 600)
    let scrollTo = t.mock.method(window, 'scrollTo')
    let animationFrames: FrameRequestCallback[] = []
    t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })

    await navigate(fixture.url('scroll'))
    expect(window.scrollY).toBe(0)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(animationFrames.length).toBe(1)

    animationFrames.shift()?.(0)
    expect(scrollTo).toHaveBeenNthCalledWith(1, { behavior: 'instant', left: 0, top: 1 })
    expect(window.scrollY).toBe(1)
    animationFrames.shift()?.(0)
    expect(scrollTo).toHaveBeenNthCalledWith(2, { behavior: 'instant', left: 0, top: 0 })
    expect(window.scrollY).toBe(0)
    expect(fixture.transitions.length).toBe(0)
    expect(fixture.errors).toEqual([])
  })

  it('captures reset scroll before resynchronizing WebKit after a view-transition snapshot', async (t) => {
    t.mock.getter(
      navigator,
      'userAgent',
      () => 'Mozilla/5.0 AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
    )
    let captured = Promise.withResolvers<void>()
    let repaired = Promise.withResolvers<void>()
    let snapshotReady = false
    let nudgedAfterSnapshot: boolean | undefined
    let fixture = await setup(
      t,
      async (commitFrame) => {
        let transition = document.startViewTransition(async () => {
          await commitFrame()
          expect(window.scrollY).toBe(0)
          expect(document.activeElement).toBe(document.body)
          captured.resolve()
        })
        void transition.ready.then(
          () => {
            snapshotReady = true
          },
          () => {},
        )
        await transition.finished
      },
      async () => page('<div style="height:4000px">next</div>'),
    )
    document.body.innerHTML = '<main style="height:4000px">initial<input id="old-input"></main>'
    document.getElementById('old-input')?.focus()
    window.scrollTo(0, 600)
    expect(window.scrollY).toBeGreaterThan(0)
    let nativeScrollTo = window.scrollTo.bind(window)
    t.mock.method(window, 'scrollTo', (options: ScrollToOptions) => {
      if (options.top === 1) nudgedAfterSnapshot = snapshotReady
      nativeScrollTo(options)
      if (options.top === 0) repaired.resolve()
    })
    await navigate(fixture.url('scroll'))
    await captured.promise
    await fixture.transitions[0]?.ready
    await fixture.transitions[0]?.finished
    await repaired.promise
    expect(nudgedAfterSnapshot).toBe(true)
    expect(window.scrollY).toBe(0)
    expect(fixture.errors).toEqual([])
  })
})
