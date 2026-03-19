import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { db, resetSocialLoginDatabase, users } from './setup.ts'
import { verifyPassword } from '../utils/password.ts'

beforeEach(async () => {
  await resetSocialLoginDatabase()
})

describe('social-login data setup', () => {
  it('seeds the demo credential users', async () => {
    let admin = await db.findOne(users, { where: { email: 'admin@example.com' } })
    let user = await db.findOne(users, { where: { email: 'user@example.com' } })

    assert.ok(admin)
    assert.ok(user)
    assert.equal(admin.name, 'Demo Admin')
    assert.equal(user.name, 'Demo User')
  })

  it('stores verifiable password hashes', async () => {
    let admin = await db.findOne(users, { where: { email: 'admin@example.com' } })

    assert.ok(admin)
    assert.equal(await verifyPassword('password123', admin.password_hash), true)
    assert.equal(await verifyPassword('wrong-password', admin.password_hash), false)
  })
})
