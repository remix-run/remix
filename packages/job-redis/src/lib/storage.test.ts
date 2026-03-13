import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRedisJobStorage } from './storage.ts'

import type { RedisJobStorageClient } from './storage.ts'

describe('createRedisJobStorage', () => {
  it('creates storage with a redis client', () => {
    let redis = {
      sendCommand(_command: string[]) {
        return Promise.resolve(null)
      },
    } satisfies RedisJobStorageClient

    let storage = createRedisJobStorage(redis)

    assert.equal(typeof storage.enqueue, 'function')
    assert.equal(typeof storage.get, 'function')
    assert.equal(typeof storage.cancel, 'function')
    assert.equal(typeof storage.listFailedJobs, 'function')
    assert.equal(typeof storage.retryFailedJob, 'function')
    assert.equal(typeof storage.prune, 'function')
  })
})

function assertRedisStorageConstructorTyping(): void {
  let redis = {
    sendCommand(_command: string[]) {
      return Promise.resolve(null)
    },
  } satisfies RedisJobStorageClient

  void createRedisJobStorage(redis)
  void createRedisJobStorage(redis, { prefix: 'job_test:' })
  // @ts-expect-error Redis client must be passed as the first argument.
  void createRedisJobStorage({ redis })
}

void assertRedisStorageConstructorTyping
