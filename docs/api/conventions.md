---
title: Conventions
---

There are a few conventions in Remix to be aware of.

## `remix.config.js`

This file must be named `remix.config.js` for Remix to find it when it starts up.

## `app/entry-server.js`

This is your entry into the server rendering piece of Remix. You must leave the file name as is.

## `app/entry-browser.js`

This is your entry into the browser rendering/hydration piece of Remix. You must leave the file name as is.

## `app/routes/**/*.{js,jsx,ts,tsx,md,mdx,cjs}`

Any files in the app/routes directory will become routes in your application. Remix supports all of those extensions.

The filename minus extension becomes the "route id". So a file at `routes/foo/$bar.js` has the route id of `routes/foo/$bar`. These route ids will show up in future APIs for preloading resources.

## `data/routes/**/*.{js,ts}`

Any files in this location become the "data module" for the corresponding "route module" of the same name (minus extension). These files export a `loader` function (for "get" requests) and/or an `action` function (for "post", "put", "patch", and "delete" requests).

## `data/global.{js,ts}`

This data module is called on the initial server render and after data actions in the client. It's useful for getting data to the App component or global things like the user's language preference.

## `app/routes/**/*.css`

CSS files with the same filename (minus extension) as a route will be loaded and unloaded with the route. CSS is always loaded, but not applied, before route transitions complete. They are always inserted into the document in the order of the route nesting. Finally, they are removed when that route no longer matches the URL (and isn't rendered).

## `app/global.css`

This file is included on every page as the first CSS link tag.

## Dots in Route Filesnames

Adding a `.` in a route file will create a nested URL, but not a nested layout. Flat files are flat layouts, nested files are nested layouts. The `.` allows you to create nested URLs without needing to create a bunch of layouts.

For example: `routes/some.long.url.js` will create the URL `/some/long/url`.

## Route params with `$param` in files and folders.

The dollar sign denotes a dynamic segment of the URL. It will be parsed and passed to your loaders and routes.

For example: `routes/users/$userId.js` will match the following URLs: `users/123` and `users/abc` but not `users/123/abc` because that has too many segments. See the <Link to="../routing">routing guide</Link> for more information.

Some CLIs require you to escape the \$ when creating files:

```bash
touch routes/\$params.js
```

Params can be nested routes, just create a folder with the `$` in it.

## routes/404.js, routes/500.js

<div className="text-red-500">Unstable API</div>

When a route is not found, or an error is unhandled, we use these routes. We don't like this convention because "/404" should be a valid URL (maybe you're showing the best BBQ in Atlanta!). This is what we've got right now though. This will change soon.
