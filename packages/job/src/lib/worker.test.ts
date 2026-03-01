import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as s from '@remix-run/data-schema'

import { createJobScheduler, createJobs } from './scheduler.ts'
import { createMemoryJobStorage } from './test/memory-storage.ts'
import { createJobWorker } from './worker.ts'

describe('createJobWorker', () => {
  it('processes delayed jobs', async () => {
    let executed: string[] = []
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      delayed: {
        schema: s.object({ id: s.string() }),
        async handle(payload) {
          executed.push(payload.id)
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
        leaseMs: 200,
      },
    })

    await scheduler.enqueue(jobs.delayed, { id: 'one' }, { delay: 40 })
    await worker.start()

    await waitFor(() => executed.length === 1)

    await worker.stop()
    assert.deepEqual(executed, ['one'])
  })

  it('retries failed jobs', async () => {
    let attempts = 0
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      flaky: {
        schema: s.object({ value: s.string() }),
        async handle() {
          attempts += 1

          if (attempts < 2) {
            throw new Error('try again')
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
        leaseMs: 200,
      },
    })

    let enqueued = await scheduler.enqueue(jobs.flaky, { value: 'x' }, {
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
      let job = await scheduler.get(enqueued.jobId)
      return job?.status === 'completed'
    })

    await worker.stop()
    assert.equal(attempts, 2)
  })

  it('enqueues cron schedules', async () => {
    let executed = 0
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      heartbeat: {
        schema: s.object({ name: s.string() }),
        async handle() {
          executed += 1
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
        leaseMs: 200,
      },
      cron: [
        {
          schedule: '* * * * *',
          job: jobs.heartbeat,
          payload: { name: 'tick' },
          options: {
            id: 'heartbeat-every-minute',
            catchUp: 'one',
          },
        },
      ],
    })

    await worker.start()

    await waitFor(() => executed > 0)

    await worker.stop()
    assert.ok(executed > 0)
  })

  it('emits lifecycle hooks and stays fail-open when hooks throw', async () => {
    let attempts = 0
    let hookErrors = 0
    let events: string[] = []
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      flaky: {
        schema: s.object({ id: s.string() }),
        async handle() {
          attempts += 1

          if (attempts < 2) {
            throw new Error('retry me')
          }
        },
      },
      deadLetter: {
        schema: s.object({ id: s.string() }),
        async handle() {
          throw new Error('terminal')
        },
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })
    let threwStartHook = false
    let worker = createJobWorker({
      scheduler,
      jobs,
      storage,
      worker: {
        pollIntervalMs: 10,
        leaseMs: 100,
      },
      hooks: {
        onJobStart() {
          events.push('start')

          if (!threwStartHook) {
            threwStartHook = true
            throw new Error('start hook failure')
          }
        },
        onJobRetry() {
          events.push('retry')
        },
        onJobComplete() {
          events.push('complete')
        },
        onJobDeadLetter() {
          events.push('dead-letter')
        },
        onHookError() {
          hookErrors += 1
        },
      },
    })

    let retryJob = await scheduler.enqueue(jobs.flaky, { id: 'retry' }, {
      retry: {
        maxAttempts: 2,
        strategy: 'fixed',
        baseDelayMs: 10,
        maxDelayMs: 10,
        jitter: 'none',
      },
    })
    let deadLetterJob = await scheduler.enqueue(jobs.deadLetter, { id: 'dead' }, {
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
      let retryState = await scheduler.get(retryJob.jobId)
      let deadLetterState = await scheduler.get(deadLetterJob.jobId)
      return retryState?.status === 'completed' && deadLetterState?.status === 'failed'
    })

    await worker.stop()

    assert.ok(events.includes('start'))
    assert.ok(events.includes('retry'))
    assert.ok(events.includes('complete'))
    assert.ok(events.includes('dead-letter'))
    assert.equal(hookErrors, 1)
  })

  it('supports optional retention pruning loop', async () => {
    let storage = createMemoryJobStorage()
    let jobs = createJobs({
      cleanup: {
        schema: s.object({ id: s.string() }),
        async handle() {},
      },
    })
    let scheduler = createJobScheduler({ jobs, storage })
    let pruneEvents = 0
    let worker = createJobWorker({
      scheduler,
      jobs,
      storage,
      worker: {
        pollIntervalMs: 10,
        leaseMs: 100,
        retention: {
          policy: {
            completedOlderThanMs: 0,
          },
          intervalMs: 10,
          limit: 10,
        },
      },
      hooks: {
        onPrune() {
          pruneEvents += 1
        },
      },
    })

    let enqueued = await scheduler.enqueue(jobs.cleanup, { id: 'cleanup' })
    await worker.start()

    await waitFor(async () => {
      let job = await scheduler.get(enqueued.jobId)
      return job == null
    })

    await worker.stop()
    assert.ok(pruneEvents > 0)
  })
})

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
