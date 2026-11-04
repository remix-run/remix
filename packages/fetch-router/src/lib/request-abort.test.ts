import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { raceRequestAbort } from './request-abort.ts'

describe('raceRequestAbort', () => {
  it('resolves when promise resolves before abort', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    let promise = Promise.resolve('success')

    let result = await raceRequestAbort(promise, request)

    assert.equal(result, 'success')
  })

  it('rejects when promise rejects before abort', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    let promise = Promise.reject(new Error('failed'))

    await assert.rejects(
      async () => {
        await raceRequestAbort(promise, request)
      },
      (error: any) => {
        assert.equal(error.message, 'failed')
        return true
      },
    )
  })

  it('throws AbortError when signal is already aborted', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    let promise = Promise.resolve('success')

    controller.abort()

    await assert.rejects(
      async () => {
        await raceRequestAbort(promise, request)
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('throws AbortError when signal is aborted during promise execution', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    let promise = new Promise<string>(() => {})
    let result = raceRequestAbort(promise, request)

    controller.abort()

    await assert.rejects(
      async () => {
        await result
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )
  })

  it('cancels a response body that resolves after abort', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    let resolveResponse: ((response: Response) => void) | undefined
    let promise = new Promise<Response>((resolve) => {
      resolveResponse = resolve
    })
    let result = raceRequestAbort(promise, request)
    let reason = new Error('Request cancelled')

    controller.abort(reason)
    await assert.rejects(result, reason)

    let cancelled = new Promise<unknown>((resolve) => {
      resolveResponse?.(new Response(new ReadableStream({ cancel: resolve })))
    })

    assert.equal(await cancelled, reason)
  })

  it('cancels a response body when the signal was already aborted', async () => {
    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    let reason = new Error('Request cancelled')
    let cancelled = new Promise<unknown>((resolve) => {
      controller.abort(reason)
      assert.throws(
        () =>
          raceRequestAbort(
            Promise.resolve(new Response(new ReadableStream({ cancel: resolve }))),
            request,
          ),
        reason,
      )
    })

    assert.equal(await cancelled, reason)
  })
})
