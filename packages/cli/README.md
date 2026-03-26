# cli

Command-line interface for creating and managing Remix projects.

## Features

- Create new Remix projects with `remix new`
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
```

You can also run the CLI programmatically:

```ts
import { run } from 'remix/cli'

await run(['new', 'my-remix-app'])
```

`run()` returns the CLI exit code as a promise.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
