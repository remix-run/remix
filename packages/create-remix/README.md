# create-remix

A zero-install entrypoint for scaffolding Remix projects with `npm create remix`.

## Features

- Start a new Remix app with `npm create remix@latest`
- Reuse the same scaffolding implementation as `remix new`
- Expose a small `run()` API for tests and tooling

## Installation

No installation is required for the primary workflow:

```sh
npm create remix@latest my-remix-app
```

If you want the installed equivalent instead, install Remix and use `remix new`:

```sh
npm i remix
```

## Usage

Use the zero-install entrypoint:

```sh
npm create remix@latest my-remix-app
```

This is equivalent to the installed Remix CLI command:

```sh
remix new my-remix-app
```

You can also run the wrapper programmatically:

```ts
import { run } from 'create-remix'

await run(['my-remix-app'])
await run(['my-remix-app', '--app-name', 'My Remix App'])
await run(['my-remix-app', '--force'])
```

## Related Packages

- [`remix`](https://github.com/remix-run/remix/tree/main/packages/remix) - The installed Remix framework package and local CLI entrypoint
- [`@remix-run/cli`](https://github.com/remix-run/remix/tree/main/packages/cli) - Shared CLI implementation used by `remix` and `create-remix`

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
