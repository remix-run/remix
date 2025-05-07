---
title: "create-remix (CLI)"
---

# `create-remix`

<docs-warning>Just getting started with Remix? The latest version of [Remix is now React Router v7][remix-now-react-router]. If you want to use the latest framework features, you should use the [`create-react-router` CLI to start a new project][create-react-router].</docs-warning>

The `create-remix` CLI will create a new Remix project. Without passing arguments, this command will launch an interactive CLI to configure the new project and set it up in a given directory.

```sh
npx create-remix@latest
```

Optionally you can pass the desired directory path as an argument:

```sh
npx create-remix@latest <projectDir>
```

The default application is a TypeScript app using the built in [Remix App Server][remix-app-server]. If you wish to create your application based on a different setup, you can use the [`--template`][template-flag-hash-link] flag:

```sh
npx create-remix@latest --template <templateUrl>
```

To get a full list of available commands and flags, run:

```sh
npx create-remix@latest --help
```

### Package managers

`create-remix` can also be invoked using various package managers, allowing you to choose between npm, Yarn, pnpm, and Bun for managing the install process.

```sh
npm create remix@latest <projectDir>
# or
yarn create remix@latest <projectDir>
# or
pnpm create remix@latest <projectDir>
# or
bunx create-remix@latest <projectDir>
```

### `create-remix --template`

For a more comprehensive guide to available templates, see our [templates page.][templates]

A valid template can be:

- a GitHub repo shorthand — `:username/:repo` or `:username/:repo/:directory`
- the URL of a GitHub repo (or directory within it) — `https://github.com/:username/:repo` or `https://github.com/:username/:repo/tree/:branch/:directory`
  - The branch name (`:branch`) cannot have a `/` when using this format since `create-remix` cannot unable to differentiate the branch name from the directory path
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

### `create-remix --overwrite`

If `create-remix` detects any file collisions between the template and the directory you are creating your app in, it will prompt you for confirmation that it's OK to overwrite those files with the template versions. You may skip this prompt with the `--overwrite` CLI flag.

[templates]: ../guides/templates
[remix-app-server]: ./serve
[template-flag-hash-link]: #create-remix---template
[remix-now-react-router]: https://remix.run/blog/incremental-path-to-react-19
[create-react-router]: https://reactrouter.com/start/framework/installation
