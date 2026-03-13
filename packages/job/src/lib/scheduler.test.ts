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
    let scheduler = createJobScheduler(jobs, storage)

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
    let scheduler = createJobScheduler(jobs, storage)

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
    let scheduler = createJobScheduler(jobs, storage)

    await assert.rejects(() => scheduler.enqueue(jobs.email, { to: 123 } as any))
  })

  it('rejects enqueue options that include both delay and runAt', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage)

    await assert.rejects(
      () =>
        scheduler.enqueue(
          jobs.email,
          { to: 'timing@example.com' },
          { delay: 1_000, runAt: new Date(Date.now() + 2_000) } as any,
        ),
      /cannot include both "delay" and "runAt"/,
    )
  })

  it('rejects unknown job definitions passed to enqueue', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage)

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
    let scheduler = createJobScheduler(jobs, storage)

    let enqueued = await scheduler.enqueue(jobs.email, { to: 'x@example.com' })

    assert.equal(await scheduler.cancel(enqueued.jobId), true)
    assert.equal(await scheduler.cancel(enqueued.jobId), false)

    let job = await scheduler.get(enqueued.jobId)
    assert.ok(job)
    assert.equal(job.status, 'canceled')
  })

  it('forwards transaction options to storage writes', async () => {
    let capturedEnqueueTransaction: { id: string } | undefined
    let capturedCancelTransaction: { id: string } | undefined
    let capturedRetryTransaction: { id: string } | undefined
    let capturedPruneTransaction: { id: string } | undefined
    let baseStorage = createMemoryJobStorage()
    let storage: JobStorage<{ id: string }> = {
      ...baseStorage,
      enqueue(input, options) {
        capturedEnqueueTransaction = options?.transaction
        return baseStorage.enqueue(input)
      },
      cancel(jobId, options) {
        capturedCancelTransaction = options?.transaction
        return baseStorage.cancel(jobId)
      },
      retryFailedJob(input, options) {
        capturedRetryTransaction = options?.transaction
        return baseStorage.retryFailedJob(input)
      },
      prune(input, options) {
        capturedPruneTransaction = options?.transaction
        return baseStorage.prune(input)
      },
    }
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage)
    let transaction = { id: 'tx1' }
    let enqueued = await scheduler.enqueue(jobs.email, { to: 'tx@example.com' }, { transaction })
    let claimNow = Date.now() + 1000

    await storage.claimDueJobs({
      now: claimNow,
      workerId: 'w1',
      queues: ['default'],
      limit: 1,
      leaseMs: 100,
    })
    await storage.fail({
      jobId: enqueued.jobId,
      workerId: 'w1',
      now: claimNow + 1,
      error: 'failed',
      terminal: true,
    })
    await scheduler.cancel(enqueued.jobId, { transaction })
    await scheduler.retryFailedJob(enqueued.jobId, { transaction })
    await scheduler.prune({
      policy: { failedOlderThanMs: 0 },
      transaction,
    })

    assert.equal(capturedEnqueueTransaction, transaction)
    assert.equal(capturedCancelTransaction, transaction)
    assert.equal(capturedRetryTransaction, transaction)
    assert.equal(capturedPruneTransaction, transaction)
  })

  it('lists failed jobs and retries failed jobs', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage)
    let enqueued = await scheduler.enqueue(jobs.email, { to: 'failed-job@example.com' })
    let claimNow = Date.now() + 1000
    let claimed = await storage.claimDueJobs({
      now: claimNow,
      workerId: 'w1',
      queues: ['default'],
      limit: 1,
      leaseMs: 100,
    })
    assert.equal(claimed.length, 1)

    await storage.fail({
      jobId: enqueued.jobId,
      workerId: 'w1',
      now: claimNow + 1,
      error: 'failed',
      terminal: true,
    })

    let failedJobs = await scheduler.listFailedJobs({ limit: 10 })
    assert.ok(failedJobs.some((job) => job.id === enqueued.jobId))

    let retried = await scheduler.retryFailedJob(enqueued.jobId, { priority: 88 })
    assert.notEqual(retried.jobId, enqueued.jobId)

    let original = await scheduler.get(enqueued.jobId)
    assert.ok(original)
    assert.equal(original.status, 'failed')

    let retriedJob = await scheduler.get(retried.jobId)
    assert.ok(retriedJob)
    assert.equal(retriedJob.status, 'queued')
    assert.equal(retriedJob.priority, 88)
  })

  it('throws when retrying missing or non-failed jobs', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage)
    let enqueued = await scheduler.enqueue(jobs.email, { to: 'queued@example.com' })

    await assert.rejects(
      () => scheduler.retryFailedJob('missing'),
      /job not found or not failed/,
    )
    await assert.rejects(
      () => scheduler.retryFailedJob(enqueued.jobId),
      /job not found or not failed/,
    )
  })

  it('prunes terminal jobs based on policy', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage)
    let completed = await scheduler.enqueue(jobs.email, { to: 'completed@example.com' }, { priority: 2 })
    let failed = await scheduler.enqueue(jobs.email, { to: 'failed@example.com' }, { priority: 1 })
    let canceled = await scheduler.enqueue(jobs.email, { to: 'canceled@example.com' }, { priority: 0 })
    let claimNow = Date.now() + 1000

    await storage.claimDueJobs({
      now: claimNow,
      workerId: 'w1',
      queues: ['default'],
      limit: 2,
      leaseMs: 100,
    })
    await storage.complete({
      jobId: completed.jobId,
      workerId: 'w1',
      now: 10,
    })
    await storage.fail({
      jobId: failed.jobId,
      workerId: 'w1',
      now: 11,
      error: 'failed',
      terminal: true,
    })
    await scheduler.cancel(canceled.jobId)

    let result = await scheduler.prune({
      policy: {
        completedOlderThanMs: 0,
      },
      limit: 10,
    })

    assert.equal(result.deleted, 1)
    assert.equal(result.completed, 1)
    assert.equal(result.failed, 0)
    assert.equal(result.canceled, 0)
    assert.equal(await scheduler.get(completed.jobId), null)
    assert.ok(await scheduler.get(failed.jobId))
    assert.ok(await scheduler.get(canceled.jobId))
  })

  it('emits hooks and remains fail-open when hooks throw', async () => {
    let storage = createMemoryJobStorage()
    let hookErrors = 0
    let events: string[] = []
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage, {
      onEnqueue() {
        events.push('enqueue')
        throw new Error('enqueue hook failed')
      },
      onCancel() {
        events.push('cancel')
      },
      onRetryFailedJob() {
        events.push('retry')
      },
      onPrune() {
        events.push('prune')
      },
      onHookError() {
        hookErrors += 1
      },
    })
    let enqueued = await scheduler.enqueue(jobs.email, { to: 'hooks@example.com' })
    let claimNow = Date.now() + 1000
    let claimed = await storage.claimDueJobs({
      now: claimNow,
      workerId: 'w1',
      queues: ['default'],
      limit: 1,
      leaseMs: 100,
    })
    assert.equal(claimed.length, 1)
    await storage.fail({
      jobId: enqueued.jobId,
      workerId: 'w1',
      now: claimNow + 1,
      error: 'failed',
      terminal: true,
    })
    await scheduler.retryFailedJob(enqueued.jobId)
    await scheduler.cancel(enqueued.jobId)
    await scheduler.prune({
      policy: {
        failedOlderThanMs: 0,
      },
      limit: 1,
    })

    assert.equal(hookErrors, 1)
    assert.ok(events.includes('enqueue'))
    assert.ok(events.includes('retry'))
    assert.ok(events.includes('cancel'))
    assert.ok(events.includes('prune'))
  })

  it('swallows errors thrown from onHookError', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      email: {
        schema: s.object({ to: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler(jobs, storage, {
      onEnqueue() {
        throw new Error('enqueue hook failed')
      },
      onHookError() {
        throw new Error('onHookError failed')
      },
    })

    let enqueued = await scheduler.enqueue(jobs.email, { to: 'fail-open@example.com' })
    assert.equal(enqueued.deduped, false)

    let job = await scheduler.get(enqueued.jobId)
    assert.ok(job)
    assert.equal(job.status, 'queued')
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
    retryFailedJob(input, _options) {
      return storage.retryFailedJob(input)
    },
    prune(input, _options) {
      return storage.prune(input)
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

  let txScheduler = createJobScheduler(jobs, createTransactionAwareTestStorage())

  void txScheduler.enqueue(jobs.email, { to: 'tx@example.com' }, {
    transaction: { id: 'tx1' },
  })
  void txScheduler.enqueue(jobs.email, { to: 'tx@example.com' }, {
    delay: 1_000,
    // @ts-expect-error Enqueue options cannot include both delay and runAt.
    runAt: new Date(),
  })
  void txScheduler.cancel('job-id', {
    transaction: { id: 'tx1' },
  })
  void txScheduler.retryFailedJob('job-id', {
    transaction: { id: 'tx1' },
  })
  void txScheduler.prune({
    policy: { failedOlderThanMs: 0 },
    transaction: { id: 'tx1' },
  })

  let memoryScheduler = createJobScheduler(jobs, createMemoryJobStorage())

  // @ts-expect-error Memory storage does not declare transaction support.
  void memoryScheduler.enqueue(jobs.email, { to: 'memory@example.com' }, { transaction: { id: 'tx1' } })
  // @ts-expect-error Memory storage does not declare transaction support.
  void memoryScheduler.cancel('job-id', { transaction: { id: 'tx1' } })
  // @ts-expect-error Memory storage does not declare transaction support.
  void memoryScheduler.retryFailedJob('job-id', { transaction: { id: 'tx1' } })
  // @ts-expect-error Memory storage does not declare transaction support.
  void memoryScheduler.prune({ policy: { failedOlderThanMs: 0 }, transaction: { id: 'tx1' } })

  void createJobScheduler(
    jobs,
    createMemoryJobStorage(),
    {
      // @ts-expect-error Scheduler hooks must be passed directly as the third argument.
      hooks: {
        onEnqueue() {},
      },
    },
  )
}

void assertTransactionOptionTyping
