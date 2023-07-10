---
title: "@remix-run/dev (CLI)"
order: 1
---

<docs-warning>

The Remix CLI is changing in v2.
You can prepare for this change at your convenience with the `v2_dev` future flag.
For instructions on making this change see the [v2 guide][v2-guide].

</docs-warning>

# Remix CLI

The Remix CLI comes from the `@remix-run/dev` package. It also includes the compiler. Make sure it is in your `package.json` `devDependencies` so it doesn't get deployed to your server.

To get a full list of available commands and flags, run:

```sh
npx @remix-run/dev -h
```

## `remix create`

`remix create` will create a new Remix project. Without passing arguments, this command will launch an interactive CLI to configure the new project and set it up in a given directory. Optionally you can pass the desired directory path as an argument and a starter template with the `--template` flag.

```sh
remix create <projectDir>
```

### `remix create --template`

A valid template can be:

- a directory located in the [`templates` folder of the Remix repository][templates-folder-of-the-remix-repository]
- a local file path to a directory of files
- a local file path to a tarball
- the name of a `:username/:repo` on GitHub
- the URL of a remote tarball

```sh
remix create ./my-app --template fly
remix create ./my-app --template /path/to/remix-template
remix create ./my-app --template /path/to/remix-template.tar.gz
remix create ./my-app --template remix-run/grunge-stack
remix create ./my-app --template :username/:repo
remix create ./my-app --template https://github.com/:username/:repo
remix create ./my-app --template https://github.com/:username/:repo/tree/:branch
remix create ./my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
remix create ./my-app --template https://github.com/:username/:repo/releases/latest/download/:tag.tar.gz
remix create ./my-app --template https://example.com/remix-template.tar.gz
```

<aside aria-label="Private GitHub repo templates">
<docs-info>

To create a new project from a template in a private GitHub repo, pass the `--token` flag a personal access token with access to that repo.

</docs-info>
</aside>

## `remix build`

Builds your app for production. This command will set `process.env.NODE_ENV` to `production` and minify the output for deployment.

```sh
remix build
```

### `remix build --sourcemap`

Generates sourcemaps for the production build.

## `remix watch`

Watches your application files and builds your app for development when changes are made.

```sh
remix watch
```

## `remix dev`

The same as `watch`, but also boots the [Remix App Server][remix-app-server] in development mode if it's installed.

```sh
remix dev
```

### `remix dev --debug`

Attaches a [Node inspector][node-inspector] to develop your app in debug mode.

### `remix dev --port`

Launches the app server on a given port.

By default, the port is set to `3000`. If port `3000` is unavailable, the `dev` command will attempt to find another port that is open. Using the `--port` flag will only attempt to launch the server at the given port; if the port is unavailable, the app will not start.

```sh
remix dev --port 4001
```

Alternatively, a port can be assigned to the `PORT` environment variable.

## `remix init`

If the template has a `remix.init/index.js` file at the root then that file will be executed after the project has been generated and dependencies have been installed. This gives you a chance to do anything you'd like as part of the initialization of your template. For example, in the blues stack, the `app` property has to be globally unique, so we use the `remix.init/index.js` file to change it to the name of the directory that was created for the project + a couple random characters.

You could even use `remix.init/index.js` to ask further questions to the developer for additional configuration (using something like \[inquirer]\[inquirer]). Sometimes, you'll need dependencies installed to do this, but those deps are only useful during initialization. In that case, you can also create a `remix.init/package.json` with dependencies and the Remix CLI will install those before running your script.

After the init script has been run, the `remix.init` folder gets deleted, so you don't need to worry about it cluttering up the finished codebase.

<docs-info>You'll only ever interact with this command if you've opted out of installing dependencies when creating a new Remix app, or you're developing a custom template that includes a `remix.init/index.js` file.</docs-info>

### `remix init --no-delete`

Skip deleting the `remix.init` folder after initialization has been run. Useful for creating templates.

[remix-app-server]: ./serve
[node-inspector]: https://nodejs.org/en/docs/guides/debugging-getting-started
[templates-folder-of-the-remix-repository]: https://github.com/remix-run/remix/tree/main/templates
[v2-guide]: ../pages/v2
