import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

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
    let promise = new Promise((resolve) => setTimeout(() => resolve('success'), 100))

    setTimeout(() => controller.abort(), 10)

    await assert.rejects(
      async () => {
        await raceRequestAbort(promise, request)
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )
  })
})
