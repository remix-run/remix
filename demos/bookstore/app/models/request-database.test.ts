import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getRequestDatabase } from './request-database.ts'
import { router } from '../router.ts'

describe('request database', () => {
  it('returns the request database when middleware is installed', async () => {
    let database = await router.run('https://remix.run/request-database', () => getRequestDatabase())
    assert.ok(database)
  })

  it('throws when request database middleware is not installed', () => {
    assert.throws(
      () => getRequestDatabase(),
      /No request database found\. Set up asyncContext\(\) and loadDatabase\(\) middleware before using model functions\./,
    )
  })
})
