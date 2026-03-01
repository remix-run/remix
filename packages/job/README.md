# job

Background job scheduler for Remix with retries, delayed jobs, cron schedules, and pluggable storage adapters.

## Features

- **Typed jobs** - Validate payloads with `remix/data-schema`
- **Retry support** - Fixed or exponential retry with optional jitter
- **Delayed jobs** - Schedule work for later execution
- **Cron schedules** - Register recurring jobs with 5-field cron expressions
- **Storage agnostic** - Works with pluggable storage adapters

## Installation

```sh
npm i remix
```

## Usage

```ts
import * as s from 'remix/data-schema'
import { createJobs, createJobScheduler } from 'remix/job'
import { createDataTableJobStorage } from 'remix/job-data-table'

let jobs = createJobs({
  sendEmail: {
    schema: s.object({ to: s.string(), subject: s.string() }),
    async handle(payload) {
      await sendEmail(payload.to, payload.subject)
    },
  },
})

let storage = createDataTableJobStorage({ db })
let scheduler = createJobScheduler({ jobs, storage })

let enqueued = await scheduler.enqueue(jobs.sendEmail, {
  to: 'a@example.com',
  subject: 'Hello',
})

// enqueue returns { jobId, deduped } for follow-up operations like cancel
await scheduler.cancel(enqueued.jobId)
```

## Avoiding Duplicate Jobs

Use `dedupeKey` and `dedupeTtlMs` to prevent duplicate enqueues for the same logical work.

```ts
let dedupeKey = 'send-email:a@example.com:welcome'

let first = await scheduler.enqueue(
  jobs.sendEmail,
  { to: 'a@example.com', subject: 'Welcome' },
  {
    dedupeKey,
    dedupeTtlMs: 5 * 60 * 1000, // 5 minutes
  },
)

let second = await scheduler.enqueue(
  jobs.sendEmail,
  { to: 'a@example.com', subject: 'Welcome' },
  {
    dedupeKey,
    dedupeTtlMs: 5 * 60 * 1000,
  },
)

// second.deduped === true
// second.jobId === first.jobId
```

## Retrying Jobs

Use `priority` to run more important jobs first, and `retry` to control retry behavior after
failures.

- `priority`: Relative ordering for due jobs in the same queue (`10` runs before `1`). Defaults to `0`.
- `retry.maxAttempts`: Total attempts before marking the job as failed (includes the first attempt). Defaults to `5`.
- `retry.strategy`: Backoff strategy, either `'fixed'` or `'exponential'`. Defaults to `'exponential'`.
- `retry.baseDelayMs`: Base retry delay in milliseconds. Defaults to `1000`.
- `retry.maxDelayMs`: Maximum retry delay cap in milliseconds. Defaults to `300000`.
- `retry.jitter`: Delay randomization strategy (`'none'` or `'full'`). Defaults to `'full'`.

Jitter helps avoid synchronized retry bursts. If many jobs fail at the same time and all retry after the same delay, they can create a traffic spike against your database or third-party APIs. Randomizing retry delays spreads retries out and smooths load.

```ts
await scheduler.enqueue(
  jobs.sendEmail,
  { to: 'vip@example.com', subject: 'Important update' },
  {
    priority: 10,
    retry: {
      maxAttempts: 5,
      strategy: 'exponential',
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
      jitter: 'full',
    },
  },
)
```

## Transactional Scheduler Writes

When your storage supports transactions (e.g. `remix/job-data-table`), scheduler writes can
participate in your application transaction.

```ts
await db.transaction(async (transaction) => {
  await db.query(orders).insert({ id: 'order-1' })

  let enqueued = await scheduler.enqueue(
    jobs.sendEmail,
    { to: 'a@example.com', subject: 'Order received' },
    { transaction },
  )

  await scheduler.cancel(enqueued.jobId, { transaction })
})
```

## Production Deployment

For reliable cron scheduling, run workers as a dedicated, always-on deployment.

- Run your web app and job workers as separate processes.
- Keep worker replicas at `>= 1` (do not scale workers to zero).
- Register cron schedules in worker startup so they continue running independently of web traffic.

```ts
import { createJobWorker } from 'remix/job/worker'
import { storage, jobs, scheduler } from './jobs'

let worker = createJobWorker({
  scheduler,
  jobs,
  storage,
  cron: [
    {
      schedule: '*/5 * * * *',
      job: jobs.sendEmail,
      payload: { to: 'ops@example.com', subject: 'heartbeat' },
      options: { id: 'heartbeat-email', catchUp: 'one' },
    },
  ],
})

await worker.start()
```

## Related Packages

- [`remix/job-data-table`](https://github.com/remix-run/remix/tree/main/packages/job-data-table): SQL storage for PostgreSQL, MySQL, and SQLite
- [`remix/job-redis`](https://github.com/remix-run/remix/tree/main/packages/job-redis): Redis storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
