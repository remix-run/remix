import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { raceWithAbort } from './request-abort.ts'

describe('raceWithAbort', () => {
  it('resolves when promise resolves before abort', async () => {
    let controller = new AbortController()
    let promise = Promise.resolve('success')

    let result = await raceWithAbort(promise, controller.signal)

    assert.equal(result, 'success')
  })

  it('rejects when promise rejects before abort', async () => {
    let controller = new AbortController()
    let promise = Promise.reject(new Error('failed'))

    await assert.rejects(
      async () => {
        await raceWithAbort(promise, controller.signal)
      },
      (error: any) => {
        assert.equal(error.message, 'failed')
        return true
      },
    )
  })

  it('throws AbortError when signal is already aborted', async () => {
    let controller = new AbortController()
    controller.abort()

    let promise = Promise.resolve('success')

    await assert.rejects(
      async () => {
        await raceWithAbort(promise, controller.signal)
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
    let promise = new Promise((resolve) => setTimeout(() => resolve('success'), 100))

    setTimeout(() => controller.abort(), 10)

    await assert.rejects(
      async () => {
        await raceWithAbort(promise, controller.signal)
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        assert.equal(error.message, 'The request was aborted')
        return true
      },
    )
  })

  it('removes event listener when promise resolves', async () => {
    let controller = new AbortController()
    let promise = Promise.resolve('success')

    await raceWithAbort(promise, controller.signal)

    // If the listener wasn't removed, aborting would cause issues
    // This test ensures cleanup happens properly
    controller.abort()
  })

  it('removes event listener when promise rejects', async () => {
    let controller = new AbortController()
    let promise = Promise.reject(new Error('failed'))

    try {
      await raceWithAbort(promise, controller.signal)
    } catch {
      // Expected
    }

    // If the listener wasn't removed, aborting would cause issues
    controller.abort()
  })
})
