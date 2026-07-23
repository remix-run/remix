---
title: CLI and Tooling
description: The Remix command-line workflow for creating, inspecting, testing, checking, and running TypeScript projects.
---

The `remix` package includes both the framework APIs and a small command-line tool. The CLI creates the same visible project shape used throughout this guide, inspects the runtime route map, checks controller ownership, runs the Remix test runner when an app chooses it, and exposes the TypeScript loader used by the generated Node scripts.

It is not a separate build system. The application remains ordinary TypeScript, Web APIs, and runtime route definitions.

## Create an app with remix new {#remix-new}

Before Remix is installed locally, run the requested package version through `npx`:

```sh
npx remix@next new record-store --app-name "Albums"
cd record-store
npm i
```

`--app-name` controls the display name in the generated document — here it matches the `— Albums` document titles used throughout this guide. It does not need to match the directory name.

The target directory must be empty unless `--force` is present. Because force permits the scaffold to write into a non-empty directory, inspect that directory first.

The generated app includes these request-path files (selected files):

```txt
record-store/
├── server.ts
├── package.json
├── tsconfig.json
├── public/
│   └── favicon.svg
└── app/
    ├── actions/
    │   └── controller.tsx
    ├── assets/
    │   ├── entry.ts
    │   └── prompt-button.tsx
    ├── middleware/
    │   └── render.tsx
    ├── ui/
    │   ├── document.tsx
    │   └── scaffold-home-page.tsx
    ├── assets.ts
    ├── router.ts
    └── routes.ts
```

After the test setup in the previous chapter, the app scripts run TypeScript source directly:

```json filename=package.json
{
  "scripts": {
    "dev": "NODE_ENV=development node --watch --import remix/node-tsx server.ts",
    "start": "NODE_ENV=production node --import remix/node-tsx server.ts",
    "test": "NODE_ENV=test RELEASE_ID=test remix test",
    "typecheck": "tsc --noEmit"
  }
}
```

`dev` lets Node restart the server when source changes. `start` runs the same entry without watching. The test script uses the Remix test runners configured in the previous chapter, and `typecheck` remains a separate compiler pass.

Once the package is installed, use the local binary through package scripts or `npx remix ...` so a global install cannot silently select another Remix version.

## Inspect route ownership with remix routes {#remix-routes}

Run the route inspector from anywhere under the project:

```sh
npx remix routes
```

It loads `app/routes.ts` as runtime code and shows the method, pattern, and controller file expected to own each route. At this point in the walkthrough, the tree makes every direct and nested controller boundary visible:

```txt
assets       GET     /assets/*path -> controller.tsx
home         ANY     /             -> controller.tsx
albums -> albums/controller.tsx
├─ show             GET     /albums/:albumId
├─ search           GET     /albums/search
├─ recommendations  GET     /albums/:albumId/recommendations
├─ cover            GET     /albums/:albumId/cover
├─ coverHead        HEAD    /albums/:albumId/cover
├─ destroy          DELETE  /albums/:albumId
└─ edit -> albums/edit/controller.tsx
   ├─ index         GET     /albums/:albumId/edit
   └─ action        POST    /albums/:albumId/edit
account -> account/controller.tsx
└─ index            GET     /account
auth -> auth/controller.ts
├─ logout           POST    /logout
├─ login -> auth/login/controller.tsx
│  ├─ index         GET     /login
│  └─ action        POST    /login
└─ google -> auth/google/controller.ts
   ├─ login         GET     /login/google
   └─ callback      GET     /auth/google/callback
```

Use the table when sorting or scanning many routes:

```sh
npx remix routes --table
npx remix routes --table --no-headers
```

`--verbose` prints full owner paths in the tree or table. `--json` emits the normalized route map for another tool and cannot be combined with `--table` or `--verbose`.

An owner marked `[missing]` is an informational route-map result, not a failed command. `remix routes` still exits zero. Use `remix doctor --strict` when missing or incomplete controller ownership should fail CI.

Because the command executes `app/routes.ts`, route-module import errors also fail inspection. Keep the route map free of startup side effects that have nothing to do with defining URLs.

## Check a project with remix doctor {#remix-doctor}

`doctor` checks the project in dependency order:

```sh
npx remix doctor
```

It first verifies the environment and package metadata, then loads the project route map, then checks action and controller conventions. A blocking environment warning may cause later suites to be skipped rather than produce misleading secondary findings.

Normal output is for a person. JSON is for a script or editor integration:

```sh
npx remix doctor --json > doctor-report.json
```

Both forms exit zero when they complete with warning-level findings. CI should opt into warning failure:

```sh
npx remix doctor --strict
```

`--strict` exits with status 1 while warning findings remain. JSON does not imply strictness, so use both flags when CI needs structured output and a failing exit code:

```sh
npx remix doctor --json --strict > doctor-report.json
```

Doctor is a focused project-health check. Keep `npm run typecheck` and tests in the validation pipeline because doctor does not prove application types or behavior.

## Apply low-risk fixes with remix doctor --fix {#remix-doctor-fix}

`--fix` applies supported changes immediately. It has no dry-run or plan-only mode. Start from a known working tree, run the command, then inspect the diff:

```sh
git status --short
npx remix doctor --fix
git diff -- app package.json tsconfig.json
```

Fixes are deliberately narrow. Doctor may align generated project metadata, create a missing routes or controller file, or add action placeholders for route ownership. A generated placeholder is still a TODO for the application. Doctor does not invent authorization, queries, or response behavior.

The command rechecks after applying fixes. It exits 1 if warning findings still remain, which can mean a low-risk fix was unavailable or the new placeholder still needs application code. Review and test the diff before committing it.

## Run tests with remix test {#remix-test}

The generated starter uses Node's test runner. The album app switched to the Remix test environments and discovery in [Testing](/testing/), so its script now includes the deterministic test release ID:

```json filename=package.json
{
  "scripts": {
    "test": "NODE_ENV=test RELEASE_ID=test remix test"
  }
}
```

Then the same command runs server, browser, and end-to-end tests selected by the project configuration:

```sh
npm test
npm test -- app/actions/albums/edit/controller.test.ts
npm test -- --only "returns 409 for a stale revision"
```

Arguments after `npm test --` are passed to `remix test`. Use `npx remix test --help` for the installed version's complete flags. Filtering, browser projects, coverage, and CI setup stay in the testing chapter.

Running TypeScript tests is not type checking. Keep `npm run typecheck` beside the test command.

## Help, version, color, and shell completion {#remix-version}

The root and each command expose their installed help text:

```sh
npx remix help
npx remix help doctor
npx remix routes --help
```

Check which version the local package resolved:

```sh
npx remix version
npx remix --version
```

`--no-color` is global and may appear before a command. Use it for logs that should not contain ANSI styles:

```sh
npx remix --no-color doctor
```

The CLI can print completion scripts for Bash and Zsh:

```sh
npx remix completion bash
npx remix completion zsh
```

Source the output from the appropriate shell startup file or a managed completion directory. Inspect it before appending so repeated setup does not duplicate the same block.

The command list is intentionally small: `completion`, `doctor`, `help`, `new`, `routes`, `test`, and `version`. If a command does not appear in the installed root help, do not rely on a command remembered from another Remix generation.

## TypeScript and JSX setup {#typescript-and-jsx-setup}

The generated TypeScript configuration matches Node's ESM resolution and Remix UI's JSX runtime:

```json filename=tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "remix/ui",
    "noEmit": true
  },
  "exclude": ["dist"]
}
```

`NodeNext` follows Node ESM rules, so relative source imports include their `.ts` or `.tsx` extension. `allowImportingTsExtensions` permits that source form, while `rewriteRelativeImportExtensions` keeps emitted imports valid if an app later chooses to emit files.

`verbatimModuleSyntax` makes type intent explicit:

```ts
import { createRouter, type MiddlewareContext } from "remix/router";
import type { Handle } from "remix/ui";
```

`jsxImportSource` selects Remix UI's JSX functions rather than React's. `isolatedModules` keeps each source file transformable by the runtime loader, but neither it nor the loader replaces `tsc --noEmit` across the project.

## Run source files with remix/node-tsx {#using-remix-node-tsx}

Node's `--import` flag registers Remix's TypeScript and JSX loader before the source entry executes:

```sh
node --import remix/node-tsx server.ts
node --import remix/node-tsx scripts/migrate.ts
```

The loader transforms `.ts`, `.tsx`, and `.jsx`, including enums, runtime namespaces, and parameter properties. It reads JSX transform options from the nearest `tsconfig.json`. Node still owns module resolution.

The loader does not typecheck, apply TypeScript `paths` aliases, or downlevel modern JavaScript for an older runtime. Use normal Node-resolvable imports and run the Node version declared in `package.json`.

For development restart behavior, Node owns the watcher:

```sh
NODE_ENV=development node --watch --import remix/node-tsx server.ts
```

That is why the generated asset server sets `watch: false`: one watcher owns process restarts.

## Call the CLI programmatically {#programmatic-cli}

A wrapper tool can dispatch the same commands through `remix/cli`:

```ts filename=scripts/remix-cli.ts
import { runRemix } from "remix/cli";

let exitCode = await runRemix(process.argv.slice(2), {
  cwd: process.cwd(),
});

process.exitCode = exitCode;
```

`runRemix(argv?, { cwd?, remixVersion? })` resolves to the command's numeric exit code. It writes command output directly to process stdout and stderr, so the caller does not receive an output buffer. The wrapper owns process exit policy. Setting `process.exitCode` allows pending output to flush.

`remixVersion` is mainly useful to a host or test that intentionally controls the reported version. Normal app tooling should let the installed package supply it.

## Build project CLIs with terminal utilities {#building-clis-with-remix-packages}

For app-specific scripts, `remix/terminal` provides testable streams, color detection, styles, and cursor controls:

```ts filename=scripts/check-covers.ts
import { createTerminal } from "remix/terminal";

export async function checkCovers({
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let terminal = createTerminal({ stdout, stderr });
  let missing = await findAlbumsWithoutCovers();

  if (missing.length === 0) {
    terminal.writeLine(terminal.styles.green("All albums have covers"));
    return 0;
  }

  terminal.errorLine(
    terminal.styles.red(`${missing.length} albums need covers`),
  );
  return 1;
}
```

Injectable streams make the script testable without replacing process globals. `terminal.isTTY` and `terminal.isInteractive` let a tool avoid cursor movement when output is redirected; `clearLine`, `cursorTo`, `hideCursor`, and `showCursor` cover progress displays without hand-written escape codes.

These utilities help build a project CLI. They do not bundle the app or replace its server, router, test runner, or type checker. The next chapter, [Production](/production/), uses the same explicit scripts to run migrations, start the server, manage shutdown, and expose health checks.
