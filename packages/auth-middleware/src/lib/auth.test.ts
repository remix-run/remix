import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'

import { auth } from './auth.ts'
import type { AuthScheme } from './types.ts'

describe('auth middleware', () => {
  it('throws when no schemes are configured', () => {
    assert.throws(() => auth({ schemes: [] }), new Error('auth() requires at least one authentication scheme'))
  })

  it('authenticates with the first successful scheme', async () => {
    let callLog: string[] = []

    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                callLog.push('bearer')
                return {
                  status: 'success',
                  principal: { id: 1 },
                }
              },
            },
            {
              name: 'api-key',
              authenticate() {
                callLog.push('api-key')
                return {
                  status: 'success',
                  principal: { id: 2 },
                }
              },
            },
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.auth))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      authenticated: true,
      principal: { id: 1 },
      scheme: 'bearer',
    })
    assert.deepEqual(callLog, ['bearer'])
  })

  it('continues through null/undefined skip results until one succeeds', async () => {
    let callLog: string[] = []

    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                callLog.push('bearer')
                return null
              },
            },
            {
              name: 'api-key',
              authenticate() {
                callLog.push('api-key')
                return {
                  status: 'success',
                  principal: { id: 123 },
                }
              },
            },
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.auth))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      authenticated: true,
      principal: { id: 123 },
      scheme: 'api-key',
    })
    assert.deepEqual(callLog, ['bearer', 'api-key'])
  })

  it('treats undefined authenticate results as implicit skip', async () => {
    let callLog: string[] = []

    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'custom',
              authenticate() {
                callLog.push('custom')
              },
            },
            {
              name: 'api-key',
              authenticate() {
                callLog.push('api-key')
                return {
                  status: 'success',
                  principal: { id: 456 },
                }
              },
            },
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.auth))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      authenticated: true,
      principal: { id: 456 },
      scheme: 'api-key',
    })
    assert.deepEqual(callLog, ['custom', 'api-key'])
  })

  it('sets unauthenticated state with no error when all schemes skip', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                return null
              },
            },
            {
              name: 'api-key',
              authenticate() {
                return
              },
            },
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.auth))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      authenticated: false,
    })
  })

  it('rejects legacy { status: \"skip\" } results', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'legacy',
              authenticate() {
                return { status: 'skip' } as any
              },
            },
          ],
        }),
      ],
    })

    router.get('/', () => new Response('OK'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Invalid result from "legacy" auth scheme. Return null/undefined to skip, or a { status: \'success\' | \'failure\' } object.'))
  })

  it('stops on failure and records auth error details', async () => {
    let callLog: string[] = []

    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                callLog.push('bearer')
                return {
                  status: 'failure',
                  code: 'invalid_credentials',
                  message: 'Token is invalid',
                  challenge: 'Bearer realm="api"',
                }
              },
            },
            {
              name: 'api-key',
              authenticate() {
                callLog.push('api-key')
                return { status: 'success', principal: { id: 1 } }
              },
            },
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.auth))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      authenticated: false,
      error: {
        scheme: 'bearer',
        code: 'invalid_credentials',
        message: 'Token is invalid',
        challenge: 'Bearer realm="api"',
      },
    })
    assert.deepEqual(callLog, ['bearer'])
  })

  it('bubbles thrown errors from schemes', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                throw new Error('Verifier failed')
              },
            },
          ],
        }),
      ],
    })

    router.get('/', () => new Response('OK'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Verifier failed'))
  })

  it('uses default failure message and code when failure payload is empty', async () => {
    let schemes: AuthScheme[] = [
      {
        name: 'bearer',
        authenticate() {
          return { status: 'failure' }
        },
      },
    ]

    let router = createRouter({
      middleware: [auth({ schemes })],
    })

    router.get('/', (context) => Response.json(context.auth))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      authenticated: false,
      error: {
        scheme: 'bearer',
        code: 'invalid_credentials',
        message: 'Invalid credentials',
      },
    })
  })
})
