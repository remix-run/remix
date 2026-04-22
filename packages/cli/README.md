# cli

Command-line interface for creating and managing Remix projects.

## Features

- Create new Remix projects with `npx remix new` or installed `remix new`
- Print shell completion scripts with `remix completion`
- Check project environment and Remix app conventions with `remix doctor`
- Create low-risk project and controller files with `remix doctor --fix`
- Inspect the current app route tree with `remix routes`
- Sync Remix skills into `.agents/skills` with `remix skills`
- Print the current Remix version with `remix version`
- Use the same CLI through the `remix` package or the `remix/cli` API
- Scaffold a starter app that matches the Remix project layout conventions

## Installation

Use `npx remix new <target-dir>` to scaffold a new Remix app. Install `remix` when you want the local `remix` command:

```sh
npm i remix
```

## Shell completion

Install bash completion:

```sh
remix completion bash >> ~/.bashrc
```

Install zsh completion:

```sh
remix completion zsh >> ~/.zshrc
```

## Usage

Use `npx remix new my-remix-app` to scaffold a new Remix app. After installing Remix, the equivalent local command is `remix new my-remix-app`.

The rest of the CLI is available through the installed `remix` command:

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

You can also run the CLI programmatically:

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

`run()` returns the CLI exit code as a promise.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
