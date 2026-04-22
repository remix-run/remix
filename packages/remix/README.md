# remix

A modern web framework for JavaScript.

See [remix.run](https://remix.run) for more information.

## Installation

```sh
npm i remix
```

## CLI

Create a new app with the CLI:

```sh
npx remix new my-remix-app
```

After installing `remix`, the equivalent local command and the rest of the CLI are available through `remix`:

```sh
remix new my-remix-app
remix completion bash >> ~/.bashrc
remix doctor
remix doctor --fix
remix routes
remix routes --table
remix routes --table --no-headers
remix skills install
remix version
remix --no-color doctor
```

## Programmatic CLI

```ts
import { run } from 'remix/cli'

await run(['new', 'my-remix-app'])
await run(['completion', 'bash'])
await run(['doctor'])
await run(['doctor', '--fix'])
await run(['routes'])
await run(['routes', '--table'])
await run(['routes', '--table', '--no-headers'])
await run(['skills', 'list'])
await run(['version'])
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
