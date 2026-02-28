import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as s from '@remix-run/data-schema'

import { createJobScheduler, createJobs } from './scheduler.ts'
import { createMemoryJobBackend } from './test/memory-backend.ts'

describe('createJobScheduler', () => {
  it('enqueues and retrieves jobs', async () => {
    let backend = createMemoryJobBackend()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, backend })

    let enqueued = await scheduler.enqueue('email', { to: 'mjackson@example.com' }, { priority: 3 })
    assert.equal(enqueued.deduped, false)

    let job = await scheduler.get(enqueued.jobId)

    assert.ok(job)
    assert.equal(job.name, 'email')
    assert.equal(job.queue, 'default')
    assert.equal(job.priority, 3)
    assert.deepEqual(job.payload, { to: 'mjackson@example.com' })
  })

  it('supports dedupe keys', async () => {
    let backend = createMemoryJobBackend()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, backend })

    let first = await scheduler.enqueue('email', { to: 'a@example.com' }, {
      dedupeKey: 'email:a@example.com',
      dedupeTtlMs: 1000,
    })
    let second = await scheduler.enqueue('email', { to: 'a@example.com' }, {
      dedupeKey: 'email:a@example.com',
      dedupeTtlMs: 1000,
    })

    assert.equal(first.deduped, false)
    assert.equal(second.deduped, true)
    assert.equal(second.jobId, first.jobId)
  })

  it('validates payload with data-schema', async () => {
    let backend = createMemoryJobBackend()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, backend })

    await assert.rejects(() => scheduler.enqueue('email', { to: 123 } as any))
  })

  it('cancels queued jobs', async () => {
    let backend = createMemoryJobBackend()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, backend })

    let enqueued = await scheduler.enqueue('email', { to: 'x@example.com' })

    assert.equal(await scheduler.cancel(enqueued.jobId), true)
    assert.equal(await scheduler.cancel(enqueued.jobId), false)

    let job = await scheduler.get(enqueued.jobId)
    assert.ok(job)
    assert.equal(job.status, 'canceled')
  })
})
