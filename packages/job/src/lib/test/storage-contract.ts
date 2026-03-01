import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import * as s from '@remix-run/data-schema'

import type { JobStorage } from '../storage.ts'
import { createJobScheduler, createJobs } from '../scheduler.ts'
import { createJobWorker } from '../worker.ts'

export interface StorageContractOptions {
  integrationEnabled?: boolean
  setup?: () => Promise<void>
  createStorage: () => Promise<JobStorage> | JobStorage
}

export function runJobStorageContract(name: string, options: StorageContractOptions): void {
  let storage: JobStorage
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
        scheduler,
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
        scheduler,
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
        scheduler,
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
        scheduler,
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
