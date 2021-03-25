---
title: File Name Conventions
---

There are a few conventions that Remix uses you should be aware of.

## Special Files

- **`remix.config.js`**: Remix uses this file to know how to build your app for production and run it in development. This file is required.
- **`app/entry.server.{js,tsx}`**: This is your entry into the server rendering piece of Remix. This file is required.
- **`app/entry.client.{js,tsx}`**: This is your entry into the browser rendering/hydration piece of Remix. This file is required.

## Route Filenames

- **`app/root.tsx`**: This is your root layout, or "root route" (very sorry for those of you who pronounce those words the same way!). It works just like all other routes: you can export a `loader`, `action`, etc.
- **`app/routes/*.{js,jsx,tsx,md,mdx}`**: Any files in the `app/routes/` directory will become routes in your application. Remix supports all of those extensions.
- **`app/routes/{folder}/*.js`**: Folders inside of routes will create nested URLs.
- **`app/routes/{folder}` with `app/routes/{folder}.js`**: When a route has the same name as a folder, it becomes a "layout route" for the child routes inside the folder. Render an `<Outlet />` and the child routes will appear there. This is how you can have multiple levels of persistent layout nesting associated with URLs.
- **Dots in route filesnames**: Adding a `.` in a route file will create a nested URL, but not a nested layout. Flat files are flat layouts, nested files are nested layouts. The `.` allows you to create nested URLs without needing to create a bunch of layouts. For example: `routes/some.long.url.tsx` will create the URL `/some/long/url`.
- **`app/routes/index.js`**: Routes named "index" will render when the parent layout route's path is matched exactly.
- **`$param`**: The dollar sign denotes a dynamic segment of the URL. It will be parsed and passed to your loaders and routes.

  For example: `routes/users/$userId.tsx` will match the following URLs: `users/123` and `users/abc` but not `users/123/abc` because that has too many segments. See the <Link to="../routing">routing guide</Link> for more information.

  Some CLIs require you to escape the \$ when creating files:

  ```bash
  touch routes/\$params.tsx
  ```

  Params can be nested routes, just create a folder with the `$` in it.

- **`routes/404.tsx`**: When a URL can't be matched to a route, Remix uses this file to render a 404 page. We don't like this convention because "/404" should be a valid URL (maybe you're showing the best BBQ in Atlanta!). This is what we've got right now though. This will probably.

## Asset Imports

- **Importing images with `img:`**: You can import images assets with `import image from `img:./something.jpg`. Check out the [image docs](/dashboard/docs/images).

- **Importing css with `css:`**: You can import css assets with `import styles from `css:./something.css`. Check out the [styling docs](/dashboard/docs/styling).

- **Importing any asset with `url:`**: You can import any assets with `import assetUrl from `url:./something.mp3`. Remix will return the public URL of the file and hash the name of the asset for long term caching.
