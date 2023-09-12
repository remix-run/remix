# `create-remix`

## 2.0.0-pre.10

## 2.0.0-pre.9

## 2.0.0-pre.8

## 2.0.0-pre.7

## 2.0.0-pre.6

## 2.0.0-pre.5

## 2.0.0-pre.4

## 2.0.0-pre.3

## 2.0.0-pre.2

### Patch Changes

- Allow dots in github repo shorthand notation folder names (i.e., `npx create-remix --template remix-run/examples/socket.io`) ([#7277](https://github.com/remix-run/remix/pull/7277))

## 2.0.0-pre.1

## 2.0.0-pre.0

### Major Changes

- The `create-remix` CLI has been rewritten to feature a cleaner interface, Git repo initialization and optional `remix.init` script execution. The interactive template prompt and official Remix stack/template shorthands have also been removed so that community/third-party templates are now on a more equal footing. ([#6887](https://github.com/remix-run/remix/pull/6887))

  The code for `create-remix` has been moved out of the Remix CLI since it's not intended for use within an existing Remix application. This means that the `remix create` command is no longer available.

- Stop passing `isTypeScript` to `remix.init` script ([#7099](https://github.com/remix-run/remix/pull/7099))
- Require Node >=18.0.0 ([#6939](https://github.com/remix-run/remix/pull/6939))

### Minor Changes

- Remove empty directory checking in favor of `overwrite` prompt/flag. ([#7062](https://github.com/remix-run/remix/pull/7062))

  `create-remix` now allows you to write into an existing non-empty directory. It will perform a file-level comparison and if the template will overwrite any existing files in the destination directory, it will prompt you if it's OK to overwrite those files. If you answer no (the default) then it will exit without copying any files. You may skip this prompt with the `--overwrite` CLI flag.

- Support bun package manager ([#7074](https://github.com/remix-run/remix/pull/7074))

## 1.19.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.19.3`

## 1.19.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.19.2`

## 1.19.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.19.1`

## 1.19.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.19.0`

## 1.18.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.18.1`

## 1.18.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.18.0`

## 1.17.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.17.1`

## 1.17.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.17.0`

## 1.16.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.16.1`

## 1.16.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.16.0`

## 1.15.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.15.0`

## 1.14.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.14.3`

## 1.14.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.14.2`

## 1.14.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.14.1`

## 1.14.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.14.0`

## 1.13.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.13.0`

## 1.12.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.12.0`

## 1.11.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.11.1`

## 1.11.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.11.0`

## 1.10.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.10.1`

## 1.10.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.10.0`

## 1.9.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.9.0`

## 1.8.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.8.2`

## 1.8.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.8.1`

## 1.8.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.8.0`

## 1.7.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.7.6`

## 1.7.5

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.7.5`

## 1.7.4

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.7.4`

## 1.7.3

### Patch Changes

- Update `create-remix` to use the new examples repository when using `--template example/<name>` ([#4208](https://github.com/remix-run/remix/pull/4208))
- Updated dependencies:
  - `@remix-run/dev@1.7.3`

## 1.7.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.7.2`

## 1.7.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.7.1`

## 1.7.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.7.0`

## 1.6.8

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.6.8`

## 1.6.7

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.6.7`

## 1.6.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/dev@1.6.6`

## 1.6.5

### Patch Changes

- Updated dependencies
  - `@remix-run/dev@1.6.5`
