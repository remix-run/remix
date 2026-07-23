import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import type { Handle, RemixNode } from '@remix-run/ui'
import { createSPA, SPA, type SPAMeta, type SPAProps } from '@remix-run/ui/spa'
import { render } from '@remix-run/ui/test'

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

function PageWithLink(
  handle: Handle<{
    href: string
    document?: boolean
    history?: 'push' | 'replace'
  }>,
) {
  return () => (
    <>
      <RouterState />
      <a
        href={handle.props.href}
        rmx-document={handle.props.document ? '' : undefined}
        rmx-history={handle.props.history}
      >
        Next
      </a>
    </>
  )
}

function waitForNavigationSuccess(): Promise<void> {
  let navigationSucceeded = Promise.withResolvers<void>()
  window.navigation.addEventListener('navigatesuccess', () => navigationSucceeded.resolve(), {
    once: true,
  })
  return navigationSucceeded.promise
}

function CustomSPA(handle: Handle<SPAProps>) {
  let spa = createSPA(handle, handle.props)
  let context = spa.context
  return () => (
    <main data-active={context.active.pathname} data-pending={context.pending?.pathname}>
      {spa.node}
    </main>
  )
}

describe('SPA', () => {
  it('exposes stable runtime-readonly SPA state', (t) => {
    let created: { current?: SPAMeta } = {}

    function TestSPA(handle: Handle<SPAProps>) {
      let spa = createSPA(handle, handle.props)
      created.current = spa
      return () => spa.node
    }

    let router: SPAProps['router'] = {
      async fetch() {
        return 'Page'
      },
    }
    let { cleanup } = render(<TestSPA router={router} fallback="Loading" />)
    t.after(cleanup)

    let spa = created.current
    if (!spa) throw new Error('Expected SPA state')

    let context = spa.context
    expect(spa.context).toBe(context)
    expect(Reflect.set(spa, 'context', context)).toBe(false)
    expect(Reflect.set(spa, 'node', 'Other')).toBe(false)
  })

  it('composes SPA navigation into a custom component', async (t) => {
    let page = Promise.withResolvers<RemixNode>()
    let router: SPAProps['router'] = {
      fetch() {
        return page.promise
      },
    }
    let { $, act, cleanup } = render(<CustomSPA router={router} fallback="Loading" />)
    t.after(cleanup)

    expect($('main')?.textContent).toBe('Loading')
    expect($('main')?.getAttribute('data-pending')).toBe(window.location.pathname)

    await act(() => page.resolve('Page'))

    expect($('main')?.textContent).toBe('Page')
    expect($('main')?.getAttribute('data-active')).toBe(window.location.pathname)
    expect($('main')?.hasAttribute('data-pending')).toBe(false)
  })

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

  it('leaves links with rmx-document to document navigation', async (t) => {
    restoreLocationAfterTest(t)

    let initialUrl = window.location.href
    let destination = new URL(initialUrl)
    destination.searchParams.set('spa-navigation', 'document-link')
    let requests: URL[] = []
    let router: SPAProps['router'] = {
      async fetch(url) {
        requests.push(url)
        return url.href === initialUrl ? (
          <PageWithLink href={destination.href} document />
        ) : (
          'Intercepted'
        )
      },
    }
    let { $, act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => {})

    let keepTestPageLoaded = (event: NavigateEvent) => {
      if (event.destination.url === destination.href) {
        event.intercept({ async handler() {} })
      }
    }
    window.navigation.addEventListener('navigate', keepTestPageLoaded)
    t.after(() => window.navigation.removeEventListener('navigate', keepTestPageLoaded))

    let link = $('a')
    if (!link) throw new Error('Expected link')
    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      await act(async () => {
        link.click()
        await navigationSucceeded
      })
      didNavigate = true

      expect(requests).toHaveLength(1)
    } finally {
      if (didNavigate) {
        await act(() => window.navigation.back().finished)
      }
    }
  })

  it('replaces history for links with rmx-history', async (t) => {
    restoreLocationAfterTest(t)

    let initialUrl = window.location.href
    let destination = new URL(initialUrl)
    destination.searchParams.set('spa-navigation', 'replace-link')
    let requests: URL[] = []
    let router: SPAProps['router'] = {
      async fetch(url) {
        requests.push(url)
        return url.href === initialUrl ? (
          <PageWithLink href={destination.href} history="replace" />
        ) : (
          'Next'
        )
      },
    }
    let { $, act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => {})

    let entriesBeforeNavigation = window.navigation.entries().length
    let link = $('a')
    if (!link) throw new Error('Expected link')
    let navigationSucceeded = waitForNavigationSuccess()
    await act(async () => {
      link.click()
      await navigationSucceeded
    })

    expect(requests.at(-1)).toEqual(destination)
    expect(window.navigation.entries()).toHaveLength(entriesBeforeNavigation)
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
    let firstFinished = firstNavigation.finished?.catch(() => {})
    if (!firstFinished) throw new Error('Expected first navigation to finish')
    await waitFor(() => loads.length === 2)

    let secondNavigation = window.navigation.navigate(new URL('/second', window.location.href).href)
    let secondFinished = secondNavigation.finished
    if (!secondFinished) throw new Error('Expected second navigation to finish')
    await waitFor(() => loads.length === 3)

    expect(loads[1]?.signal.aborted).toBe(true)
    await act(async () => {
      loads[2]?.resolve('Second')
      await Promise.all([firstFinished, secondFinished])
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

  it('leaves forms with rmx-document to document navigation', async (t) => {
    restoreLocationAfterTest(t)

    let initialUrl = window.location.href
    let destination = new URL(initialUrl)
    destination.searchParams.set('spa-navigation', 'document-form')
    let requests: URL[] = []
    let router: SPAProps['router'] = {
      async fetch(url) {
        requests.push(url)
        return 'Page'
      },
    }
    let { act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => {})

    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'post'
    form.setAttribute('rmx-document', '')
    document.body.append(form)
    t.after(() => form.remove())

    let keepTestPageLoaded = (event: NavigateEvent) => {
      if (event.destination.url === destination.href) {
        event.intercept({ async handler() {} })
      }
    }
    window.navigation.addEventListener('navigate', keepTestPageLoaded)
    t.after(() => window.navigation.removeEventListener('navigate', keepTestPageLoaded))

    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      await act(async () => {
        form.requestSubmit()
        await navigationSucceeded
      })
      didNavigate = true

      expect(requests).toHaveLength(1)
    } finally {
      if (didNavigate) {
        await act(() => window.navigation.back().finished)
      }
    }
  })

  it('replaces history for GET forms with rmx-history', async (t) => {
    restoreLocationAfterTest(t)

    let requests: URL[] = []
    let router: SPAProps['router'] = {
      async fetch(url) {
        requests.push(url)
        return 'Page'
      },
    }
    let { act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => {})

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    form.setAttribute('rmx-history', 'replace')
    let input = document.createElement('input')
    input.name = 'query'
    input.value = 'remix'
    form.append(input)
    document.body.append(form)
    t.after(() => form.remove())

    let entriesBeforeSubmission = window.navigation.entries().length
    let navigationSucceeded = waitForNavigationSuccess()
    await act(async () => {
      form.requestSubmit()
      await navigationSucceeded
    })

    expect(requests.at(-1)?.searchParams.get('query')).toBe('remix')
    expect(window.navigation.entries()).toHaveLength(entriesBeforeSubmission)
  })

  it('replaces history for non-GET forms with rmx-history', async (t) => {
    restoreLocationAfterTest(t)

    let destination = new URL(window.location.href)
    destination.searchParams.set('spa-navigation', 'replace-form')
    let requests: Array<{ url: URL; init: RequestInit }> = []
    let router: SPAProps['router'] = {
      async fetch(url, init) {
        requests.push({ url, init })
        return 'Page'
      },
    }
    let { act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => {})

    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'post'
    form.setAttribute('rmx-history', 'replace')
    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'Ada'
    form.append(input)
    document.body.append(form)
    t.after(() => form.remove())

    let entriesBeforeSubmission = window.navigation.entries().length
    let navigationSucceeded = waitForNavigationSuccess()
    await act(async () => {
      form.requestSubmit()
      await navigationSucceeded
    })

    let request = requests.at(-1)
    expect(request?.url).toEqual(destination)
    expect(request?.init.method).toBe('POST')
    expect(request?.init.body).toBeInstanceOf(FormData)
    expect(window.navigation.entries()).toHaveLength(entriesBeforeSubmission)
  })

  it('pushes same-location non-GET forms when rmx-history is push', async (t) => {
    restoreLocationAfterTest(t)

    let router: SPAProps['router'] = {
      async fetch() {
        return 'Page'
      },
    }
    let { act, cleanup } = render(<SPA router={router} fallback="Loading" />)
    t.after(cleanup)
    await act(() => {})

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    form.setAttribute('rmx-history', 'push')
    document.body.append(form)
    t.after(() => form.remove())

    let entryBeforeSubmission = window.navigation.currentEntry
    if (!entryBeforeSubmission) throw new Error('Expected current navigation entry')
    let didNavigate = false
    try {
      let navigationSucceeded = waitForNavigationSuccess()
      await act(async () => {
        form.requestSubmit()
        await navigationSucceeded
      })
      didNavigate = true

      expect(window.navigation.currentEntry?.index).toBe(entryBeforeSubmission.index + 1)
    } finally {
      if (didNavigate) {
        await act(() => window.navigation.back().finished)
      }
    }
  })
})
