---
title: "create-remix (CLI)"
---

# `create-remix`

The `create-remix` CLI will create a new Remix project. Without passing arguments, this command will launch an interactive CLI to configure the new project and set it up in a given directory.

```sh
npx create-remix@latest
```

Optionally you can pass the desired directory path as an argument and a starter template with the `--template` flag.

```sh
npx create-remix@latest <projectDir>
```

To get a full list of available commands and flags, run:

```sh
npx create-remix@latest --help
```

### Package managers

`create-remix` can also be invoked using the `create` command of various package managers, allowing you to choose between npm, Yarn and pnpm for managing the install process.

```sh
npm create remix@latest <projectDir>
# or
yarn create remix <projectDir>
# or
pnpm create remix <projectDir>
```

### `create-remix --template`

For a more comprehensive guide to available templates, see our [templates page.][templates]

A valid template can be:

- a GitHub repo shorthand — `:username/:repo` or `:username/:repo/:directory`
- the URL of a GitHub repo (or directory within it) — `https://github.com/:username/:repo` or `https://github.com/:username/:repo/tree/:branch/:directory`
- the URL of a remote tarball — `https://example.com/remix-template.tar.gz`
- a local file path to a directory of files — `./path/to/remix-template`
- a local file path to a tarball — `./path/to/remix-template.tar.gz`

```sh
npx create-remix@latest ./my-app --template remix-run/grunge-stack
npx create-remix@latest ./my-app --template remix-run/remix/templates/remix
npx create-remix@latest ./my-app --template remix-run/examples/basic
npx create-remix@latest ./my-app --template :username/:repo
npx create-remix@latest ./my-app --template :username/:repo/:directory
npx create-remix@latest ./my-app --template https://github.com/:username/:repo
npx create-remix@latest ./my-app --template https://github.com/:username/:repo/tree/:branch
npx create-remix@latest ./my-app --template https://github.com/:username/:repo/tree/:branch/:directory
npx create-remix@latest ./my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
npx create-remix@latest ./my-app --template https://github.com/:username/:repo/releases/latest/download/:tag.tar.gz
npx create-remix@latest ./my-app --template https://example.com/remix-template.tar.gz
npx create-remix@latest ./my-app --template ./path/to/remix-template
npx create-remix@latest ./my-app --template ./path/to/remix-template.tar.gz
```

<aside aria-label="Private GitHub repo templates">
<docs-info>

To create a new project from a template in a private GitHub repo, pass the `--token` flag a personal access token with access to that repo.

</docs-info>
</aside>

### `create-remix --allow-non-empty`

By default, `create-remix` requires that the directory you are creating your app into is empty. You can disable this requirement with `--allow-non-empty`, but beware that if you have files/folders that match files/folders in the template, the template versions will **overwrite** the version in your local directory when this flag is used.

[templates]: ../pages/templates
