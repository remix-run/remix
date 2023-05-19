---
title: "create-remix (CLI)"
order: 1
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
yarn create remix@latest <projectDir>
# or
pnpm create remix@latest <projectDir>
```

### `create-remix --template`

For a more comprehensive guide to available templates, see our [templates page.][templates]

A valid template can be:

- the name of a `:username/:repo` on GitHub
- the URL of a GitHub repository (or directory within it)
- the URL of a remote tarball
- a local file path to a directory of files
- a local file path to a tarball

```sh
npm create remix@latest ./my-app --template remix-run/grunge-stack
npm create remix@latest ./my-app --template :username/:repo
npm create remix@latest ./my-app --template https://github.com/:username/:repo
npm create remix@latest ./my-app --template https://github.com/:username/:repo/tree/:branch
npm create remix@latest ./my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
npm create remix@latest ./my-app --template https://github.com/:username/:repo/releases/latest/download/:tag.tar.gz
npm create remix@latest ./my-app --template https://example.com/remix-template.tar.gz
npm create remix@latest ./my-app --template /path/to/remix-template
npm create remix@latest ./my-app --template /path/to/remix-template.tar.gz
```

<aside aria-label="Private GitHub repo templates">
<docs-info>

To create a new project from a template in a private GitHub repo, pass the `--token` flag a personal access token with access to that repo.

</docs-info>
</aside>

[templates]: ../pages/templates