import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import * as s from '@remix-run/data-schema'

import type { JobStorage } from '../storage.ts'
import { createJobScheduler, createJobs } from '../scheduler.ts'
import { createJobWorker } from '../worker.ts'

export interface StorageContractOptions<transaction = never> {
  integrationEnabled?: boolean
  setup?: () => Promise<void>
  createStorage: () => Promise<JobStorage<transaction>> | JobStorage<transaction>
}

export function runJobStorageContract<transaction = never>(
  name: string,
  options: StorageContractOptions<transaction>,
): void {
  let storage: JobStorage<transaction>
  let enabled = options.integrationEnabled ?? true

  describe(name, () => {
    beforeEach(async () => {
      if (!enabled) {
        return
      }

      await options.setup?.()
      storage = await options.createStorage()
    })

    it('processes queued jobs', { skip: !enabled }, async () => {
      let processed: string[] = []
      let jobs = createJobs({
        email: {
          schema: s.object({ id: s.string() }),
          async handle(payload) {
            processed.push(payload.id)
          },
        },
      })
      let scheduler = createJobScheduler({ jobs, storage })
      let worker = createJobWorker({
        jobs,
        storage,
        worker: {
          pollIntervalMs: 10,
          leaseMs: 100,
        },
      })

      await scheduler.enqueue(jobs.email, { id: 'one' })
      await worker.start()
      await waitFor(() => processed.length === 1)
      await worker.stop()

      assert.deepEqual(processed, ['one'])
    })

    it('retries jobs', { skip: !enabled }, async () => {
      let attempts = 0
      let jobs = createJobs({
        flaky: {
          schema: s.object({ id: s.string() }),
          async handle() {
            attempts += 1

            if (attempts < 2) {
              throw new Error('retry')
            }
          },
        },
      })
      let scheduler = createJobScheduler({ jobs, storage })
      let worker = createJobWorker({
        jobs,
        storage,
        worker: {
          pollIntervalMs: 10,
          leaseMs: 100,
        },
      })

      let result = await scheduler.enqueue(jobs.flaky, { id: 'one' }, {
        retry: {
          maxAttempts: 2,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
      })

      await worker.start()
      await waitFor(async () => {
        let job = await scheduler.get(result.jobId)
        return job?.status === 'completed'
      })
      await worker.stop()

      assert.equal(attempts, 2)
    })

    it('supports delayed jobs', { skip: !enabled }, async () => {
      let processed = 0
      let jobs = createJobs({
        delayed: {
          schema: s.object({ id: s.string() }),
          async handle() {
            processed += 1
          },
        },
      })
      let scheduler = createJobScheduler({ jobs, storage })
      let worker = createJobWorker({
        jobs,
        storage,
        worker: {
          pollIntervalMs: 10,
          leaseMs: 100,
        },
      })

      await scheduler.enqueue(jobs.delayed, { id: 'd1' }, { delay: 35 })
      await worker.start()
      await waitFor(() => processed === 1)
      await worker.stop()

      assert.equal(processed, 1)
    })

    it('supports dedupe keys', { skip: !enabled }, async () => {
      let jobs = createJobs({
        email: {
          schema: s.object({ id: s.string() }),
          async handle() {},
        },
      })
      let scheduler = createJobScheduler({ jobs, storage })

      let first = await scheduler.enqueue(jobs.email, { id: 'a' }, {
        dedupeKey: 'email:a',
        dedupeTtlMs: 1000,
      })
      let second = await scheduler.enqueue(jobs.email, { id: 'a' }, {
        dedupeKey: 'email:a',
        dedupeTtlMs: 1000,
      })

      assert.equal(first.deduped, false)
      assert.equal(second.deduped, true)
      assert.equal(first.jobId, second.jobId)
    })

    it('reclaims expired running jobs', { skip: !enabled }, async () => {
      let enqueued = await storage.enqueue({
        name: 'lease-test',
        queue: 'default',
        payload: { ok: true },
        runAt: 10,
        priority: 0,
        retry: {
          maxAttempts: 3,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
        createdAt: 10,
      })

      let firstClaim = await storage.claimDueJobs({
        now: 10,
        workerId: 'w1',
        queues: ['default'],
        limit: 1,
        leaseMs: 20,
      })
      assert.equal(firstClaim.length, 1)
      assert.equal(firstClaim[0].id, enqueued.jobId)

      let noClaim = await storage.claimDueJobs({
        now: 15,
        workerId: 'w2',
        queues: ['default'],
        limit: 1,
        leaseMs: 20,
      })
      assert.equal(noClaim.length, 0)

      let reclaimed = await storage.claimDueJobs({
        now: 35,
        workerId: 'w2',
        queues: ['default'],
        limit: 1,
        leaseMs: 20,
      })
      assert.equal(reclaimed.length, 1)
      assert.equal(reclaimed[0].id, enqueued.jobId)
      assert.equal(reclaimed[0].attempts, 2)
    })

    it('lists failed jobs and replays failed jobs', { skip: !enabled }, async () => {
      let jobs = createJobs({
        alwaysFail: {
          schema: s.object({ id: s.string() }),
          async handle() {
            throw new Error('boom')
          },
        },
      })
      let scheduler = createJobScheduler({ jobs, storage })
      let worker = createJobWorker({
        jobs,
        storage,
        worker: {
          pollIntervalMs: 10,
          leaseMs: 100,
        },
      })

      let enqueued = await scheduler.enqueue(jobs.alwaysFail, { id: 'f1' }, {
        retry: {
          maxAttempts: 1,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
      })

      await worker.start()
      await waitFor(async () => {
        let job = await scheduler.get(enqueued.jobId)
        return job?.status === 'failed'
      })
      await worker.stop()

      let deadLetters = await storage.listFailedJobs({ limit: 10 })
      assert.ok(deadLetters.some((job) => job.id === enqueued.jobId))

      let replayed = await storage.replayFailedJob({
        jobId: enqueued.jobId,
        priority: 99,
      })
      assert.ok(replayed)
      assert.notEqual(replayed.jobId, enqueued.jobId)

      let original = await scheduler.get(enqueued.jobId)
      assert.ok(original)
      assert.equal(original.status, 'failed')

      let replayedJob = await scheduler.get(replayed.jobId)
      assert.ok(replayedJob)
      assert.equal(replayedJob.status, 'queued')
      assert.equal(replayedJob.priority, 99)
    })

    it('returns null when replaying missing or non-failed jobs', { skip: !enabled }, async () => {
      let queued = await storage.enqueue({
        name: 'not-failed',
        queue: 'default',
        payload: { ok: true },
        runAt: 0,
        priority: 0,
        retry: {
          maxAttempts: 1,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
        createdAt: 0,
      })

      assert.equal(
        await storage.replayFailedJob({
          jobId: 'missing-job-id',
        }),
        null,
      )
      assert.equal(
        await storage.replayFailedJob({
          jobId: queued.jobId,
        }),
        null,
      )
    })

    it('prunes terminal jobs by status and respects limits', { skip: !enabled }, async () => {
      let completedEnqueued = await storage.enqueue({
        name: 'to-complete',
        queue: 'default',
        payload: { ok: true },
        runAt: 1,
        priority: 0,
        retry: {
          maxAttempts: 1,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
        createdAt: 1,
      })
      let failedAEnqueued = await storage.enqueue({
        name: 'to-fail-a',
        queue: 'default',
        payload: { ok: true },
        runAt: 2,
        priority: 0,
        retry: {
          maxAttempts: 1,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
        createdAt: 2,
      })
      let failedBEnqueued = await storage.enqueue({
        name: 'to-fail-b',
        queue: 'default',
        payload: { ok: true },
        runAt: 3,
        priority: 0,
        retry: {
          maxAttempts: 1,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
        createdAt: 3,
      })
      let canceledEnqueued = await storage.enqueue({
        name: 'to-cancel',
        queue: 'default',
        payload: { ok: true },
        runAt: 1000,
        priority: 0,
        retry: {
          maxAttempts: 1,
          strategy: 'fixed',
          baseDelayMs: 10,
          maxDelayMs: 10,
          jitter: 'none',
        },
        createdAt: 4,
      })

      let claimed = await storage.claimDueJobs({
        now: 10,
        workerId: 'w1',
        queues: ['default'],
        limit: 3,
        leaseMs: 100,
      })
      assert.equal(claimed.length, 3)

      await storage.complete({
        jobId: completedEnqueued.jobId,
        workerId: 'w1',
        now: 20,
      })
      await storage.fail({
        jobId: failedAEnqueued.jobId,
        workerId: 'w1',
        now: 21,
        error: 'boom-a',
        terminal: true,
      })
      await storage.fail({
        jobId: failedBEnqueued.jobId,
        workerId: 'w1',
        now: 22,
        error: 'boom-b',
        terminal: true,
      })
      assert.equal(await storage.cancel(canceledEnqueued.jobId), true)

      let pruneCompleted = await storage.prune({
        completedBefore: Number.MAX_SAFE_INTEGER,
        limit: 10,
      })
      assert.equal(pruneCompleted.deleted, 1)
      assert.equal(pruneCompleted.completed, 1)
      assert.equal(pruneCompleted.failed, 0)
      assert.equal(pruneCompleted.canceled, 0)

      assert.equal(await storage.get(completedEnqueued.jobId), null)
      assert.ok(await storage.get(failedAEnqueued.jobId))
      assert.ok(await storage.get(canceledEnqueued.jobId))

      let pruneFailed = await storage.prune({
        failedBefore: Number.MAX_SAFE_INTEGER,
        limit: 1,
      })
      assert.equal(pruneFailed.deleted, 1)
      assert.equal(pruneFailed.completed, 0)
      assert.equal(pruneFailed.failed, 1)
      assert.equal(pruneFailed.canceled, 0)

      let pruneCanceled = await storage.prune({
        canceledBefore: Number.MAX_SAFE_INTEGER,
        limit: 10,
      })
      assert.equal(pruneCanceled.deleted, 1)
      assert.equal(pruneCanceled.completed, 0)
      assert.equal(pruneCanceled.failed, 0)
      assert.equal(pruneCanceled.canceled, 1)
      assert.equal(await storage.get(canceledEnqueued.jobId), null)
    })

    it('supports cron schedules', { skip: !enabled }, async () => {
      let processed = 0
      let jobs = createJobs({
        cronJob: {
          schema: s.object({ id: s.string() }),
          async handle() {
            processed += 1
          },
        },
      })
      let scheduler = createJobScheduler({ jobs, storage })
      let worker = createJobWorker({
        jobs,
        storage,
        worker: {
          pollIntervalMs: 10,
          cronTickMs: 10,
          leaseMs: 100,
        },
        cron: [
          {
            schedule: '* * * * *',
            job: jobs.cronJob,
            payload: { id: 'run' },
            options: {
              id: 'cron-job-id',
              catchUp: 'one',
            },
          },
        ],
      })

      await worker.start()
      await waitFor(() => processed > 0)
      await worker.stop()

      assert.ok(processed > 0)
    })
  })
}

async function waitFor(
  condition: (() => boolean) | (() => Promise<boolean>),
  timeoutMs = 5000,
  intervalMs = 10,
): Promise<void> {
  let startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    let ready = await condition()

    if (ready) {
      return
    }

    await sleep(intervalMs)
  }

  throw new Error('Timed out waiting for condition')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
