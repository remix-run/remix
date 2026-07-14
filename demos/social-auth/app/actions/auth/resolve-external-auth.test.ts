import * as path from 'node:path'
import * as assert from 'remix/assert'
import { createMigrator } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { beforeEach, describe, it } from 'remix/test'

import { seed } from '../../../db/seed.ts'
import { database } from '../../data/database.ts'
import { authAccounts } from '../../data/schema.ts'
import { resolveExternalAuth } from './resolve-external-auth.ts'

const migrator = createMigrator(
  await loadMigrations(path.join(import.meta.dirname, '../../../db/migrations')),
)

beforeEach(async () => {
  await database.drop()
  await database.create()
  await using db = await database.connect()
  await migrator.migrate(db)
  await seed(db)
})

describe('resolve external auth helper', () => {
  it('links an external account to an existing user by email', async () => {
    await using db = await database.connect()

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
    await using db = await database.connect()

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
})

