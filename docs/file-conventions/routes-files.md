---
title: Route File Naming
---

# Route File Naming

<docs-warning>The route file convention is changing in v2. You can prepare for this change at your convenience with the `v2_routeConvention` future flag. For instructions on making this change see the [v2 guide][v2guide].</docs-warning>

Setting up routes in Remix is as simple as creating files in your `app` directory. These are the conventions you should know to understand how routing in Remix works.

Please note that you can use either `.js`, `.jsx`, `.ts` or `.tsx` file extensions. We'll stick with `.tsx` in the examples to avoid duplication.

## Root Route

<!-- prettier-ignore -->
```markdown lines=[3]
app/
├── routes/
└── root.tsx
```

The file in `app/root.tsx` is your root layout, or "root route" (very sorry for those of you who pronounce those words the same way!). It works just like all other routes:

- You can export a [`loader`][loader], [`action`][action], [`meta`][meta], [`headers`][headers], or [`links`][links] function
- You can export an [`ErrorBoundary`][error-boundary] or [`CatchBoundary`][catch-boundary]
- Your default export is the layout component that renders the rest of your app in an [`<Outlet />`][outlet]

## Basic Routes

Any JavaScript or TypeScript files in the `app/routes/` directory will become routes in your application. The filename maps to the route's URL pathname, except for `index.tsx` which maps to the root pathname.

<!-- prettier-ignore -->
```markdown lines=[3-4]
app/
├── routes/
│   ├── about.tsx
│   └── index.tsx
└── root.tsx
```

| URL      | Matched Route          |
| -------- | ---------------------- |
| `/`      | `app/routes/index.tsx` |
| `/about` | `app/routes/about.tsx` |

The default export in this file is the component that is rendered at that route and will render within the `<Outlet />` rendered by the root route.

## Dynamic Route Parameters

<!-- prettier-ignore -->
```markdown lines=[4]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   └── index.tsx
│   ├── about.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                | Matched Route                    |
| ------------------ | -------------------------------- |
| `/blog`            | `app/routes/blog/index.tsx`      |
| `/blog/categories` | `app/routes/blog/categories.tsx` |
| `/blog/my-post`    | `app/routes/blog/$postId.tsx`    |

</details>

Routes that begin with a `$` character indicate the name of a dynamic segment of the URL. It will be parsed and passed to your loader and action data as a value on the `param` object.

For example: `app/routes/blog/$postId.tsx` will match the following URLs:

- `/blog/my-story`
- `/blog/once-upon-a-time`
- `/blog/how-to-ride-a-bike`

On each of these pages, the dynamic segment of the URL path is the value of the parameter. There can be multiple parameters active at any time (as in `/dashboard/:client/invoices/:invoiceId` [view example app][view-example-app]) and all parameters can be accessed within components via [`useParams`][use-params] and within loaders/actions via the argument's [`params`][params] property:

```tsx filename=app/routes/blog/$postId.tsx
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { useParams } from "@remix-run/react";

export const loader = async ({ params }: LoaderArgs) => {
  console.log(params.postId);
};

export const action = async ({ params }: ActionArgs) => {
  console.log(params.postId);
};

export default function PostRoute() {
  const params = useParams();
  console.log(params.postId);
}
```

Nested routes can also contain dynamic segments by using the `$` character in the parent's directory name. For example, `app/routes/blog/$postId/edit.tsx` might represent the editor page for blog entries.

See the [routing guide][routing-guide] for more information.

## Optional Segments

Wrapping a route segment in parens will make the segment optional.

<!-- prettier-ignore -->
```markdown lines=[3]
app/
├── routes/
│   ├── ($lang)/
│   │   ├── $pid.tsx
│   │   ├── categories.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                        | Matched Route                       |
| -------------------------- | ----------------------------------- |
| `/categories`              | `app/routes/($lang)/categories.tsx` |
| `/en/categories`           | `app/routes/($lang)/categories.tsx` |
| `/fr/categories`           | `app/routes/($lang)/categories.tsx` |
| `/american-flag-speedo`    | `app/routes/($lang)/$pid.tsx`       |
| `/en/american-flag-speedo` | `app/routes/($lang)/$pid.tsx`       |
| `/fr/american-flag-speedo` | `app/routes/($lang)/$pid.tsx`       |

</details>

## Layout Routes

<!-- prettier-ignore -->
```markdown lines=[3,8]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   └── index.tsx
│   ├── about.tsx
│   ├── blog.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                | Matched Route                    | Layout                |
| ------------------ | -------------------------------- | --------------------- |
| `/`                | `app/routes/index.tsx`           | `app/root.tsx`        |
| `/about`           | `app/routes/about.tsx`           | `app/root.tsx`        |
| `/blog`            | `app/routes/blog/index.tsx`      | `app/routes/blog.tsx` |
| `/blog/categories` | `app/routes/blog/categories.tsx` | `app/routes/blog.tsx` |
| `/blog/my-post`    | `app/routes/blog/$postId.tsx`    | `app/routes/blog.tsx` |

</details>

In the example above, the `blog.tsx` is a "layout route" for everything within the `blog` directory (`blog/index.tsx` and `blog/categories.tsx`). When a route has the same name as its directory (`routes/blog.tsx` and `routes/blog/`), it becomes a layout route for all the routes inside that directory ("child routes"). Similar to your [root route][root-route], the parent route should render an `<Outlet />` where the child routes should appear. This is how you can create multiple levels of persistent layout nesting associated with URLs.

## Pathless Layout Routes

<!-- prettier-ignore -->
```markdown lines=[3,7,10-11]
app/
├── routes/
│   ├── __app/
│   │   ├── dashboard.tsx
│   │   └── $userId/
│   │       └── profile.tsx
│   └── __marketing
│   │   ├── index.tsx
│   │   └── product.tsx
│   ├── __app.tsx
│   └── __marketing.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL               | Matched Route                          | Layout                       |
| ----------------- | -------------------------------------- | ---------------------------- |
| `/`               | `app/routes/__marketing/index.tsx`     | `app/routes/__marketing.tsx` |
| `/product`        | `app/routes/__marketing/product.tsx`   | `app/routes/__marketing.tsx` |
| `/dashboard`      | `app/routes/__app/dashboard.tsx`       | `app/routes/__app.tsx`       |
| `/chance/profile` | `app/routes/__app/$userId/profile.tsx` | `app/routes/__app.tsx`       |

</details>

You can also create layout routes _without adding segments to the URL_ by prepending the directory and associated parent route file with double underscores: `__`.

For example, all of your marketing pages could be in `app/routes/__marketing/*` and then share a layout by creating `app/routes/__marketing.tsx`. A route `app/routes/__marketing/product.tsx` would be accessible at the `/product` URL because `__marketing` won't add segments to the URL, just UI hierarchy.

<docs-warning>Be careful, pathless layout routes introduce the possibility of URL conflicts</docs-warning>

## Dot Delimiters

<!-- prettier-ignore -->
```markdown lines=[8]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   └── index.tsx
│   ├── about.tsx
│   ├── blog.authors.tsx
│   ├── blog.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                | Matched Route                    | Layout                |
| ------------------ | -------------------------------- | --------------------- |
| `/blog`            | `app/routes/blog/index.tsx`      | `app/routes/blog.tsx` |
| `/blog/categories` | `app/routes/blog/categories.tsx` | `app/routes/blog.tsx` |
| `/blog/authors`    | `app/routes/blog.authors.tsx`    | `app/root.tsx`        |

</details>

By creating a file with `.` characters between segments, you can create a nested URL without nested layouts. For example, a file `app/routes/blog.authors.tsx` will route to the pathname `/blog/authors`, but it will not share a layout with routes in the `app/routes/blog/` directory.

## Splat Routes

<!-- prettier-ignore -->
```markdown lines=[7]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   └── index.tsx
│   ├── $.tsx
│   ├── about.tsx
│   ├── blog.authors.tsx
│   ├── blog.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL               | Matched Route               | Layout                |
| ----------------- | --------------------------- | --------------------- |
| `/`               | `app/routes/index.tsx`      | `app/root.tsx`        |
| `/blog`           | `app/routes/blog/index.tsx` | `app/routes/blog.tsx` |
| `/somewhere-else` | `app/routes/$.tsx`          | `app/root.tsx`        |

</details>

Files that are named `$.tsx` are called "splat" (or "catch-all") routes. These routes will map to any URL not matched by other route files in the same directory.

Similar to dynamic route parameters, you can access the value of the matched path on the splat route's `params` with the `"*"` key.

```tsx filename=app/routes/$.tsx
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { useParams } from "@remix-run/react";

export const loader = async ({ params }: LoaderArgs) => {
  console.log(params["*"]);
};

export const action = async ({ params }: ActionArgs) => {
  console.log(params["*"]);
};

export default function PostRoute() {
  const params = useParams();
  console.log(params["*"]);
}
```

## Escaping special characters

Because some characters have special meaning, you must use our escaping syntax if you want those characters to actually appear in the route. For example, if I wanted to make a [Resource Route][resource-route] for a `/sitemap.xml`, I could name the file `app/routes/[sitemap.xml].tsx`. So you simply wrap any part of the filename with brackets and that will escape any special characters.

<docs-info>
  Note, you could even do `app/routes/sitemap[.]xml.tsx` if you wanted to only wrap the part that needs to be escaped. It makes no difference. Choose the one you like best.
</docs-info>

[loader]: ../route/loader
[action]: ../route/action
[meta]: ../route/meta
[headers]: ../route/headers
[links]: ../route/links
[error-boundary]: ../route/error-boundary
[catch-boundary]: ../route/catch-boundary
[outlet]: ../components/outlet
[view-example-app]: https://github.com/remix-run/examples/tree/main/multiple-params
[use-params]: https://reactrouter.com/hooks/use-params
[params]: ../route/loader#params
[routing-guide]: ../guides/routing
[root-route]: #root-route
[resource-route]: ../guides/resource-routes
[v2guide]: ../pages/v2#file-system-route-convention
