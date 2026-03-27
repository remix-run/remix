# cli

Command-line interface for creating and managing Remix projects.

## Features

- Create new Remix projects with `remix new`
- Check controller-directory conventions with `remix doctor`
- Inspect the current app route tree with `remix routes`
- Sync Remix skills into `.agents/skills` with `remix skills`
- Print the current CLI version with `remix version`
- Use the same CLI through the `remix` package or the `remix/cli` API
- Scaffold a starter app that matches the Remix project layout conventions

## Installation

```sh
npm i remix
```

## Usage

The primary interface is the `remix` command:

```sh
remix new my-remix-app
remix doctor
remix routes
remix routes --table
remix skills install
remix version
remix --no-color doctor
```

You can also run the CLI programmatically:

```ts
import { run } from 'remix/cli'

await run(['new', 'my-remix-app'])
await run(['doctor'])
await run(['routes'])
await run(['routes', '--table'])
await run(['skills', 'status'])
await run(['version'])
```

`run()` returns the CLI exit code as a promise.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
