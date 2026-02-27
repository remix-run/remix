# session-storage-memcache

Memcache session storage for [`@remix-run/session`](https://github.com/remix-run/remix/tree/main/packages/session).

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createMemcacheSessionStorage } from '@remix-run/session-storage-memcache'

let sessionStorage = createMemcacheSessionStorage('127.0.0.1:11211', {
  keyPrefix: 'my-app:session:',
  ttlSeconds: 60 * 60 * 24 * 7,
})
```

Available options:

- `useUnknownIds` (default: `false`) - reuse unknown session IDs sent by the client
- `keyPrefix` (default: `'remix:session:'`) - prefix for all Memcache keys
- `ttlSeconds` (default: `0`) - session expiration in seconds (`0` means no expiration)

Note: Memcache storage uses TCP sockets and requires a Node.js runtime.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
