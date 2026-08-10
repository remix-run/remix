import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createHmrReadyFetch, type NodeHmrRunner } from './index.ts'

describe('createHmrReadyFetch', () => {
  it('waits for the runner to be ready before fetching', async () => {
    let ready = createDeferred()
    let runner = createMockRunner({ ready: () => ready.promise })
    let fetchCount = 0
    let fetch = createHmrReadyFetch(runner, () => {
      fetchCount += 1
      return new Response('ready')
    })

    let responsePromise = fetch(new Request('https://remix.run/'))
    await Promise.resolve()

    assert.equal(fetchCount, 0)

    ready.resolve()
    let response = await responsePromise

    assert.equal(fetchCount, 1)
    assert.equal(await response.text(), 'ready')
  })

  it('returns retryable responses when the runner generation does not change', async () => {
    let runner = createMockRunner()
    let fetch = createHmrReadyFetch(runner, () => new Response('unavailable', { status: 503 }))

    let response = await fetch(new Request('https://remix.run/'))

    assert.equal(response.status, 503)
    assert.equal(await response.text(), 'unavailable')
  })

  it('retries safe unavailable responses when the runner generation changes', async () => {
    let runner = createMockRunner()
    let fetchCount = 0
    let fetch = createHmrReadyFetch(runner, () => {
      fetchCount += 1
      if (fetchCount === 1) {
        runner.generation = 1
        return new Response('stale', { status: 503 })
      }
      return new Response('fresh')
    })

    let response = await fetch(new Request('https://remix.run/'))

    assert.equal(fetchCount, 2)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'fresh')
  })

  it('throws retryable errors when the runner generation does not change', async () => {
    let runner = createMockRunner()
    let fetchError = new Error('fetch failed')
    let fetch = createHmrReadyFetch(runner, () => {
      throw fetchError
    })

    await assert.rejects(fetch(new Request('https://remix.run/')), fetchError)
  })

  it('retries safe thrown errors when the runner generation changes', async () => {
    let runner = createMockRunner()
    let fetchCount = 0
    let fetch = createHmrReadyFetch(runner, () => {
      fetchCount += 1
      if (fetchCount === 1) {
        runner.generation = 1
        throw new Error('fetch failed')
      }
      return new Response('fresh')
    })

    let response = await fetch(new Request('https://remix.run/'))

    assert.equal(fetchCount, 2)
    assert.equal(await response.text(), 'fresh')
  })

  it('does not retry unsafe methods by default', async () => {
    let runner = createMockRunner()
    let fetchCount = 0
    let fetch = createHmrReadyFetch(runner, () => {
      fetchCount += 1
      runner.generation = 1
      return new Response('unavailable', { status: 503 })
    })

    let response = await fetch(new Request('https://remix.run/', { method: 'POST' }))

    assert.equal(fetchCount, 1)
    assert.equal(response.status, 503)
  })

  it('uses custom retry predicates for responses and errors', async () => {
    let runner = createMockRunner()
    let fetchCount = 0
    let retryContextCount = 0
    let fetch = createHmrReadyFetch(
      runner,
      () => {
        fetchCount += 1
        runner.generation = fetchCount

        if (fetchCount === 1) {
          return new Response('conflict', { status: 409 })
        }

        if (fetchCount === 2) {
          throw new TypeError('socket closed')
        }

        return new Response('fresh')
      },
      {
        shouldRetry({ error, response }) {
          retryContextCount += 1

          return (
            response?.status === 409 ||
            (error instanceof TypeError && error.message === 'socket closed')
          )
        },
      },
    )

    let response = await fetch(new Request('https://remix.run/'))

    assert.equal(fetchCount, 3)
    assert.equal(retryContextCount, 3)
    assert.equal(await response.text(), 'fresh')
  })
})

function createMockRunner(options: { ready?: () => Promise<void> } = {}): NodeHmrRunner & {
  generation: number
} {
  return {
    generation: 0,
    close() {
      return Promise.resolve()
    },
    ready() {
      return options.ready?.() ?? Promise.resolve()
    },
  }
}

function createDeferred(): { promise: Promise<void>; resolve(): void } {
  let resolvePromise: (() => void) | undefined
  let promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve() {
      if (resolvePromise === undefined) {
        throw new Error('Deferred promise has no resolver')
      }
      resolvePromise()
    },
  }
}
