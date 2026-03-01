# job-redis

Redis storage adapter for `remix/job`.

## Features

- **Low-latency queue operations** - Uses Redis sorted sets and hashes
- **Retry and delay support** - Compatible with scheduler retry policies
- **Lease-based workers** - Supports worker crash recovery
- **Cron persistence** - Stores recurring schedule state in Redis

## Installation

```sh
npm i remix redis
```

## Usage

```ts
import { createClient } from 'redis'
import { createRedisJobStorage } from 'remix/job-redis'

let redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

let storage = createRedisJobStorage({ redis })
// ...create a scheduler with createJobScheduler({ jobs, storage })

let deadLetters = await scheduler.listDeadLetters({ limit: 20 })

if (deadLetters.length > 0) {
  await scheduler.replayDeadLetter(deadLetters[0].id)
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
