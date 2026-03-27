# remix

A modern web framework for JavaScript.

See [remix.run](https://remix.run) for more information.

## Installation

```sh
npm i remix
```

## CLI

```sh
remix new my-remix-app
remix doctor
remix routes
remix routes --table
remix skills install
remix version
remix --no-color doctor
```

## Programmatic CLI

```ts
import { run } from 'remix/cli'

await run(['new', 'my-remix-app'])
await run(['doctor'])
await run(['routes'])
await run(['routes', '--table'])
await run(['skills', 'list'])
await run(['version'])
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
