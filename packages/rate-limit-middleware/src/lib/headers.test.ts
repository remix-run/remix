import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  createRateLimitHeaderValues,
  serializeRateLimitHeader,
  serializeRateLimitPolicyHeader,
} from './headers.ts'

describe('rate limit headers', () => {
  it('serializes the RateLimit header', () => {
    let value = serializeRateLimitHeader({
      limit: 100,
      remaining: 99,
      reset: 60,
      window: 60,
    })

    assert.equal(value, 'limit=100, remaining=99, reset=60')
  })

  it('serializes the RateLimit-Policy header', () => {
    let value = serializeRateLimitPolicyHeader({
      limit: 100,
      remaining: 99,
      reset: 60,
      window: 60,
    })

    assert.equal(value, '100;w=60')
  })

  it('serializes both header values', () => {
    let values = createRateLimitHeaderValues({
      limit: 10,
      remaining: 0,
      reset: 30,
      window: 30,
    })

    assert.deepEqual(values, {
      rateLimit: 'limit=10, remaining=0, reset=30',
      rateLimitPolicy: '10;w=30',
    })
  })
})
