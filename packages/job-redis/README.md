# job-redis

Redis backend adapter for `@remix-run/job`.

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
import { createRedisJobBackend } from 'remix/job/redis'

let redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

let backend = createRedisJobBackend({ redis })
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
