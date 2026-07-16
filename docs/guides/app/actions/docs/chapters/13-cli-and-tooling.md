---
title: CLI and Tooling
description: The Remix command-line workflow for creating, inspecting, testing, checking, and running TypeScript projects.
---

The installed `remix` package provides the CLI and the runtime subpaths used by an app. This chapter covers the commands that exist in Remix 3 and the TypeScript loader used by the generated Node project.

## Create an app with remix new {#remix-new}

Use `npx remix@next new <target-dir>` before the package is installed locally, or `remix new <target-dir>` afterward. Cover `--app-name`, `--force`, the generated `app/actions` layout, and the scripts in the starter `package.json`.

## Inspect route ownership with remix routes {#remix-routes}

`remix routes` loads `app/routes.ts` and shows each method, pattern, and expected action owner. Cover tree, `--table`, `--no-headers`, `--verbose`, and `--json` output, including the `[missing]` marker for absent controller files.

## Check a project with remix doctor {#remix-doctor}

`remix doctor` checks the environment, project setup, and action/controller conventions in dependency order. Use `--json` for machine-readable findings and `--strict` when warnings should produce a nonzero exit code.

## Apply low-risk fixes with remix doctor --fix {#remix-doctor-fix}

`--fix` may align project metadata or create missing action/controller files and placeholders. Show the plan through normal output, review the resulting working-tree changes, and do not imply the command rewrites arbitrary application logic.

## Run tests with remix test {#remix-test}

Keep the full runner, configuration, filtering, browser, and end-to-end coverage in the testing chapter. The minimal generated starter uses Node's test runner; apps that need Remix test discovery, browser tests, or end-to-end helpers can switch their project script to `remix test`, with CLI flags passed through to that runner.

## Help, version, color, and shell completion {#remix-version}

Cover `remix help`, command-level `--help`, `remix version` and `--version`, global `--no-color`, plus `remix completion bash` and `remix completion zsh`. Do not document removed commands that are absent from the CLI dispatcher.

## TypeScript and JSX setup {#typescript-and-jsx-setup}

Explain the generated `NodeNext` module settings, `.ts` extensions in relative imports, type-only imports, `jsx: react-jsx`, and `jsxImportSource: remix/ui`. Keep `tsc --noEmit` as a separate typecheck because runtime transformation is not type checking.

## Run source files with remix/node-tsx {#using-remix-node-tsx}

Use `node --import remix/node-tsx server.ts` to execute TypeScript and Remix JSX directly in Node. State the limits clearly: the loader does not typecheck, add TypeScript path aliases, change Node resolution, or downlevel JavaScript for older runtimes.

## Call the CLI programmatically {#programmatic-cli}

Use `runRemix(argv, options)` from `remix/cli` when another tool needs the same command dispatcher and exit codes. Keep process exit and output ownership in the calling CLI.

## Build project CLIs with terminal utilities {#building-clis-with-remix-packages}

Use `remix/terminal` for color detection, ANSI styles, cursor controls, and injectable streams instead of hand-rolled escape sequences. This is a library for app tooling, not an additional Remix app build system.
