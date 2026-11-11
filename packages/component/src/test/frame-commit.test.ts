import { expect } from '@remix-run/assert'
import { describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'

import { defaultResolveFrame, Frame, navigate, run, spaResponse } from '../index.ts'
import type { FrameCommit } from '../index.ts'
import { jsx } from '../jsx-runtime.ts'

function page(text: string): Response {
  return new Response(
    `<!doctype html><html><head><style>::view-transition-group(*) { animation-duration: 1ms }</style></head><body><main id="commit-page">${text}</main></body></html><!-- rmx:flush document -->`,
    { headers: { 'Content-Type': 'text/html', 'X-Test-Page': text } },
  )
}

async function setup(t: TestContext, commit: FrameCommit, fetchImpl?: typeof fetch) {
  let initialUrl = window.location.href
  let initialKey = window.navigation.currentEntry?.key
  document.body.innerHTML = '<main id="commit-page">initial</main>'
  let cleaningUp = false
  let fetchFrame: typeof fetch = async (input) => {
    let url = new URL(String(input), initialUrl)
    return page(url.searchParams.get('commit-page') ?? 'initial')
  }
  let transitions: ViewTransition[] = []
  let nativeStart = document.startViewTransition.bind(document)
  t.mock.method(document, 'startViewTransition', (update: ViewTransitionUpdateCallback) => {
    let transition = nativeStart(update)
    transitions.push(transition)
    return transition
  })
  let app = run({
    loadModule: mock.fn(),
    resolveFrame(src, options) {
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
    url(value: string) {
      let url = new URL(initialUrl)
      url.searchParams.set('commit-page', value)
      return url.href
    },
  }
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

  it('finishes an animated redirect after its final URL and focus are applied', async (t) => {
    let destination = ''
    let completed = Promise.withResolvers<void>()
    let calls = 0
    let response = page('redirected')
    let fixture = await setup(
      t,
      async (commitFrame, { signal, response: received }) => {
        calls++
        expect(received).toBe(response)
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
    expect(fixture.errors).toEqual([])
  })

  it('aborts a deferred commit and makes a late commit harmless', async (t) => {
    let ready = Promise.withResolvers<{ signal: AbortSignal; commitFrame(): Promise<void> }>()
    let fixture = await setup(t, (commitFrame, { signal, response }) => {
      if (response.headers.get('X-Test-Page') === 'blocked') {
        ready.resolve({ signal, commitFrame })
        return new Promise<void>(() => {})
      }
      return commitFrame()
    })
    let first = navigate(fixture.url('blocked')).catch(() => {})
    let deferred = await ready.promise
    await navigate(fixture.url('latest'))
    await first
    expect(deferred.signal.aborted).toBe(true)
    await deferred.commitFrame()
    expect(document.getElementById('commit-page')?.textContent).toBe('latest')
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

  it('completes independent reloads without waiting for a browser navigation', async (t) => {
    let completed = Promise.withResolvers<void>()
    let fixture = await setup(t, async (commitFrame) => {
      await commitFrame()
      expect(window.navigation.transition).toBe(null)
      completed.resolve()
    })
    await fixture.app.frames.top.reload()
    await completed.promise
    expect(document.getElementById('commit-page')?.textContent).toBe('initial')
  })

  it('wraps initial client-frame loads and aborts completed wrappers on reload and disposal', async (t) => {
    let initial = Promise.withResolvers<void>()
    let reloaded = Promise.withResolvers<void>()
    let signals: AbortSignal[] = []
    let fixture = await setup(
      t,
      async (commitFrame, { signal }) => {
        signals.push(signal)
        await commitFrame()
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

  it('finishes nested blocking frame commits with their enclosing navigation', async (t) => {
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

  it('captures the reset scroll position without a post-navigation animation-frame wait', async (t) => {
    let captured = Promise.withResolvers<void>()
    let fixture = await setup(
      t,
      async (commitFrame) => {
        let transition = document.startViewTransition(async () => {
          await commitFrame()
          expect(window.scrollY).toBe(0)
          expect(document.activeElement).toBe(document.body)
          captured.resolve()
        })
        void transition.ready.catch(() => {})
        await transition.finished
      },
      async () => page('<div style="height:4000px">next</div>'),
    )
    document.body.innerHTML = '<main style="height:4000px">initial<input id="old-input"></main>'
    document.getElementById('old-input')?.focus()
    window.scrollTo(0, 600)
    expect(window.scrollY).toBeGreaterThan(0)
    await navigate(fixture.url('scroll'))
    await captured.promise
    await fixture.transitions[0]?.ready
    await fixture.transitions[0]?.finished
    expect(fixture.errors).toEqual([])
  })
})
