# cli

Command-line interface for creating and managing Remix projects.

## Features

- Create new Remix projects with `npx remix@next new` or installed `remix new`
- Print shell completion scripts with `remix completion`
- Check project environment and Remix app conventions with `remix doctor`
- Create low-risk project and controller files with `remix doctor --fix`
- Manage the current app database with `remix db`
- Inspect the current app route tree with `remix routes`
- Run project tests with `remix test`
- Configure commands with a static, commented `remix.json` file
- Print the current Remix version with `remix version`
- Use the same CLI through the `remix` package or the `remix/cli` API
- Scaffold a starter app that matches the Remix project layout conventions

## Installation

Use `npx remix@next new <target-dir>` to scaffold a new Remix app. Install `remix` when you want the local `remix` command:

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

Use `npx remix@next new my-remix-app` to scaffold a new Remix app. After installing Remix, the equivalent local command is `remix new my-remix-app`.

The rest of the CLI is available through the installed `remix` command:

```sh
remix new my-remix-app
remix completion bash >> ~/.bashrc
remix doctor
remix doctor --fix
remix db migrate
remix db status
remix db reset --force
remix routes
remix routes --table
remix routes --table --no-headers
remix test
remix version
remix --no-color doctor
```

You can also run the CLI programmatically:

```ts
import { runRemix } from 'remix/cli'

await runRemix(['new', 'my-remix-app'])
await runRemix(['completion', 'bash'])
await runRemix(['doctor'])
await runRemix(['doctor', '--fix'])
await runRemix(['db', 'migrate'])
await runRemix(['db', 'status'])
await runRemix(['db', 'reset', '--force'])
await runRemix(['routes'])
await runRemix(['routes', '--table'])
await runRemix(['routes', '--table', '--no-headers'])
await runRemix(['test'])
await runRemix(['version'])
```

Destructive database commands (`remix db wipe` and `remix db reset`) refuse to run without `--force`.

`runRemix()` returns the CLI exit code as a promise.

## Configuration

The CLI loads an optional `remix.json`. The file is parsed as JSONC, so it may contain comments and
trailing commas. Every top-level field is optional:

```jsonc
{
  "$schema": "https://remix.run/schemas/remix.json",

  "db": {
    "adapter": {
      "type": "sqlite",
      "filename": { "env": "DATABASE_URL", "default": "./db/app.sqlite" },
      "foreignKeys": true,
      "busyTimeout": 5000,
    },
    "migrations": {
      "directory": "./db/migrations",
      "journalTable": "data_table_migrations",
    },
    "seed": "./db/seed.sql",
  },

  "doctor": {
    "strict": true,
  },

  "test": {
    // Test discovery
    "files": ["**/*.test{,.browser,.e2e}.{ts,tsx}"],
    "browserFiles": ["**/*.test.browser.{ts,tsx}"],
    "e2eFiles": ["**/*.test.e2e.{ts,tsx}"],
    "exclude": ["node_modules/**", "dist/**"],
    "type": ["server", "browser", "e2e"],
    "only": ["/checkout/i"],

    // Test execution
    "concurrency": 4,
    "pool": "forks",
    "setup": "./test/setup.ts",
    "watch": false,

    // Playwright
    "playwright": {
      "echo": false,
      "open": false,
      "configFile": "./playwright.config.ts",
      "projects": ["chromium", "firefox"],
    },

    // Output
    "reporter": "spec",
    "quiet": false,

    // Coverage
    "coverage": {
      "enabled": true,
      "dir": ".coverage",
      "include": ["app/**"],
      "exclude": ["**/*.test.*"],
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80,
    },
  },
}
```

Explicit command flags and positional arguments override configured values. Repeated flags replace
configured arrays, while nested Playwright and coverage settings merge by field. Relative paths and
globs are resolved from the directory containing the config file. Use `remix doctor --no-strict` to
disable configured strict mode for one run.

`remix db` requires `db.adapter`. Adapters use `type: "sqlite"`, `type: "postgres"`, or
`type: "mysql"`; PostgreSQL uses `connectionString` and MySQL uses `uri`. A connection value may be
a string or an object naming an environment variable with an optional default. `db.seed` names a
SQL file that `remix db seed` and `remix db reset` run against the database. Database flags such as
`--migrations`, `--seed`, `--journal-table`, and `--connection-env` override the corresponding
config for one invocation. When no global `--config` is provided, database commands find the
nearest `remix.json` by walking up from the working directory.

Use the global `--config` option to select another JSONC file. The option itself is resolved from the
CLI working directory and may appear before or after the command:

```sh
remix --config ./config/remix.ci.json test
remix test --config ./config/remix.ci.json
```

A missing default `remix.json` is ignored. A missing explicitly selected file, malformed JSONC,
unknown property, or invalid value is reported as a CLI error. The optional `$schema` field enables
editor completion and validation; it has no runtime effect.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
