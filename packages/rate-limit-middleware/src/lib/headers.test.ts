import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRateLimitHeaderValues } from './headers.ts'

describe('RateLimit response fields', () => {
  it('serializes a named policy using the current structured field syntax', () => {
    let values = createRateLimitHeaderValues(
      {
        count: 1,
        limit: 100,
        name: 'api',
        remaining: 99,
        resetAt: 61_000,
        retryAfter: 60,
      },
      60_000,
    )

    assert.deepEqual(values, {
      rateLimit: '"api";r=99;t=60',
      rateLimitPolicy: '"api";q=100;w=60',
    })
  })

  it('rounds sub-second windows up to one second', () => {
    let values = createRateLimitHeaderValues(
      {
        count: 1,
        limit: 1,
        name: 'burst',
        remaining: 0,
        resetAt: 1_001,
        retryAfter: 1,
      },
      1,
    )

    assert.equal(values.rateLimitPolicy, '"burst";q=1;w=1')
  })
})
