import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import type { Handle } from './component.ts'
import type { RemixNode } from './jsx.ts'
import { SPA, type SPAProps } from './spa.ts'
import { render } from '../test.ts'

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error('Timed out waiting for condition')
}

function restoreLocationAfterTest(t: TestContext): void {
  let href = window.location.href
  t.after(() => history.replaceState(null, '', href))
}

function RouterState(handle: Handle) {
  let router = handle.context.get(SPA)
  return () => (
    <p>
      {router.active.pathname}|{router.pending?.pathname ?? 'idle'}
    </p>
  )
}

function PageWithLink(handle: Handle<{ href: string }>) {
  return () => (
    <>
      <RouterState />
      <a href={handle.props.href}>Next</a>
    </>
  )
}

describe('SPA', () => {
  it('provides the active and pending URLs while loading the initial page', async (t) => {
    let page = Promise.withResolvers<RemixNode>()
    let router: SPAProps['router'] = {
      fetch() {
        return page.promise
      },
    }
    let { container, act, cleanup } = render(<SPA router={router} fallback={<RouterState />} />)
    t.after(cleanup)

    expect(container.textContent).toBe(`${window.location.pathname}|${window.location.pathname}`)

    await act(() => page.resolve(<RouterState />))

    expect(container.textContent).toBe(`${window.location.pathname}|idle`)
  })

  it('tracks active and pending URLs during link navigation', async (t) => {
    restoreLocationAfterTest(t)

    let activePathname = window.location.pathname
    let destination = new URL('/next', window.location.href)
    let initialPage = Promise.withResolvers<RemixNode>()
    let nextPage = Promise.withResolvers<RemixNode>()
    let nextLoadStarted = Promise.withResolvers<void>()
    let router: SPAProps['router'] = {
      fetch(url) {
        if (url.href === destination.href) {
          nextLoadStarted.resolve()
          return nextPage.promise
        }

        return initialPage.promise
      },
    }
    let { $, act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => initialPage.resolve(<PageWithLink href={destination.href} />))

    expect($('p')?.textContent).toBe(`${activePathname}|idle`)

    let navigationSucceeded = new Promise<void>((resolve) => {
      window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
    })
    let link = $('a')
    if (!link) throw new Error('Expected link')
    await act(async () => {
      link.click()
      await nextLoadStarted.promise
    })

    expect($('p')?.textContent).toBe(`${activePathname}|${destination.pathname}`)

    await act(async () => {
      nextPage.resolve(<RouterState />)
      await navigationSucceeded
    })

    expect($('p')?.textContent).toBe(`${destination.pathname}|idle`)
  })

  it('aborts the previous router load when a navigation supersedes it', async (t) => {
    restoreLocationAfterTest(t)

    let loads: Array<{
      url: URL
      signal: AbortSignal
      resolve(node: RemixNode): void
    }> = []
    let router: SPAProps['router'] = {
      fetch(url, init) {
        let signal = init.signal
        if (!(signal instanceof AbortSignal)) throw new Error('Expected a navigation signal')

        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
          loads.push({ url, signal, resolve })
        })
      },
    }
    let { container, act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => loads[0]?.resolve('Initial'))

    let firstNavigation = window.navigation.navigate(new URL('/first', window.location.href).href)
    let firstFinished = firstNavigation.finished.catch(() => {})
    await waitFor(() => loads.length === 2)

    let secondNavigation = window.navigation.navigate(new URL('/second', window.location.href).href)
    await waitFor(() => loads.length === 3)

    expect(loads[1]?.signal.aborted).toBe(true)
    await act(async () => {
      loads[2]?.resolve('Second')
      await Promise.all([firstFinished, secondNavigation.finished])
    })

    expect(container.textContent).toBe('Second')
  })

  it('submits forms and replaces history at the active URL', async (t) => {
    restoreLocationAfterTest(t)

    let initialPage = Promise.withResolvers<RemixNode>()
    let requests: Array<{ url: URL; init: RequestInit }> = []
    let router: SPAProps['router'] = {
      async fetch(url, init) {
        requests.push({ url, init })
        if (requests.length === 1) return initialPage.promise
        return 'Page'
      },
    }
    let { act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => initialPage.resolve('Page'))

    let entriesBeforeSubmission = window.navigation.entries().length
    let form = document.createElement('form')
    form.method = 'POST'
    form.action = window.location.href
    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'Ada'
    form.append(input)
    document.body.append(form)
    t.after(() => form.remove())

    let navigationSucceeded = new Promise<void>((resolve) => {
      window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
    })
    await act(async () => {
      form.requestSubmit()
      await navigationSucceeded
    })

    let request = requests.at(-1)
    expect(request?.url).toEqual(new URL(window.location.href))
    expect(request?.init.method).toBe('POST')
    expect(request?.init.signal).toBeInstanceOf(AbortSignal)
    expect(request?.init.body).toBeInstanceOf(FormData)
    if (!(request?.init.body instanceof FormData)) throw new Error('Expected form data')
    expect(Array.from(request.init.body.entries())).toEqual([['name', 'Ada']])
    expect(window.navigation.entries().length).toBe(entriesBeforeSubmission)
  })
})
