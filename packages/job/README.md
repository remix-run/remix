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

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
