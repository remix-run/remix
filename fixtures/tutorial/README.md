# Remix Starter for Express

Welcome to Remix!

This is a starter repo for using [Remix](https://remix.run) with
[Express](http://expressjs.com/).

## Development

After cloning the repo, rename `.npmrc.example` to `.npmrc` and insert the
license key you get from [logging in to your dashboard at
remix.run](https://remix.run).

> Note: if this is a public repo, you'll probably want to move the line with
> your key into `~/.npmrc` to keep it private.

Then, install all dependencies using `npm`:

```sh
$ npm install
```

Your `@remix-run/*` dependencies will come from the Remix package registry.

Once everything is installed, start the app in development mode with the
following command:

```sh
$ npm run dev
```

This will run a few processes concurrently that will dynamically rebuild as your
source files change. To see your changes, refresh the browser.

> Note: Hot module reloading is coming soon, which will allow you to see your
> changes without refreshing.

## Production

To run the app in production mode, you'll need to build it first.

```sh
$ npm run build
$ npm start
```

This will start a single HTTP server process that will serve the app from the
files generated in the build step.

## Documentation

Detailed documentation for Remix [is available at
remix.run](https://remix.run/dashboard/docs).

## Project Structure

There are 2 main directories you will want to be familiar with: `app` and
`loaders`.

- The `app` directory contains the major pieces that make up the frontend of
  your application. These include the entry points, routes, and CSS files.
  Most of the code in this directory runs both on the server _and_ in the
  browser.
- The `loaders` directory contains functions that supply data to the frontend.
  These functions run only in node.js.

Remix is responsible for compiling everything in your `app` directory so that it
can run both on the server (to render the HTML needed for the page, aka
server-side rendering or "SSR") and in the browser. It's your responsibility to
compile the code in `loaders`, if needed.

This project uses TypeScript for type safety. There are two main TypeScript
configs in `app/tsconfig.json` and `loaders/tsconfig.json`. The `tsconfig.json`
in the project root is a "solution" file that just contains
[references](https://www.typescriptlang.org/docs/handbook/project-references.html)
to the other two configs.

## Don't want TypeScript?

The [`no-typescript`
branch](https://github.com/remix-run/starter-express/tree/no-typescript) is a
version of this same starter template that uses plain JavaScript instead of
TypeScript for all code in `app` and `loaders`.
