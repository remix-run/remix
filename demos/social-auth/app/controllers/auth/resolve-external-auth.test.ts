import * as assert from 'remix/assert'
import type { AtmosphereAuthProfile, OAuthDpopTokens, OAuthResult } from 'remix/auth'
import { beforeEach, describe, it } from 'remix/test'

import { authAccounts } from '../../data/schema.ts'
import { db, resetSocialAuthDatabase } from '../../data/setup.ts'
import { resolveExternalAuth } from './resolve-external-auth.ts'

beforeEach(async () => {
  await resetSocialAuthDatabase()
})

describe('resolve external auth helper', () => {
  it('links an external account to an existing user by email', async () => {
    let resolved = await resolveExternalAuth(db, {
      provider: 'google',
      account: { provider: 'google', providerAccountId: 'google-user-1' },
      profile: {
        sub: 'google-user-1',
        email: 'user@example.com',
        email_verified: true,
        name: 'Updated Demo User',
        picture: 'https://example.com/avatar.png',
      },
      tokens: { accessToken: 'token', tokenType: 'bearer' },
    })

    assert.equal(resolved.user.id, 2)
    assert.equal(resolved.user.name, 'Updated Demo User')
    assert.equal(resolved.authAccount.provider, 'google')
    assert.equal(resolved.authAccount.user_id, 2)
  })

  it('updates an existing linked external account on later logins', async () => {
    let first = await resolveExternalAuth(db, {
      provider: 'github',
      account: { provider: 'github', providerAccountId: 'github-user-1' },
      profile: {
        id: 10,
        login: 'demo-user',
        email: 'demo-user@example.com',
        name: 'Demo User',
        avatar_url: 'https://example.com/old-avatar.png',
      },
      tokens: { accessToken: 'token', tokenType: 'bearer' },
    })

    let second = await resolveExternalAuth(db, {
      provider: 'github',
      account: { provider: 'github', providerAccountId: 'github-user-1' },
      profile: {
        id: 10,
        login: 'demo-user',
        email: 'demo-user@example.com',
        name: 'Demo User Renamed',
        avatar_url: 'https://example.com/new-avatar.png',
      },
      tokens: { accessToken: 'token', tokenType: 'bearer' },
    })

    let account = await db.find(authAccounts, first.authAccount.id)

    assert.equal(second.user.id, first.user.id)
    assert.ok(account)
    assert.equal(account.display_name, 'Demo User Renamed')
    assert.equal(account.avatar_url, 'https://example.com/new-avatar.png')
  })

  it('relays Atmosphere DPoP nonce updates back onto the token bundle', async () => {
    let originalFetch = globalThis.fetch
    let dpop = await createDpopBinding()

    globalThis.fetch = async () =>
      Response.json(
        {
          value: {
            displayName: 'Updated Atmosphere Name',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'DPoP-Nonce': 'updated-atmosphere-nonce',
          },
        },
      )

    try {
      let tokens = {
        accessToken: 'token',
        refreshToken: 'refresh-token',
        tokenType: 'DPoP' as const,
        dpop,
      }
      let result: OAuthResult<AtmosphereAuthProfile, 'atmosphere', OAuthDpopTokens> = {
        provider: 'atmosphere',
        account: { provider: 'atmosphere', providerAccountId: 'did:plc:alice' },
        profile: {
          did: 'did:plc:alice',
          handle: 'alice.example.com',
          pdsUrl: 'https://pds.example.com',
          authorizationServer: 'https://auth.example.com',
        },
        tokens,
      }

      await resolveExternalAuth(db, result)

      assert.equal(tokens.dpop.nonce, 'updated-atmosphere-nonce')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

async function createDpopBinding(): Promise<{
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
  nonce?: string
}> {
  let keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  let publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey
  let privateJwk = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey

  return {
    publicJwk: {
      crv: publicJwk.crv,
      kty: publicJwk.kty,
      x: publicJwk.x,
      y: publicJwk.y,
    },
    privateJwk,
  }
}
