---
title: remix.config.js
---

When remix first starts up, it reads your config file, you need to make sure this file is deployed to your server as it's read when the server starts.

## `appDirectory?: string`

The path to the `app` directory, relative to remix.config.js. Defaults to "app".

```js
// default
exports.appDirectory = "./app";

// custom
exports.appDirectory = "./elsewhere";
```

## `routes?: (defineRoutes: DefineRoutes) => Promise<ReturnType<DefineRoutes>>`

A function for defining custom routes, in addition to those already defined
using the filesystem convention in `app/routes`.

```js
exports.routes = async (defineRoutes) => {
  // do all of your async work first, because once you start calling
  // defineRoutes, we use the call stack to set nesting.
  let res = await fetch(someGithubRepo);
  let files = await res.json();

  // no more async work allowed
  return defineRoutes((route) => {

    for (let file of files) {
      route("page/:page", "some/page.js", { loader: "page.js" })
    }
  }
}

// Further explanation
exports.routes = async (defineRoute) => {
  defineRoutes(route => {
    // signature of route
    route(path, componentFile)

    // full signature
    route(
      // the react router path
      path,

      // filename relative to the app/ directory
      relativeFilename,

      // options
      {
        // loader file relative to loaders directory
        loader: relativeFilename,

        // styles file relative to app directory
        styles: relativeFileName
      },

      // last argument is always nested children callback
      () => {}
    });

    // no loader/styles/children
    route("some/:path", "some/route/file.js");

    // nested children, but no loader/styles
    route("some/:path", "some/route/file.js", () => {
      // path is relative to parent path, but filenames are
      // still relative to the app and loaders directories
      route("relative/path", "some/other/file")
    });

    // nested children, loader/styles
    route(
      "some/:path",
      "some/route/file.js",
      {
        loader: "whatever.js",
        style: "whatever.css",
      },
      () => {
        route("more", "another.js");
      }
    );
  });
};
```

## `loadersDirectory?: string`

The path to the `loaders` directory, relative to remix.config.js. Defaults to "loaders". Needs to be deployed to your server because these modules are required dynamically at runtime.

## `browserBuildDirectory?: string`

The path to the browser build, relative to remix.config.js. Defaults to "public/build". Should be deployed to static hosting.

## `publicPath?: string`

The URL prefix of the browser build with a trailing slash. Defaults to "/build/". This is the path the browser will use to find assets.

## `serverBuildDirectory?: string`

The path to the server build, relative to remix.config.js. Defaults to "build". This needs to be deployed to your server.

## `devServerPort?: number`

The port number to use for the dev server. Defaults to 8002.

## `mdx?: MdxOptions`

Options to use when compiling MDX.

```js
exports.mdx = {
  rehypePlugins: [require("@mapbox/rehype-prism"), require("rehype-slug")]
};
```
