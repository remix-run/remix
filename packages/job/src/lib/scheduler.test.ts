import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as s from '@remix-run/data-schema'

import type { JobStorage } from './storage.ts'
import { createJobScheduler, createJobs } from './scheduler.ts'
import { createMemoryJobStorage } from './test/memory-storage.ts'

describe('createJobScheduler', () => {
  it('enqueues and retrieves jobs', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })

    let enqueued = await scheduler.enqueue(jobs.email, { to: 'mjackson@example.com' }, { priority: 3 })
    assert.equal(enqueued.deduped, false)

    let job = await scheduler.get(enqueued.jobId)

    assert.ok(job)
    assert.equal(job.name, 'email')
    assert.equal(job.queue, 'default')
    assert.equal(job.priority, 3)
    assert.deepEqual(job.payload, { to: 'mjackson@example.com' })
  })

  it('supports dedupe keys', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })

    let first = await scheduler.enqueue(jobs.email, { to: 'a@example.com' }, {
      dedupeKey: 'email:a@example.com',
      dedupeTtlMs: 1000,
    })
    let second = await scheduler.enqueue(jobs.email, { to: 'a@example.com' }, {
      dedupeKey: 'email:a@example.com',
      dedupeTtlMs: 1000,
    })

    assert.equal(first.deduped, false)
    assert.equal(second.deduped, true)
    assert.equal(second.jobId, first.jobId)
  })

  it('validates payload with data-schema', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })

    await assert.rejects(() => scheduler.enqueue(jobs.email, { to: 123 } as any))
  })

  it('rejects unknown job definitions passed to enqueue', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })

    let unknownJob = {
      schema: s.object({ to: s.string() }),
      async handle() {},
    }

    await assert.rejects(
      () => scheduler.enqueue(unknownJob as any, { to: 'oops@example.com' }),
      /Unknown job definition passed to enqueue/,
    )
  })

  it('cancels queued jobs', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })

    let enqueued = await scheduler.enqueue(jobs.email, { to: 'x@example.com' })

    assert.equal(await scheduler.cancel(enqueued.jobId), true)
    assert.equal(await scheduler.cancel(enqueued.jobId), false)

    let job = await scheduler.get(enqueued.jobId)
    assert.ok(job)
    assert.equal(job.status, 'canceled')
  })
})

function createTransactionAwareTestStorage(): JobStorage<{ id: string }> {
  let storage = createMemoryJobStorage()

  return {
    ...storage,
    enqueue(input, _options) {
      return storage.enqueue(input)
    },
    cancel(jobId, _options) {
      return storage.cancel(jobId)
    },
  }
}

function assertTransactionOptionTyping(): void {
  let jobs = createJobs({
    email: {
      schema: s.object({ to: s.string() }),
      async handle() {},
    },
  })

  let txScheduler = createJobScheduler({
    jobs,
    storage: createTransactionAwareTestStorage(),
  })

  void txScheduler.enqueue(jobs.email, { to: 'tx@example.com' }, {
    transaction: { id: 'tx1' },
  })
  void txScheduler.cancel('job-id', {
    transaction: { id: 'tx1' },
  })

  let memoryScheduler = createJobScheduler({
    jobs,
    storage: createMemoryJobStorage(),
  })

  // @ts-expect-error Memory storage does not declare transaction support.
  void memoryScheduler.enqueue(jobs.email, { to: 'memory@example.com' }, { transaction: { id: 'tx1' } })
  // @ts-expect-error Memory storage does not declare transaction support.
  void memoryScheduler.cancel('job-id', { transaction: { id: 'tx1' } })
}

void assertTransactionOptionTyping
