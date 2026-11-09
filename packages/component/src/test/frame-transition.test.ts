import { expect } from '@remix-run/assert'
import { describe, it, mock, type TestContext } from '@remix-run/test'

import type { FrameTransition } from '../runtime/frame-runtime.ts'
import { navigate } from '../runtime/navigation.ts'
import { run } from '../runtime/run.ts'
import { withResolvers } from './utils.ts'

function pageHtml(path: string) {
  return `<!doctype html><html><head></head><body><main id="page">${path}</main></body></html>`
}

async function setup(
  t: TestContext,
  frameTransition: FrameTransition | undefined,
  resolve: (path: string, signal: AbortSignal | undefined) => Promise<string> | string = pageHtml,
) {
  let initialUrl = window.location.href
  let initialEntryKey = window.navigation.currentEntry?.key
  let baseUrl = new URL('/', initialUrl).href
  window.history.replaceState(null, '', baseUrl)
  document.documentElement.innerHTML = pageHtml('/').replace(
    /^<!doctype html><html>|<\/html>$/g,
    '',
  )

  let app = run({
    loadModule: mock.fn(),
    frameTransition,
    async resolveFrame(src, options) {
      return await resolve(new URL(src).pathname, options?.signal)
    },
  })
  t.after(async () => {
    if (initialEntryKey && window.navigation.currentEntry?.key !== initialEntryKey) {
      let traversal = window.navigation.traverseTo(initialEntryKey)
      await traversal.finished?.catch(() => {})
    }
    app.dispose()
    window.history.replaceState(null, '', initialUrl)
  })
  await app.ready()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { app, url: (path: string) => new URL(path, baseUrl).href }
}

const page = () => document.getElementById('page')?.textContent

describe('run frameTransition', () => {
  it('wraps the swap of a forward navigation in a view transition', async (t) => {
    let seen: Array<{ from: string | undefined; type: string; to: string; before: string | null }> =
      []
    let animation: Promise<unknown> | undefined
    let fixture = await setup(t, async ({ transition, to, commit }) => {
      seen.push({
        from: transition.from.url ?? undefined,
        type: transition.navigationType,
        to,
        before: page() ?? null,
      })
      if (!document.startViewTransition) return commit()
      let viewTransition = document.startViewTransition(() => commit())
      animation = viewTransition.finished
      await animation
    })

    await navigate(fixture.url('/products'))

    expect(page()).toBe('/products')
    expect(seen).toEqual([
      {
        from: fixture.url('/'),
        type: 'push',
        to: fixture.url('/products'),
        // The old page is still shown when the callback runs.
        before: '/',
      },
    ])
    await animation
  })

  it('resolves commit() once the navigation has finished', async (t) => {
    let commitCalled = withResolvers<void>()
    let committed: Promise<void> | undefined
    let order: string[] = []
    let fixture = await setup(t, ({ commit }) => {
      committed = commit().then(() => void order.push('navigation finished'))
      order.push('commit called')
      commitCalled[1]()
    })

    let navigating = navigate(fixture.url('/slow'))
    await commitCalled[0]
    await navigating
    await committed

    expect(page()).toBe('/slow')
    expect(order).toEqual(['commit called', 'navigation finished'])
  })

  it('reports Back and Forward as traversals with the entry being left', async (t) => {
    let seen: Array<{ type: string; fromIndex: number; toIndex: number | undefined }> = []
    let fixture = await setup(t, ({ transition, commit }) => {
      seen.push({
        type: transition.navigationType,
        fromIndex: transition.from.index,
        toIndex: window.navigation.currentEntry?.index,
      })
      return commit()
    })

    await navigate(fixture.url('/a'))
    await window.navigation.back().finished
    expect(page()).toBe('/')
    await window.navigation.forward().finished
    expect(page()).toBe('/a')

    let [push, back, forward] = seen
    expect(seen.length).toBe(3)
    expect(push.type).toBe('push')
    expect(back.type).toBe('traverse')
    expect(back.toIndex).toBeLessThan(back.fromIndex)
    expect(forward.type).toBe('traverse')
    expect(forward.toIndex).toBeGreaterThan(forward.fromIndex)
  })

  it('aborts the signal and skips the swap when the visitor goes Back mid-navigation', async (t) => {
    let [called, markCalled] = withResolvers<AbortSignal>()
    let fixture = await setup(t, ({ signal, commit }) => {
      if (!signal.aborted && window.navigation.currentEntry?.url?.endsWith('/cancelled')) {
        markCalled(signal)
        // Waits instead of committing, like an app awaiting its own data.
        return new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()))
      }
      return commit()
    })

    let pending = navigate(fixture.url('/cancelled')).catch(() => {})
    let signal = await called
    expect(signal.aborted).toBe(false)
    await window.navigation.back().finished
    await pending

    expect(signal.aborted).toBe(true)
    expect(page()).toBe('/')
  })

  it('aborts the signal and lets commit() resolve when a later navigation supersedes it', async (t) => {
    let first: { signal: AbortSignal; commit: () => Promise<void> } | undefined
    let [ready, markReady] = withResolvers<void>()
    let fixture = await setup(t, ({ to, signal, commit }) => {
      if (to.endsWith('/first')) {
        // Waits instead of committing, like an app awaiting its own data.
        first = { signal, commit }
        markReady()
        return new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()))
      }
      return commit()
    })

    navigate(fixture.url('/first')).catch(() => {})
    await ready
    await navigate(fixture.url('/second'))

    invariantDefined(first)
    expect(first.signal.aborted).toBe(true)
    expect(page()).toBe('/second')
    // A late commit() neither swaps the older page in nor hangs.
    await first.commit()
    expect(page()).toBe('/second')
  })

  it('swaps when the callback returns or throws without calling commit()', async (t) => {
    let errors: unknown[] = []
    let mode: 'return' | 'throw' = 'return'
    let fixture = await setup(t, () => {
      if (mode === 'throw') throw new Error('transition failed')
    })
    fixture.app.addEventListener('error', (event) => errors.push(event.error))

    await navigate(fixture.url('/returned'))
    expect(page()).toBe('/returned')

    mode = 'throw'
    await navigate(fixture.url('/thrown'))
    expect(page()).toBe('/thrown')
    expect(errors.map((error) => (error as Error).message)).toEqual(['transition failed'])
  })

  it('swaps once when commit() is called more than once', async (t) => {
    let renders = 0
    let fixture = await setup(
      t,
      async ({ commit }) => {
        await Promise.all([commit(), commit()])
        await commit()
      },
      (path) => {
        renders++
        return pageHtml(path)
      },
    )
    renders = 0

    await navigate(fixture.url('/once'))

    expect(page()).toBe('/once')
    expect(renders).toBe(1)
  })

  it('swaps without a view transition when the browser has no startViewTransition', async (t) => {
    let descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'startViewTransition')
    Reflect.deleteProperty(Document.prototype, 'startViewTransition')
    t.after(() => {
      if (descriptor) Object.defineProperty(Document.prototype, 'startViewTransition', descriptor)
    })
    let usedViewTransition: boolean | undefined
    let fixture = await setup(t, ({ commit }) => {
      usedViewTransition = typeof document.startViewTransition === 'function'
      return typeof document.startViewTransition === 'function'
        ? document.startViewTransition(() => commit()).finished
        : commit()
    })

    await navigate(fixture.url('/plain'))

    expect(usedViewTransition).toBe(false)
    expect(page()).toBe('/plain')
  })

  it('does not call the callback for form submissions', async (t) => {
    let calls = 0
    let fixture = await setup(t, ({ commit }) => {
      calls++
      return commit()
    })
    let form = document.createElement('form')
    form.method = 'post'
    form.action = fixture.url('/submitted')
    document.body.append(form)
    let settled = new Promise<void>((resolve) =>
      window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true }),
    )
    form.requestSubmit()
    await settled
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(calls).toBe(0)
  })
})

function invariantDefined<value>(input: value | undefined): asserts input is value {
  if (input === undefined) throw new Error('Expected a value')
}
