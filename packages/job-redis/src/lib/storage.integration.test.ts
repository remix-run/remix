import { after, before, describe } from '@remix-run/test'
import { createClient, type RedisClientType } from 'redis'

import { runJobStorageContract } from '../../../job/src/lib/test/storage-contract.ts'

import { createRedisJobStorage } from './storage.ts'
import type { RedisJobStorageClient } from './storage.ts'

let integrationEnabled =
  process.env.JOB_REDIS_INTEGRATION === '1' && typeof process.env.JOB_REDIS_URL === 'string'

describe('redis job storage (integration)', () => {
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

  runJobStorageContract('redis contract', {
    integrationEnabled,
    setup: async () => {
      await redis.flushDb()
    },
    createStorage: async () =>
      createRedisJobStorage(redis as unknown as RedisJobStorageClient, { prefix: 'job_test:' }),
  })
})
