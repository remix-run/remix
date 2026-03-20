import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { db, resetSocialAuthDatabase } from './data/setup.ts'
import { authAccounts } from './data/schema.ts'
import { parseSocialAuthSession, resolveExternalLogin } from './social-auth.ts'

beforeEach(async () => {
  await resetSocialAuthDatabase()
})

describe('social auth helpers', () => {
  it('parses a stored auth session value', () => {
    assert.deepEqual(
      parseSocialAuthSession({ userId: 2, loginMethod: 'credentials' }),
      { userId: 2, loginMethod: 'credentials', authAccountId: undefined },
    )
    assert.equal(parseSocialAuthSession({ userId: 'bad', loginMethod: 'credentials' }), null)
  })

  it('links an external account to an existing user by email', async () => {
    let resolved = await resolveExternalLogin(db, {
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
    let first = await resolveExternalLogin(db, {
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

    let second = await resolveExternalLogin(db, {
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
})
