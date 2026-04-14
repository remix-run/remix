import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'

import { verifyPassword } from '../utils/password-hash.ts'
import { db, resetSocialAuthDatabase, users } from './setup.ts'

beforeEach(async () => {
  await resetSocialAuthDatabase()
})

describe('social-auth data setup', () => {
  it('seeds the demo credential users', async () => {
    let admin = await db.findOne(users, { where: { email: 'admin@example.com' } })
    let user = await db.findOne(users, { where: { email: 'user@example.com' } })

    assert.ok(admin)
    assert.ok(user)
    assert.equal(admin.name, 'Demo Admin')
    assert.equal(user.name, 'Demo User')
    assert.ok(admin.avatar_url)
    assert.ok(user.avatar_url)
  })

  it('stores verifiable password hashes', async () => {
    let admin = await db.findOne(users, { where: { email: 'admin@example.com' } })

    assert.ok(admin)
    assert.equal(await verifyPassword('password123', admin.password_hash), true)
    assert.equal(await verifyPassword('wrong-password', admin.password_hash), false)
  })
})
