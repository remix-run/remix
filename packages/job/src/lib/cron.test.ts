import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getCronDispatchCount, getNextCronRunAt } from './cron.ts'

describe('cron utilities', () => {
  it('finds the next run for a 5-field cron expression', () => {
    let now = Date.UTC(2026, 0, 1, 0, 0, 0)
    let next = getNextCronRunAt('*/5 * * * *', now, 'UTC')

    assert.equal(next, Date.UTC(2026, 0, 1, 0, 5, 0))
  })

  it('supports timezone-aware matching', () => {
    let now = Date.UTC(2026, 0, 1, 4, 29, 0)
    let next = getNextCronRunAt('30 23 * * *', now, 'America/New_York')

    assert.equal(next, Date.UTC(2026, 0, 1, 4, 30, 0))
  })

  it('computes catch-up dispatch counts', () => {
    let nextRunAt = Date.UTC(2026, 0, 1, 0, 0, 0)
    let now = Date.UTC(2026, 0, 1, 0, 5, 0)

    assert.equal(getCronDispatchCount('* * * * *', 'UTC', 'none', nextRunAt, now), 0)
    assert.equal(getCronDispatchCount('* * * * *', 'UTC', 'one', nextRunAt, now), 1)
    assert.equal(getCronDispatchCount('* * * * *', 'UTC', 'all', nextRunAt, now), 6)
  })
})
