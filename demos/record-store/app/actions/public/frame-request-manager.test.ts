import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createFrameRequestManager } from './frame-request-manager.ts'

describe('frame request manager', () => {
  it('replays a streaming prefix to navigation and keeps it alive after prefetch cancellation', async () => {
    let scope = new AbortController()
    let prefetch = new AbortController()
    let stream = streamingResponse()
    let requests: RequestInit[] = []
    let manager = createFrameRequestManager(scope.signal, async (_url, init) => {
      requests.push(init)
      return stream.response
    })
    let speculative = await manager.fetch('https://bookstore.test/books/bbq/related#ignored', {
      headers: { 'X-Remix-Target': 'related-books-1', 'X-Remix-Prefetch': 'true' },
      signal: prefetch.signal,
      priority: 'low',
    })
    let speculativeReader = speculative.body?.getReader()
    assert.ok(speculativeReader)
    stream.controller.enqueue(new TextEncoder().encode('first'))
    assert.equal(new TextDecoder().decode((await speculativeReader.read()).value), 'first')

    let existing = manager.get('https://bookstore.test/books/bbq/related', {
      headers: { 'X-Remix-Target': 'related-books-1' },
    })
    assert.ok(existing)
    let rendered = await existing
    let renderedReader = rendered.body?.getReader()
    assert.ok(renderedReader)
    assert.equal(new TextDecoder().decode((await renderedReader.read()).value), 'first')
    prefetch.abort()
    await assert.rejects(() => speculativeReader.read(), prefetch.signal.reason)
    assert.equal(requests[0].signal?.aborted, false)

    stream.controller.enqueue(new TextEncoder().encode('second'))
    stream.controller.close()
    assert.equal(new TextDecoder().decode((await renderedReader.read()).value), 'second')
    assert.equal((await renderedReader.read()).done, true)
    assert.equal(requests.length, 1)
  })

  it('joins before headers, preserves fetch metadata and discards completed responses', async () => {
    let source = await fetch('data:text/html,shared')
    let headers = Promise.withResolvers<Response>()
    let requests = 0
    let page = new URL('https://bookstore.test/books')
    let manager = createFrameRequestManager(
      new AbortController().signal,
      (_url, init) => {
        assert.equal(init.referrer, undefined)
        requests++
        return requests === 1 ? headers.promise : Promise.resolve(new Response('fresh'))
      },
      page,
    )
    let url = 'https://bookstore.test/books/bbq'
    let from = page.href
    let first = manager.fetch(url, {})
    page.href = url
    assert.equal(manager.get(url, { referrer: page.href }), undefined)
    assert.equal(manager.get(url, { referrer: '' }), undefined)
    let second = manager.get(url, { referrer: from })
    assert.ok(second)
    assert.equal(requests, 1)
    headers.resolve(source)
    let [prefetched, rendered] = await Promise.all([first, second])
    assert.equal(rendered.url, source.url)
    assert.equal(rendered.type, source.type)
    assert.equal(rendered.redirected, source.redirected)
    assert.equal(rendered.headers.get('Content-Type'), source.headers.get('Content-Type'))
    let cloned = rendered.clone()
    assert.equal(cloned.url, source.url)
    assert.deepEqual(await Promise.all([prefetched.text(), rendered.text(), cloned.text()]), [
      'shared',
      'shared',
      'shared',
    ])
    assert.equal(manager.get(url, { referrer: from }), undefined)
    assert.equal(await (await manager.fetch(url, {})).text(), 'fresh')
    assert.equal(requests, 2)
  })

  it('isolates GET variants and invalidates sharing without canceling callers across mutations', async () => {
    let requests: RequestInit[] = []
    let release = Promise.withResolvers<void>()
    let manager = createFrameRequestManager(new AbortController().signal, async (_url, init) => {
      requests.push(init)
      if (init.method === 'POST') return new Response('saved')
      await release.promise
      return new Response('done')
    })
    let url = 'https://bookstore.test/books/bbq/related'
    let init = { headers: { 'X-Remix-Target': 'first' } }
    assert.equal(manager.get(url, init), undefined)
    assert.equal(requests.length, 0)
    let first = manager.fetch(url, init)
    assert.equal(manager.get(url, { ...init, method: 'POST' }), undefined)
    assert.equal(manager.get(url, { ...init, cache: 'reload' }), undefined)
    assert.equal(manager.get(url, { headers: { 'X-Remix-Target': 'second' } }), undefined)
    let second = manager.fetch('https://bookstore.test/books/bbq/related', {
      headers: { 'X-Remix-Target': 'second' },
    })
    let differentCookie = manager.fetch('https://bookstore.test/books/bbq/related', {
      headers: { 'X-Remix-Target': 'first', Cookie: 'session=another' },
    })
    manager.invalidate()
    assert.equal(manager.get(url, init), undefined)
    let beforeMutation = manager.fetch(url, init)
    let mutation = manager.fetch('https://bookstore.test/cart/api/add', { method: 'POST' })
    let duringMutation = manager.fetch(url, init)
    assert.equal(requests.length, 6)
    await mutation
    let afterMutation = manager.fetch(url, init)
    assert.equal(requests.length, 7)
    release.resolve()
    assert.deepEqual(
      await Promise.all(
        [
          first,
          second,
          differentCookie,
          beforeMutation,
          mutation,
          duringMutation,
          afterMutation,
        ].map(async (response) => (await response).text()),
      ),
      ['done', 'done', 'done', 'done', 'saved', 'done', 'done'],
    )
  })

  it('aborts the transport when all callers cancel and permits an immediate retry', async () => {
    let requests: RequestInit[] = []
    let manager = createFrameRequestManager(new AbortController().signal, (_url, init) => {
      requests.push(init)
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    })
    let prefetch = new AbortController()
    let navigation = new AbortController()
    let first = manager.fetch('https://bookstore.test/books/bbq', { signal: prefetch.signal })
    let second = manager.get('https://bookstore.test/books/bbq', { signal: navigation.signal })
    assert.ok(second)
    prefetch.abort()
    await assert.rejects(() => first, prefetch.signal.reason)
    assert.equal(requests[0].signal?.aborted, false)
    navigation.abort()
    await assert.rejects(() => second, navigation.signal.reason)
    assert.equal(requests[0].signal?.aborted, true)

    let retry = new AbortController()
    let third = manager.fetch('https://bookstore.test/books/bbq', { signal: retry.signal })
    assert.equal(requests.length, 2)
    retry.abort()
    await assert.rejects(() => third, retry.signal.reason)
  })

  it('releases failed fetches and bodies so subsequent requests can retry', async () => {
    let stream = streamingResponse()
    let requests = 0
    let manager = createFrameRequestManager(new AbortController().signal, () => {
      requests++
      if (requests === 1) throw new Error('fetch failed')
      return Promise.resolve(requests === 2 ? stream.response : new Response('recovered'))
    })
    await assert.rejects(
      () => manager.fetch('https://bookstore.test/books/bbq', {}),
      /fetch failed/,
    )
    let first = await manager.fetch('https://bookstore.test/books/bbq', {})
    let second = await manager.fetch('https://bookstore.test/books/bbq', {})
    let firstBody = first.text()
    let secondBody = second.text()
    stream.controller.error(new Error('body failed'))
    await assert.rejects(() => firstBody, /body failed/)
    await assert.rejects(() => secondBody, /body failed/)
    assert.equal(
      await (await manager.fetch('https://bookstore.test/books/bbq', {})).text(),
      'recovered',
    )
    assert.equal(requests, 3)
  })

  it('cancels unread response bodies on disposal and rejects future work', async () => {
    let scope = new AbortController()
    let canceled = Promise.withResolvers<unknown>()
    let transportSignal: AbortSignal | null | undefined
    let manager = createFrameRequestManager(scope.signal, async (_url, init) => {
      transportSignal = init.signal
      return new Response(
        new ReadableStream({
          cancel(reason) {
            canceled.resolve(reason)
          },
          start(controller) {
            init.signal?.addEventListener(
              'abort',
              () => {
                canceled.resolve(init.signal?.reason)
                controller.error(init.signal?.reason)
              },
              { once: true },
            )
          },
        }),
      )
    })
    let response = await manager.fetch('https://bookstore.test/books/bbq', {})
    scope.abort()
    await assert.rejects(() => response.text(), scope.signal.reason)
    await canceled.promise
    assert.equal(transportSignal?.aborted, true)
    await assert.rejects(
      () => manager.fetch('https://bookstore.test/books/bbq', {}),
      scope.signal.reason,
    )
  })
})

function streamingResponse(): {
  response: Response
  controller: ReadableStreamDefaultController<Uint8Array>
} {
  let control: ReadableStreamDefaultController<Uint8Array> | undefined
  let response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        control = controller
      },
    }),
    { headers: { 'Content-Type': 'text/html' } },
  )
  assert.ok(control)
  return { response, controller: control }
}
