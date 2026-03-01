# job

Background job scheduler for Remix with retries, delayed jobs, cron schedules, and pluggable backends.

## Features

- **Typed jobs** - Validate payloads with `remix/data-schema`
- **Retry support** - Fixed or exponential retry with optional jitter
- **Delayed jobs** - Schedule work for later execution
- **Cron schedules** - Register recurring jobs with 5-field cron expressions
- **Backend agnostic** - Works with pluggable storage backends

## Installation

```sh
npm i remix
```

## Usage

```ts
import * as s from 'remix/data-schema'
import { createJobs, createJobScheduler } from 'remix/job'
import { createDataTableJobBackend } from 'remix/job/data-table'

let jobs = createJobs({
  sendEmail: {
    schema: s.object({ to: s.string(), subject: s.string() }),
    async handle(payload) {
      await sendEmail(payload.to, payload.subject)
    },
  },
})

let backend = createDataTableJobBackend({ db })
let scheduler = createJobScheduler({ jobs, backend })

await scheduler.enqueue(jobs.sendEmail, { to: 'a@example.com', subject: 'Hello' })
```

## Production Deployment

For reliable cron scheduling, run workers as a dedicated, always-on deployment.

- Run your web app and job workers as separate processes.
- Keep worker replicas at `>= 1` (do not scale workers to zero).
- Register cron schedules in worker startup so they continue running independently of web traffic.

```ts
import { createJobWorker } from 'remix/job/worker'
import { backend, jobs, scheduler } from './jobs'

let worker = createJobWorker({
  scheduler,
  jobs,
  backend,
  cron: [
    {
      cron: '*/5 * * * *',
      job: jobs.sendEmail,
      payload: { to: 'ops@example.com', subject: 'heartbeat' },
      options: { id: 'heartbeat-email', catchUp: 'one' },
    },
  ],
})

await worker.start()
```

## Related Packages

- [`remix/job/data-table`](https://github.com/remix-run/remix/tree/main/packages/job-data-table): SQL backend for PostgreSQL, MySQL, and SQLite
- [`remix/job/redis`](https://github.com/remix-run/remix/tree/main/packages/job-redis): Redis backend

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
