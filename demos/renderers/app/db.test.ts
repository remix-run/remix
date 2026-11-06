import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'

import { entries } from './data/schema.ts'
import { db, loadAppMigrations, loadAppSeed } from './db.ts'

beforeEach(async () => {
  await db.reset({ migrations: await loadAppMigrations(), seed: await loadAppSeed() })
})

describe('guestbook database', () => {
  it('seeds the starter entries in signing order', async () => {
    let rows = await db.findMany(entries, { orderBy: ['signed_at', 'desc'] })

    assert.deepEqual(
      rows.map((row) => row.name),
      ['Ada', 'Grace'],
    )
  })

  it('does not duplicate seed data when seeded again', async () => {
    let seed = await loadAppSeed()
    await seed(db)

    let rows = await db.findMany(entries)
    assert.equal(rows.length, 2)
  })
})
