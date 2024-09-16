---
title: Route File Naming
---

# Route File Naming

While you can configure routes via [the "routes" plugin option][routes_config], most routes are created with this file system convention. Add a file, get a route.

Please note that you can use either `.js`, `.jsx`, `.ts` or `.tsx` file extensions. We'll stick with `.tsx` in the examples to avoid duplication.

<docs-info>Dilum Sanjaya made [an awesome visualization][an_awesome_visualization] of how routes in the file system map to the URL in your app that might help you understand these conventions.</docs-info>

## Disclaimer

Before we go too far into the Remix convention though, we'd like to point out that file-based routing is an **incredibly** subjective idea. Some folks love the "flat" routes idea, some folks hate it and would prefer nesting routes in folders. Some folks simply hate file-based routing and would prefer to configure routes via JSON. Some folks would prefer to configure routes via JSX like they did in their React Router SPA's.

The point is, we are well aware of this and from the get-go, Remix has always given you a first-class way to opt-out via the [`routes`][routes_config]/[`ignoredRouteFiles`][ignoredroutefiles_config] and [configure your routes manually][manual-route-configuration]. But, there has to be _some_ default so that folks can get up and running quickly and easily - and we think that the flat routes convention document below is a pretty good default that scales well for small-to-medium sized apps.

Large applications with hundred or thousands of routes will _always_ be a bit chaotic no matter what convention you use - and the idea is that via the `routes` config, you get to build _exactly_ the convention that works best for your application/team. It would be quite literally impossible for Remix to have a default convention that made everyone happy. We'd much rather give you a fairly straightforward default, and then let the community build any number of conventions you can pick and choose from.

So, before we dive into the details of the Remix default convention, here's some community alternatives you can check out if you decide that our default is not your cup of tea.

- [`remix-flat-routes`][flat_routes] - The Remix default is basically a simplified version of this package. The author has continued to iterate on and evolve this package so if you generally like the "flat routes" idea but want a bit more power (including a hybrid approach of files and folders), definitely check this one out.
- [`remix-custom-routes`][custom_routes] - If you want even more customization, this package lets you define that types of files should be treated as routes. This lets you go beyond the simple flat/nested concept and do something such as _"any file with an extension of `.route.tsx` is a route"_.
- [`remix-json-routes`][json_routes] - If you just want to specify your routes via a config file, this is your jam - just provide Remix a JSON object with your routes and skip the flat/nested concept entirely. There's even a JSX option in there too.

## Root Route

```text lines=[3]
app/
├── routes/
└── root.tsx
```

The file in `app/root.tsx` is your root layout, or "root route" (very sorry for those of you who pronounce those words the same way!). It works just like all other routes, so you can export a [`loader`][loader], [`action`][action], etc.

The root route typically looks something like this. It serves as the root layout of the entire app, all other routes will render inside the [`<Outlet />`][outlet_component].

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

Any JavaScript or TypeScript files in the `app/routes` directory will become routes in your application. The filename maps to the route's URL pathname, except for `_index.tsx` which is the [index route][index_route] for the [root route][root_route].

```text lines=[3-4]
app/
├── routes/
│   ├── _index.tsx
│   └── about.tsx
└── root.tsx
```

| URL      | Matched Routes          |
| -------- | ----------------------- |
| `/`      | `app/routes/_index.tsx` |
| `/about` | `app/routes/about.tsx`  |

Note that these routes will be rendered in the outlet of `app/root.tsx` because of [nested routing][nested_routing].

## Dot Delimiters

Adding a `.` to a route filename will create a `/` in the URL.

```text lines=[5-7]
 app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.trending.tsx
│   ├── concerts.salt-lake-city.tsx
│   └── concerts.san-diego.tsx
└── root.tsx
```

| URL                        | Matched Route                            |
| -------------------------- | ---------------------------------------- |
| `/`                        | `app/routes/_index.tsx`                  |
| `/about`                   | `app/routes/about.tsx`                   |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx`       |
| `/concerts/salt-lake-city` | `app/routes/concerts.salt-lake-city.tsx` |
| `/concerts/san-diego`      | `app/routes/concerts.san-diego.tsx`      |

The dot delimiter also creates nesting, see the [nesting section][nested_routes] for more information.

## Dynamic Segments

Usually your URLs aren't static but data-driven. Dynamic segments allow you to match segments of the URL and use that value in your code. You create them with the `$` prefix.

```text lines=[5]
 app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.$city.tsx
│   └── concerts.trending.tsx
└── root.tsx
```

| URL                        | Matched Route                      |
| -------------------------- | ---------------------------------- |
| `/`                        | `app/routes/_index.tsx`            |
| `/about`                   | `app/routes/about.tsx`             |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx`    |
| `/concerts/san-diego`      | `app/routes/concerts.$city.tsx`    |

Remix will parse the value from the URL and pass it to various APIs. We call these values "URL Parameters". The most useful places to access the URL params are in [loaders][loader] and [actions][action].

```tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  return fakeDb.getAllConcertsForCity(params.city);
}
```

You'll note the property name on the `params` object maps directly to the name of your file: `$city.tsx` becomes `params.city`.

Routes can have multiple dynamic segments, like `concerts.$city.$date`, both are accessed on the params object by name:

```tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  return fake.db.getConcerts({
    date: params.date,
    city: params.city,
  });
}
```

See the [routing guide][routing_guide] for more information.

## Nested Routes

Nested Routing is the general idea of coupling segments of the URL to component hierarchy and data. You can read more about it in the [Routing Guide][nested_routing].

You create nested routes with [dot delimiters][dot_delimiters]. If the filename before the `.` matches another route filename, it automatically becomes a child route to the matching parent. Consider these routes:

```text lines=[5-8]
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

All the routes that start with `app/routes/concerts.` will be child routes of `app/routes/concerts.tsx` and render inside the parent route's [outlet_component][outlet_component].

| URL                        | Matched Route                      | Layout                    |
| -------------------------- | ---------------------------------- | ------------------------- |
| `/`                        | `app/routes/_index.tsx`            | `app/root.tsx`            |
| `/about`                   | `app/routes/about.tsx`             | `app/root.tsx`            |
| `/concerts`                | `app/routes/concerts._index.tsx`   | `app/routes/concerts.tsx` |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx` | `app/routes/concerts.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx`    | `app/routes/concerts.tsx` |

Note you typically want to add an index route when you add nested routes so that something renders inside the parent's outlet when users visit the parent URL directly.

For example, if the URL is `/concerts/salt-lake-city` then the UI hierarchy will look like this:

```tsx
<Root>
  <Concerts>
    <City />
  </Concerts>
</Root>
```

## Nested URLs without Layout Nesting

Sometimes you want the URL to be nested, but you don't want the automatic layout nesting. You can opt out of nesting with a trailing underscore on the parent segment:

```text lines=[8]
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

| URL                        | Matched Route                      | Layout                    |
| -------------------------- | ---------------------------------- | ------------------------- |
| `/`                        | `app/routes/_index.tsx`            | `app/root.tsx`            |
| `/about`                   | `app/routes/about.tsx`             | `app/root.tsx`            |
| `/concerts/mine`           | `app/routes/concerts_.mine.tsx`    | `app/root.tsx`            |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx` | `app/routes/concerts.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx`    | `app/routes/concerts.tsx` |

Note that `/concerts/mine` does not nest with `app/routes/concerts.tsx` anymore, but `app/root.tsx`. The `trailing_` underscore creates a path segment, but it does not create layout nesting.

Think of the `trailing_` underscore as the long bit at the end of your parent's signature, writing you out of the will, removing the segment that follows from the layout nesting.

## Nested Layouts without Nested URLs

We call these <a name="pathless-routes"><b>Pathless Routes</b></a>

Sometimes you want to share a layout with a group of routes without adding any path segments to the URL. A common example is a set of authentication routes that have a different header/footer than the public pages or the logged in app experience. You can do this with a `_leading` underscore.

```text lines=[3-5]
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

| URL                        | Matched Route                   | Layout                    |
| -------------------------- | ------------------------------- | ------------------------- |
| `/`                        | `app/routes/_index.tsx`         | `app/root.tsx`            |
| `/login`                   | `app/routes/_auth.login.tsx`    | `app/routes/_auth.tsx`    |
| `/register`                | `app/routes/_auth.register.tsx` | `app/routes/_auth.tsx`    |
| `/concerts`                | `app/routes/concerts.tsx`       | `app/root.tsx`            |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx` | `app/routes/concerts.tsx` |

Think of the `_leading` underscore as a blanket you're pulling over the filename, hiding the filename from the URL.

## Optional Segments

Wrapping a route segment in parentheses will make the segment optional.

```text lines=[3-5]
 app/
├── routes/
│   ├── ($lang)._index.tsx
│   ├── ($lang).$productId.tsx
│   └── ($lang).categories.tsx
└── root.tsx
```

| URL                        | Matched Route                       |
| -------------------------- | ----------------------------------- |
| `/`                        | `app/routes/($lang)._index.tsx`     |
| `/categories`              | `app/routes/($lang).categories.tsx` |
| `/en/categories`           | `app/routes/($lang).categories.tsx` |
| `/fr/categories`           | `app/routes/($lang).categories.tsx` |
| `/american-flag-speedo`    | `app/routes/($lang)._index.tsx`     |
| `/en/american-flag-speedo` | `app/routes/($lang).$productId.tsx` |
| `/fr/american-flag-speedo` | `app/routes/($lang).$productId.tsx` |

You may wonder why `/american-flag-speedo` is matching the `($lang)._index.tsx` route instead of `($lang).$productId.tsx`. This is because when you have an optional dynamic param segment followed by another dynamic param, Remix cannot reliably determine if a single-segment URL such as `/american-flag-speedo` should match `/:lang` `/:productId`. Optional segments match eagerly and thus it will match `/:lang`. If you have this type of setup it's recommended to look at `params.lang` in the `($lang)._index.tsx` loader and redirect to `/:lang/american-flag-speedo` for the current/default language if `params.lang` is not a valid language code.

## Splat Routes

While [dynamic segments][dynamic_segments] match a single path segment (the stuff between two `/` in a URL), a splat route will match the rest of a URL, including the slashes.

```text lines=[4,6]
 app/
├── routes/
│   ├── _index.tsx
│   ├── $.tsx
│   ├── about.tsx
│   └── files.$.tsx
└── root.tsx
```

| URL                                          | Matched Route            |
| -------------------------------------------- | ------------------------ |
| `/`                                          | `app/routes/_index.tsx`  |
| `/about`                                     | `app/routes/about.tsx`   |
| `/beef/and/cheese`                           | `app/routes/$.tsx`       |
| `/files`                                     | `app/routes/files.$.tsx` |
| `/files/talks/remix-conf_old.pdf`            | `app/routes/files.$.tsx` |
| `/files/talks/remix-conf_final.pdf`          | `app/routes/files.$.tsx` |
| `/files/talks/remix-conf-FINAL-MAY_2022.pdf` | `app/routes/files.$.tsx` |

Similar to dynamic route parameters, you can access the value of the matched path on the splat route's `params` with the `"*"` key.

```tsx filename=app/routes/files.$.tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  const filePath = params["*"];
  return fake.getFileInfo(filePath);
}
```

## Escaping Special Characters

If you want one of the special characters Remix uses for these route conventions to actually be a part of the URL, you can escape the conventions with `[]` characters.

| Filename                            | URL                 |
| ----------------------------------- | ------------------- |
| `app/routes/sitemap[.]xml.tsx`      | `/sitemap.xml`      |
| `app/routes/[sitemap.xml].tsx`      | `/sitemap.xml`      |
| `app/routes/weird-url.[_index].tsx` | `/weird-url/_index` |
| `app/routes/dolla-bills-[$].tsx`    | `/dolla-bills-$`    |
| `app/routes/[[so-weird]].tsx`       | `/[so-weird]`       |

## Folders for Organization

Routes can also be folders with a `route.tsx` file inside defining the route module. The rest of the files in the folder will not become routes. This allows you to organize your code closer to the routes that use them instead of repeating the feature names across other folders.

<docs-info>The files inside a folder have no meaning for the route paths, the route path is completely defined by the folder name</docs-info>

Consider these routes:

```text
 app/
├── routes/
│   ├── _landing._index.tsx
│   ├── _landing.about.tsx
│   ├── _landing.tsx
│   ├── app._index.tsx
│   ├── app.projects.tsx
│   ├── app.tsx
│   └── app_.projects.$id.roadmap.tsx
└── root.tsx
```

Some, or all of them can be folders holding their own `route` module inside.

```text
app/
├── routes/
│   ├── _landing._index/
│   │   ├── route.tsx
│   │   └── scroll-experience.tsx
│   ├── _landing.about/
│   │   ├── employee-profile-card.tsx
│   │   ├── get-employee-data.server.ts
│   │   ├── route.tsx
│   │   └── team-photo.jpg
│   ├── _landing/
│   │   ├── footer.tsx
│   │   ├── header.tsx
│   │   └── route.tsx
│   ├── app._index/
│   │   ├── route.tsx
│   │   └── stats.tsx
│   ├── app.projects/
│   │   ├── get-projects.server.ts
│   │   ├── project-buttons.tsx
│   │   ├── project-card.tsx
│   │   └── route.tsx
│   ├── app/
│   │   ├── footer.tsx
│   │   ├── primary-nav.tsx
│   │   └── route.tsx
│   ├── app_.projects.$id.roadmap/
│   │   ├── chart.tsx
│   │   ├── route.tsx
│   │   └── update-timeline.server.ts
│   └── contact-us.tsx
└── root.tsx
```

Note that when you turn a route module into a folder, the route module becomes `folder/route.tsx`, all other modules in the folder will not become routes. For example:

```
# these are the same route:
app/routes/app.tsx
app/routes/app/route.tsx

# as are these
app/routes/app._index.tsx
app/routes/app._index/route.tsx
```

## Scaling

Our general recommendation for scale is to make every route a folder and put the modules used exclusively by that route in the folder, then put the shared modules outside of routes folder elsewhere. This has a couple benefits:

- Easy to identify shared modules, so tread lightly when changing them
- Easy to organize and refactor the modules for a specific route without creating "file organization fatigue" and cluttering up other parts of the app

[loader]: ../route/loader
[action]: ../route/action
[outlet_component]: ../components/outlet
[routing_guide]: ../discussion/routes
[root_route]: #root-route
[index_route]: ../discussion/routes#index-routes
[nested_routing]: ../discussion/routes#what-is-nested-routing
[nested_routes]: #nested-routes
[routes_config]: ./vite-config#routes
[ignoredroutefiles_config]: ./vite-config#ignoredroutefiles
[dot_delimiters]: #dot-delimiters
[dynamic_segments]: #dynamic-segments
[an_awesome_visualization]: https://interactive-remix-routing-v2.netlify.app/
[flat_routes]: https://github.com/kiliman/remix-flat-routes
[custom_routes]: https://github.com/jacobparis-insiders/remix-custom-routes
[json_routes]: https://github.com/brophdawg11/remix-json-routes
[manual-route-configuration]: ../discussion/routes#manual-route-configuration
