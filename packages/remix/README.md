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
npx remix@next new my-remix-app
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
remix test
remix version
remix --no-color doctor
```

## Programmatic CLI

```ts
import { runRemix } from 'remix/cli'

await runRemix(['new', 'my-remix-app'])
await runRemix(['completion', 'bash'])
await runRemix(['doctor'])
await runRemix(['doctor', '--fix'])
await runRemix(['routes'])
await runRemix(['routes', '--table'])
await runRemix(['routes', '--table', '--no-headers'])
await runRemix(['skills', 'list'])
await runRemix(['test'])
await runRemix(['version'])
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
