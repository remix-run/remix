import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'

import { emailAuthEntries } from '../data/schema.ts'
import { db, loadAppMigrations, loadAppSeed } from '../db.ts'
import { emailAuthStorage } from './email-auth.ts'

beforeEach(async () => {
  await db.reset({ migrations: await loadAppMigrations(), seed: await loadAppSeed() })
})

describe('emailAuthStorage', () => {
  it('returns a stored value until it is taken', async () => {
    await emailAuthStorage.set('magic-link:token:abc', 'value', new Date(Date.now() + 60_000))

    assert.equal(await emailAuthStorage.get('magic-link:token:abc'), 'value')
    assert.equal(await emailAuthStorage.take('magic-link:token:abc'), 'value')
    assert.equal(await emailAuthStorage.take('magic-link:token:abc'), null)
    assert.equal(await emailAuthStorage.get('magic-link:token:abc'), null)
  })

  it('gives a value to only one of several concurrent takes', async () => {
    await emailAuthStorage.set('email-otp:code:abc', 'value', new Date(Date.now() + 60_000))

    let values = await Promise.all(
      Array.from({ length: 5 }, () => emailAuthStorage.take('email-otp:code:abc')),
    )

    assert.deepEqual(
      values.filter((value) => value != null),
      ['value'],
    )
  })

  it('adds a value for only one of several concurrent adds', async () => {
    let results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        emailAuthStorage.add('magic-link:resend:a', String(index), new Date(Date.now() + 60_000)),
      ),
    )

    assert.deepEqual(
      results.filter((added) => added),
      [true],
    )
  })

  it('adds over an expired value', async () => {
    await emailAuthStorage.set('magic-link:resend:a', 'old', new Date(Date.now() - 1))

    assert.equal(
      await emailAuthStorage.add('magic-link:resend:a', 'new', new Date(Date.now() + 60_000)),
      true,
    )
    assert.equal(await emailAuthStorage.get('magic-link:resend:a'), 'new')
  })

  it('replaces values and removes expired entries when storing a value', async () => {
    await emailAuthStorage.set('expired', 'old', new Date(Date.now() - 1))
    await emailAuthStorage.set('current', 'first', new Date(Date.now() + 60_000))
    await emailAuthStorage.set('current', 'second', new Date(Date.now() + 60_000))

    let keys = (await db.findMany(emailAuthEntries, {})).map((entry) => entry.key)

    assert.deepEqual(keys, ['current'])
    assert.equal(await emailAuthStorage.get('current'), 'second')
  })
})
