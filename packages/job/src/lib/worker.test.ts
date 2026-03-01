import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as s from '@remix-run/data-schema'

import { createJobScheduler, createJobs } from './scheduler.ts'
import { createMemoryJobBackend } from './test/memory-backend.ts'
import { createJobWorker } from './worker.ts'

describe('createJobWorker', () => {
  it('processes delayed jobs', async () => {
    let executed: string[] = []
    let backend = createMemoryJobBackend()
    let jobs = createJobs({
      delayed: {
        schema: s.object({ id: s.string() }),
        async handle(payload) {
          executed.push(payload.id)
        },
      },
    })
    let scheduler = createJobScheduler({ jobs, backend })
    let worker = createJobWorker({
      scheduler,
      jobs,
      backend,
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
    let backend = createMemoryJobBackend()
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
    let scheduler = createJobScheduler({ jobs, backend })
    let worker = createJobWorker({
      scheduler,
      jobs,
      backend,
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
    let backend = createMemoryJobBackend()
    let jobs = createJobs({
      heartbeat: {
        schema: s.object({ name: s.string() }),
        async handle() {
          executed += 1
        },
      },
    })
    let scheduler = createJobScheduler({ jobs, backend })
    let worker = createJobWorker({
      scheduler,
      jobs,
      backend,
      worker: {
        pollIntervalMs: 10,
        cronTickMs: 10,
        leaseMs: 200,
      },
      cron: [
        {
          cron: '* * * * *',
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
