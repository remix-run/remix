import { after, before, describe } from 'node:test'
import { createClient, type RedisClientType } from 'redis'

import { runJobBackendContract } from '../../../job/src/lib/test/backend-contract.ts'

import { createRedisJobBackend } from './backend.ts'
import type { RedisJobBackendClient } from './backend.ts'

let integrationEnabled =
  process.env.JOB_REDIS_INTEGRATION === '1' && typeof process.env.JOB_REDIS_URL === 'string'

describe('redis job backend (integration)', () => {
  let redis: RedisClientType

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    redis = createClient({
      url: process.env.JOB_REDIS_URL,
    })

    redis.on('error', () => {
      // Errors will fail Redis commands in tests.
    })

    await redis.connect()
    await redis.flushDb()
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await redis.quit()
  })

  runJobBackendContract('redis contract', {
    integrationEnabled,
    setup: async () => {
      await redis.flushDb()
    },
    createBackend: async () =>
      createRedisJobBackend({
        redis: redis as unknown as RedisJobBackendClient,
        prefix: 'job_test:',
      }),
  })
})
