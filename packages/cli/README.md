# cli

Command-line interface for creating and managing Remix projects.

## Features

- Create new Remix projects with `npx remix@next new` or installed `remix new`
- List browser-reachable files and inspect URL mappings with `remix assets`
- Print shell completion scripts with `remix completion`
- Check project environment and Remix app conventions with `remix doctor`
- Apply available low-risk project fixes with `remix doctor --fix`
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
remix assets
remix assets inspect /assets/app/actions/public/entry.ts
remix completion bash >> ~/.bashrc
remix doctor
remix doctor --fix
remix db migrate
remix db rollback
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
await runRemix(['assets'])
await runRemix(['assets', 'inspect', '/assets/app/actions/public/entry.ts'])
await runRemix(['completion', 'bash'])
await runRemix(['doctor'])
await runRemix(['doctor', '--fix'])
await runRemix(['db', 'migrate'])
await runRemix(['db', 'rollback'])
await runRemix(['db', 'status'])
await runRemix(['db', 'reset', '--force'])
await runRemix(['routes'])
await runRemix(['routes', '--table'])
await runRemix(['routes', '--table', '--no-headers'])
await runRemix(['test'])
await runRemix(['version'])
```

Destructive database commands (`remix db wipe` and `remix db reset`) refuse to run without `--force`.

`remix db rollback` reverts the most recent migration by default. Use `--step <count>` or `--to <migration>` to select a bound, and use `--dry-run` to report what would be reverted without changing the database.

`runRemix()` returns the CLI exit code as a promise.

`remix assets` lists each browser-reachable asset as `URL -> file`, one per line. Run `remix assets inspect <url-or-file>` to see one asset's resolved mapping and whether it is reachable, denied, unsupported, missing, or unmapped. Denied assets also show the matching deny rule.

## Configuration

The CLI loads an optional `remix.json`. The file is parsed as JSONC, so it may contain comments and
trailing commas. Every top-level field is optional:

```jsonc
{
  "$schema": "./node_modules/remix/schema/remix.json",

  "assets": {
    "rootDir": ".",
    "basePath": "/assets",
    "mounts": {
      "app": "app",
      "npm": "node_modules",
    },
    "allowFiles": ["app/routes.ts", "app/**/public/**"],
    "allowPackages": ["remix"],
    "denyFiles": ["app/**/*.test.*"],
    "files": {
      "extensions": [".svg", ".png", ".jpg", ".woff2"],
    },
  },

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

The local `$schema` association uses the schema shipped with the directly installed `remix` package, so editor validation matches that version and remains available offline. It intentionally does not reference the transitive `@remix-run/cli` package, which may not be linked at the project root by package managers such as pnpm.

Explicit command flags and positional arguments override configured values. Repeated flags replace
configured arrays, while nested Playwright and coverage settings merge by field. Relative paths and
globs are resolved from the directory containing the config file. Use `remix doctor --no-strict` to
disable configured strict mode for one run.

`remix db` requires `db.adapter`. Adapters use `type: "sqlite"`, `type: "postgres"`, or
`type: "mysql"`; PostgreSQL uses `connectionString` and MySQL uses `uri`. A connection value may be
a string or an object naming an environment variable with an optional default. `db.seed` names a
SQL file that `remix db seed` and `remix db reset` run against the database. Database flags such as
`--migrations`, `--seed`, `--journal-table`, and `--connection-env` override the corresponding
config for one invocation. Rollbacks also accept `--step`, `--to`, and `--dry-run`. When no global
`--config` is provided, database commands find the nearest `remix.json` by walking up from the
working directory.

Use the global `--config` option to select another JSONC file. The option itself is resolved from the
CLI working directory and may appear before or after the command:

```sh
remix --config ./config/remix.ci.json test
remix test --config ./config/remix.ci.json
```

A missing default `remix.json` is ignored. A missing explicitly selected file, malformed JSONC,
unknown property, or invalid value is reported as a CLI error. The optional `$schema` field enables
editor completion and validation; it has no runtime effect.

Load the complete validated config from application code with `loadConfig()`:

```ts
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

let config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

let assetServer = createAssetServer({
  ...config.assets,
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
})
```

Pass a config file to load it directly, or a directory to search upward for the nearest
`remix.json`. Asset paths are resolved relative to the config file, so `config.assets` can be spread
directly into `createAssetServer()`. Add runtime-only options such as transforms, caches, HMR, or
error handlers in application code.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
