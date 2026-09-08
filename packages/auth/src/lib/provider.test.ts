import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import type { OAuthTokens } from '../index.ts'
import {
  createOAuthProvider,
  finishExternalAuth,
  refreshExternalAuth,
  startExternalAuth,
} from '../index.ts'
import { createRequest } from './test-utils.ts'

interface CommunityProfile {
  id: string
}

interface CommunityTokens extends OAuthTokens {
  proof: string
}

describe('createOAuthProvider()', () => {
  it('supports a complete external auth flow from the public package API', async () => {
    let provider = createCommunityProvider()
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/community', (context) => startExternalAuth(provider, context))
    router.get('/auth/community/callback', async (context) => {
      let finished = await finishExternalAuth(provider, context)

      assert.equal(finished.result.profile.id, 'community-user')
      assert.equal(finished.result.tokens.proof, 'callback-proof')
      return Response.json(finished)
    })

    let loginResponse = await router.fetch('https://app.example.com/login/community')
    let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
    let callbackResponse = await router.fetch(
      createRequest(
        `https://app.example.com/auth/community/callback?code=good-code&state=${state}`,
        loginResponse,
      ),
    )

    assert.equal(loginResponse.status, 302)
    assert.deepEqual(await callbackResponse.json(), {
      result: {
        provider: 'community',
        account: {
          provider: 'community',
          providerAccountId: 'community-user',
        },
        profile: {
          id: 'community-user',
        },
        tokens: {
          accessToken: 'community-access-token',
          proof: 'callback-proof',
        },
      },
    })
  })

  it('preserves provider-specific token types when refreshing', async () => {
    let provider = createCommunityProvider()
    let tokens: CommunityTokens = {
      accessToken: 'community-access-token',
      refreshToken: 'community-refresh-token',
      proof: 'callback-proof',
    }
    let refreshed = await refreshExternalAuth(provider, tokens)

    assert.equal(refreshed.provider, 'community')
    assert.equal(refreshed.tokens.accessToken, 'refreshed-community-access-token')
    assert.equal(refreshed.tokens.proof, 'refreshed-proof')
  })
})

function createCommunityProvider() {
  return createOAuthProvider<CommunityProfile, 'community', CommunityTokens>('community', {
    createAuthorizationURL(transaction) {
      transaction.providerState = 'encrypted-provider-state'

      let url = new URL('https://community.example.com/authorize')
      url.searchParams.set('state', transaction.state)
      return url
    },
    async handleCallback(context, transaction) {
      assert.equal(context.url.searchParams.get('code'), 'good-code')
      assert.equal(transaction.providerState, 'encrypted-provider-state')

      return {
        provider: 'community',
        account: {
          provider: 'community',
          providerAccountId: 'community-user',
        },
        profile: {
          id: 'community-user',
        },
        tokens: {
          accessToken: 'community-access-token',
          proof: 'callback-proof',
        },
      }
    },
    async refreshTokens(tokens) {
      return {
        ...tokens,
        accessToken: 'refreshed-community-access-token',
        proof: 'refreshed-proof',
      }
    },
  })
}
