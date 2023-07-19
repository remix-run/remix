---
title: Route File Naming (v2)
new: true
---

# Route File Naming (v2)

You can opt in to the new route file naming convention with a future flag in Remix config.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  future: {
    v2_routeConvention: true,
  },
};
```

While you can configure routes in [remix.config.js][remix-config], most routes are created with this file system convention. Add a file, get a route.

Please note that you can use either `.js`, `.jsx`, `.ts` or `.tsx` file extensions. We'll stick with `.tsx` in the examples to avoid duplication.

## Root Route

<!-- prettier-ignore -->
```markdown lines=[3]
app/
├── routes/
└── root.tsx
```

The file in `app/root.tsx` is your root layout, or "root route" (very sorry for those of you who pronounce those words the same way!). It works just like all other routes, so you can export a [`loader`][loader], [`action`][action], etc.

The root route typically looks something like this. It serves as the root layout of the entire app, all other routes will render inside the `<Outlet />`.

```tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export default function Root() {
  return (
    <html lang="en">
      <head>
        <Links />
        <Meta />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

## Basic Routes

Any JavaScript or TypeScript files in the `app/routes/` directory will become routes in your application. The filename maps to the route's URL pathname, except for `_index.tsx` which is the [index route][index-route] for the [root route][root-route].

<!-- prettier-ignore -->
```markdown lines=[3-4]
app/
├── routes/
│   ├── _index.tsx
│   └── about.tsx
└── root.tsx
```

| URL      | Matched Routes |
| -------- | -------------- |
| `/`      | `_index.tsx`   |
| `/about` | `about.tsx`    |

Note that these routes will be rendered in the outlet of `app/root.tsx` because of [nested routing][nested-routing].

## Dot Delimiters

Adding a `.` to a route filename will create a `/` in the URL.

<!-- prettier-ignore -->
```markdown lines=[5-7]
app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.trending.tsx
│   ├── concerts.salt-lake-city.tsx
│   └── concerts.san-diego.tsx
└── root.tsx
```

| URL                        | Matched Route                 |
| -------------------------- | ----------------------------- |
| `/concerts/trending`       | `concerts.trending.tsx`       |
| `/concerts/salt-lake-city` | `concerts.salt-lake-city.tsx` |
| `/concerts/san-diego`      | `concerts.san-diego.tsx`      |

The dot delimiter also creates nesting, see the [nesting section][nested-routes] for more information.

## Dynamic Segments

Usually your URLs aren't static but data-driven. Dynamic segments allow you to match segments of the URL and use that value in your code. You create them with the `$` prefix.

<!-- prettier-ignore -->
```markdown lines=[5]
app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.$city.tsx
│   └── concerts.trending.tsx
└── root.tsx
```

| URL                        | Matched Route           |
| -------------------------- | ----------------------- |
| `/concerts/trending`       | `concerts.trending.tsx` |
| `/concerts/salt-lake-city` | `concerts.$city.tsx`    |
| `/concerts/san-diego`      | `concerts.$city.tsx`    |

Remix will parse the value from the URL and pass it to various APIs. We call these values "URL Parameters". The most useful places to access the URL params are in [loaders][loader] and [actions][action].

```tsx
export function loader({ params }: LoaderArgs) {
  return fakeDb.getAllConcertsForCity(params.city);
}
```

You'll note the property name on the `params` object maps directly to the name of your file: `$city.tsx` becomes `params.city`.

Routes can have multiple dynamic segments, like `concerts.$city.$date`, both are accessed on the params object by name:

```tsx
export function loader({ params }: LoaderArgs) {
  return fake.db.getConcerts({
    date: params.date,
    city: params.city,
  });
}
```

See the [routing guide][routing-guide] for more information.

## Nested Routes

Nested Routing is the general idea of coupling segments of the URL to component hierarchy and data. You can read more about it in the [Routing Guide][nested-routing].

You create nested routes with [dot delimiters][dot-delimiters]. If the filename before the `.` matches another route filename, it automatically becomes a child route to the matching parent. Consider these routes:

<!-- prettier-ignore -->
```markdown lines=[5-8]
app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts._index.tsx
│   ├── concerts.$city.tsx
│   ├── concerts.trending.tsx
│   └── concerts.tsx
└── root.tsx
```

All the routes that start with `concerts.` will be child routes of `concerts.tsx` and render inside the parent route's [outlet][outlet].

| URL                        | Matched Route           | Layout         |
| -------------------------- | ----------------------- | -------------- |
| `/`                        | `_index.tsx`            | `root.tsx`     |
| `/about`                   | `about.tsx`             | `root.tsx`     |
| `/concerts`                | `concerts._index.tsx`   | `concerts.tsx` |
| `/concerts/trending`       | `concerts.trending.tsx` | `concerts.tsx` |
| `/concerts/salt-lake-city` | `concerts.$city.tsx`    | `concerts.tsx` |

Note you typically want to add an index route when you add nested routes so that something renders inside the parent's outlet when users visit the parent URL directly.

## Nested URLs without Layout Nesting

Sometimes you want the URL to be nested, but you don't want the automatic layout nesting. You can opt out of nesting with a trailing underscore on the parent segment:

<!-- prettier-ignore -->
```markdown lines=[8]
app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.$city.tsx
│   ├── concerts.trending.tsx
│   ├── concerts.tsx
│   └── concerts_.mine.tsx
└── root.tsx
```

| URL                        | Matched Route           | Layout         |
| -------------------------- | ----------------------- | -------------- |
| `/`                        | `_index.tsx`            | `root.tsx`     |
| `/concerts/mine`           | `concerts_.mine.tsx`    | `root.tsx`     |
| `/concerts/trending`       | `concerts.trending.tsx` | `concerts.tsx` |
| `/concerts/salt-lake-city` | `concerts.$city.tsx`    | `concerts.tsx` |

Note that `/concerts/mine` does not nest with `concerts.tsx` anymore, but `root.tsx`. The `trailing_` underscore creates a path segment, but it does not create layout nesting.

Think of the `trailing_` underscore as the long bit at the end of your parent's signature, writing you out of the will, removing the segment that follows from the layout nesting.

## Nested Layouts without Nested URLs

We call these <a name="pathless-routes"><b>Pathless Routes</b></a>

Sometimes you want to share a layout with a group of routes without adding any path segments to the URL. A common example is a set of authentication routes that have a different header/footer than the public pages or the logged in app experience. You can do this with a `_leading` underscore.

<!-- prettier-ignore -->
```markdown lines=[3-5]
app/
├── routes/
│   ├── _auth.login.tsx
│   ├── _auth.register.tsx
│   ├── _auth.tsx
│   ├── _index.tsx
│   ├── concerts.$city.tsx
│   └── concerts.tsx
└── root.tsx
```

| URL                        | Matched Route        | Layout         |
| -------------------------- | -------------------- | -------------- |
| `/`                        | `_index.tsx`         | `root.tsx`     |
| `/login`                   | `_auth.login.tsx`    | `_auth.tsx`    |
| `/register`                | `_auth.register.tsx` | `_auth.tsx`    |
| `/concerts/salt-lake-city` | `concerts.$city.tsx` | `concerts.tsx` |

Think of the `_leading` underscore as a blanket you're pulling over the filename, hiding the filename from the URL.

## Optional Segments

Wrapping a route segment in parentheses will make the segment optional.

<!-- prettier-ignore -->
```markdown lines=[3-5]
app/
├── routes/
│   ├── ($lang)._index.tsx
│   ├── ($lang).$productId.tsx
│   └── ($lang).categories.tsx
└── root.tsx
```

| URL                        | Matched Route            |
| -------------------------- | ------------------------ |
| `/`                        | `($lang)._index.tsx`     |
| `/categories`              | `($lang).categories.tsx` |
| `/en/categories`           | `($lang).categories.tsx` |
| `/fr/categories`           | `($lang).categories.tsx` |
| `/american-flag-speedo`    | `($lang)._index.tsx`     |
| `/en/american-flag-speedo` | `($lang).$productId.tsx` |
| `/fr/american-flag-speedo` | `($lang).$productId.tsx` |

You may wonder why `/american-flag-speedo` is matching the `($lang)._index.tsx` route instead of `($lang).$productId.tsx`. This is because when you have an optional dynamic param segment followed by another dynamic param, Remix cannot reliably determine if a single-segment URL such as `/american-flag-speedo` should match `/:lang` `/:productId`. Optional segments match eagerly and thus it will match `/:lang`. If you have this type of setup it's recommended to look at `params.lang` in the `($lang)._index.tsx` loader and redirect to `/:lang/american-flag-speedo` for the current/default language if `params.lang` is not a valid language code.

## Splat Routes

While [dynamic segments][dynamic-segments] match a single path segment (the stuff between two `/` in a URL), a splat route will match the rest of a URL, including the slashes.

<!-- prettier-ignore -->
```markdown lines=[4,6]
app/
├── routes/
│   ├── _index.tsx
│   ├── $.tsx
│   ├── about.tsx
│   └── files.$.tsx
└── root.tsx
```

| URL                                          | Matched Route |
| -------------------------------------------- | ------------- |
| `/`                                          | `_index.tsx`  |
| `/beef/and/cheese`                           | `$.tsx`       |
| `/files`                                     | `files.$.tsx` |
| `/files/talks/remix-conf_old.pdf`            | `files.$.tsx` |
| `/files/talks/remix-conf_final.pdf`          | `files.$.tsx` |
| `/files/talks/remix-conf-FINAL-MAY_2022.pdf` | `files.$.tsx` |

Similar to dynamic route parameters, you can access the value of the matched path on the splat route's `params` with the `"*"` key.

```tsx filename=app/routes/files.$.tsx
export function loader({ params }) {
  const filePath = params["*"];
  return fake.getFileInfo(filePath);
}
```

## Escaping Special Characters

If you want one of the special characters Remix uses for these route conventions to actually be a part of the URL, you can escape the conventions with `[]` characters.

| Filename                        | URL                 |
| ------------------------------- | ------------------- |
| `routes/sitemap[.]xml.tsx`      | `/sitemap.xml`      |
| `routes/[sitemap.xml].tsx`      | `/sitemap.xml`      |
| `routes/weird-url.[_index].tsx` | `/weird-url/_index` |
| `routes/dolla-bills-[$].tsx`    | `/dolla-bills-$`    |
| `routes/[[so-weird]].tsx`       | `/[so-weird]`       |

## Folders for Organization

Routes can also be folders with a `route.tsx` file inside defining the route module. The rest of the files in the folder will not become routes. This allows you to organize your code closer to the routes that use them instead of repeating the feature names across other folders.

<docs-info>The files inside a folder have no meaning for the route paths, the route path is completely defined by the folder name</docs-info>

Consider these routes:

```
routes/
  _landing._index.tsx
  _landing.about.tsx
  _landing.tsx
  app._index.tsx
  app.projects.tsx
  app.tsx
  app_.projects.$id.roadmap.tsx
```

Some, or all of them can be folders holding their own `route` module inside.

```
routes/
  _landing._index/
    route.tsx
    scroll-experience.tsx
  _landing.about/
    employee-profile-card.tsx
    get-employee-data.server.tsx
    route.tsx
    team-photo.jpg
  _landing/
    header.tsx
    footer.tsx
    route.tsx
  app._index/
    route.tsx
    stats.tsx
  app.projects/
    get-projects.server.tsx
    project-card.tsx
    project-buttons.tsx
    route.tsx
  app/
    primary-nav.tsx
    route.tsx
    footer.tsx
  app_.projects.$id.roadmap/
    route.tsx
    chart.tsx
    update-timeline.server.tsx
  contact-us.tsx
```

Note that when you turn a route module into a folder, the route module becomes `folder/route.tsx`, all other modules in the folder will not become routes. For example:

```
# these are the same route:
routes/app.tsx
routes/app/route.tsx

# as are these
routes/app._index.tsx
routes/app._index/route.tsx
```

## Scaling

Our general recommendation for scale is to make every route a folder and put the modules used exclusively by that route in the folder, then put the shared modules outside of routes folder elsewhere. This has a couple benefits:

- Easy to identify shared modules, so tread lightly when changing them
- Easy to organize and refactor the modules for a specific route without creating "file organization fatigue" and cluttering up other parts of the app

## More Flexibility

While we like this file convention, we recognize that at a certain scale many organizations won't like it. You can always define your routes programmatically in the [remix config][remix-config].

There's also the [Flat Routes][flat-routes] third-party package with configurable options beyond the defaults in Remix.

[loader]: ../route/loader
[action]: ../route/action
[outlet]: ../components/outlet
[routing-guide]: ../guides/routing
[root-route]: #root-route
[resource-route]: ../guides/resource-routes
[routeconvention-v2]: ./route-files-v2
[flatroutes-rfc]: https://github.com/remix-run/remix/discussions/4482
[root-route]: #root-route
[index-route]: ../guides/routing#index-routes
[nested-routing]: ../guides/routing#what-is-nested-routing
[nested-routes]: #nested-routes
[remix-config]: ./remix-config#routes
[dot-delimiters]: #dot-delimiters
[dynamic-segments]: #dynamic-segments
[remix-config]: ./remix-config#routes
[flat-routes]: https://github.com/kiliman/remix-flat-routes
