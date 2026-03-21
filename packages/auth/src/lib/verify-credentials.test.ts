import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'

import { createCredentialsAuthProvider } from './providers/credentials.ts'
import { verifyCredentials } from './verify-credentials.ts'

describe('verifyCredentials()', () => {
  it('returns the authenticated result when credentials are valid', async () => {
    let provider = createCredentialsAuthProvider({
      parse(context) {
        let formData = context.get(FormData)
        return {
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
        }
      },
      verify(input) {
        if (input.email === 'mj@example.com' && input.password === 'secret') {
          return { id: 'u1' }
        }

        return null
      },
    })
    let router = createRouter()

    router.post('/login', {
      middleware: [formData()],
      async handler(context) {
        let result = await verifyCredentials(provider, context)
        return Response.json(result)
      },
    })

    let response = await router.fetch(
      new Request('https://app.example.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'mj@example.com',
          password: 'secret',
        }),
      }),
    )

    assert.deepEqual(await response.json(), {
      id: 'u1',
    })
  })

  it('returns null when credentials are rejected', async () => {
    let provider = createCredentialsAuthProvider({
      parse(context) {
        let formData = context.get(FormData)
        return {
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
        }
      },
      verify() {
        return null
      },
    })
    let router = createRouter()

    router.post('/login', {
      middleware: [formData()],
      async handler(context) {
        let result = await verifyCredentials(provider, context)
        return Response.json({ result })
      },
    })

    let response = await router.fetch(
      new Request('https://app.example.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'mj@example.com',
          password: 'wrong',
        }),
      }),
    )

    assert.deepEqual(await response.json(), {
      result: null,
    })
  })

  it('rethrows unexpected parse or verify errors', async () => {
    let provider = createCredentialsAuthProvider({
      parse() {
        return { email: 'mj@example.com' }
      },
      verify() {
        throw new Error('verify failed')
      },
    })

    await assert.rejects(
      verifyCredentials(provider, {} as never),
      new Error('verify failed'),
    )
  })
})
