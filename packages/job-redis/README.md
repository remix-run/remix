# job-redis

Redis storage adapter for `remix/job`.

## Features

- **Low-latency queue operations** - Uses Redis sorted sets and hashes
- **Retry and delay support** - Compatible with scheduler retry policies
- **Lease-based workers** - Supports worker crash recovery

## Installation

```sh
npm i remix redis
```

## Usage

```ts
import * as s from 'remix/data-schema'
import { createClient } from 'redis'
import { createJobs, createJobScheduler } from 'remix/job'
import { createRedisJobStorage } from 'remix/job-redis'

let redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

let jobs = createJobs({
  sendEmail: {
    schema: s.object({ to: s.string(), subject: s.string() }),
    async handle(payload) {
      await sendEmail(payload.to, payload.subject)
    },
  },
})

let storage = createRedisJobStorage({ redis })
let scheduler = createJobScheduler({ jobs, storage })

await scheduler.enqueue(jobs.sendEmail, {
  to: 'a@example.com',
  subject: 'Hello',
})

let failedJobs = await scheduler.listFailedJobs({ limit: 20 })

if (failedJobs.length > 0) {
  await scheduler.replayFailedJob(failedJobs[0].id)
}

await scheduler.prune({
  policy: {
    failedOlderThanMs: 30 * 24 * 60 * 60 * 1000,
  },
  limit: 500,
})
```

Redis storage also works with scheduler/worker observability hooks in `remix/job`.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
