# session-storage-redis

Redis-backed session storage for [`@remix-run/session`](https://github.com/remix-run/remix/tree/main/packages/session).
Use this package when app servers need to share session state through Redis.

## Installation

```sh
npm i @remix-run/session @remix-run/session-storage-redis redis
```

## Usage

```ts
import { createClient } from 'redis'
import { createRedisSessionStorage } from '@remix-run/session-storage-redis'

let redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

let sessionStorage = createRedisSessionStorage(redis, {
  keyPrefix: 'session:',
  ttl: 60 * 60 * 24,
})
```

## Options

`createRedisSessionStorage(client, options)` supports:

- `keyPrefix` (`string`, default: `'session:'`)
- `ttl` (`number` seconds)
- `useUnknownIds` (`boolean`, default: `false`)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
