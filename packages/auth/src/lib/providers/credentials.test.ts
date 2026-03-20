import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { RequestContext } from '@remix-run/fetch-router'

import { createCredentialsAuthProvider } from './credentials.ts'

describe('credentials provider', () => {
  it('defaults the provider name to password and preserves the configured hooks', () => {
    let parse = (context: RequestContext) => ({
      email: String(context.url.searchParams.get('email') ?? ''),
    })
    let verify = (input: { email: string }) => (input.email.length > 0 ? { id: 'u1' } : null)

    let provider = createCredentialsAuthProvider({
      parse,
      verify,
    })

    assert.equal(provider.name, 'password')
    assert.equal(provider.parse, parse)
    assert.equal(provider.verify, verify)
  })

  it('uses the configured provider name', () => {
    let provider = createCredentialsAuthProvider({
      name: 'email-link',
      parse(_context: RequestContext) {
        return {
          email: '',
        }
      },
      verify() {
        return null
      },
    })

    assert.equal(provider.name, 'email-link')
  })
})
