---
title: Routing and Controllers
description: How route maps, route helpers, controllers, actions, responses, and route pattern syntax define Remix request handling.
---

In [Start Here](/docs/start-here), we built one request path: a Web [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) comes in, Remix matches a route, a controller runs an action, and the app returns a Web [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

Full-stack Remix apps are built around that route/controller boundary. `app/routes.ts` names the URLs and methods your app accepts, controllers in `app/actions/` implement them, and each action returns the response that becomes the page, redirect, JSON payload, file, or error the browser receives.

## Routes as the URL contract {#routes-as-the-url-contract}

In Remix, routes are defined separately from the actions that handle matched requests. `routes.ts` says which URLs and methods the app accepts, while controllers decide what response to return when one of those routes matches.

Here's what a small route map for a record store would look like:

```ts filename=app/routes.ts
import { route } from "remix/routes";

export const routes = route({
  home: "/",
  albums: {
    show: { method: "GET", pattern: "/albums/:albumId" },
    edit: {
      index: { method: "GET", pattern: "/albums/:albumId/edit" },
      action: { method: "POST", pattern: "/albums/:albumId/edit" },
    },
  },
});
```

`route(...)` returns a typed object with the same shape: a leaf like `routes.albums.show` is a route with a method and a pattern, while a branch like `routes.albums` or `routes.albums.edit` is another route map.

That gives the rest of the app a typed way to build URLs:

```ts
routes.albums.show.href({ albumId: "thriller" });
// /albums/thriller
```

The `albumId` property is required because it comes from `:albumId` in the route pattern. If you later rename the pattern to `'/albums/:id'`, old calls that still pass `{ albumId: ... }` will report TypeScript errors. The same `routes` object can be used in controllers, links, forms, redirects, and tests, so URL changes are not hidden in string literals around the app.

Route patterns support more than path params, including wildcards, optional segments, search params, and full origins. The [Route pattern syntax](#route-pattern-syntax) section at the end of this chapter covers the full syntax.

The `edit` branch has two leaves at the same URL: `index` handles `GET` and `action` handles `POST`.

```ts
routes.albums.edit.index.href({ albumId: "thriller" }); // GET /albums/thriller/edit
routes.albums.edit.action.href({ albumId: "thriller" }); // POST /albums/thriller/edit
```

That difference between leaves and nested maps matters once we start mapping controllers. The `edit` branch above is six lines of `{ method, pattern }` objects to get a `GET` and a `POST` at the same URL. The helpers in the next section produce the same shape from one call, so most route maps use them instead.

## Route builders: route, get, post, put, del, form, resources {#route-builders-route-get-post-put-del-form-resources}

Most apps use the route helpers instead of writing `{ method, pattern }` objects by hand.

```ts filename=app/routes.ts
import { del, get, post, route } from "remix/routes";

export const routes = route({
  home: get("/"),
  albums: {
    show: get("/albums/:albumId"),
    create: post("/albums"),
    destroy: del("/albums/:albumId"),
  },
});
```

The HTTP method helpers are `get`, `post`, `put`, `patch`, `del`, `head`, and `options`, and each one creates a single route narrowed to that method. A bare string leaf is method-agnostic, so `webhook: '/webhooks/github'` can match `GET`, `POST`, or any other method. Prefer a method helper unless the action intentionally checks `context.method` itself.

```ts filename=app/routes.ts
import { route } from "remix/routes";

export const routes = route({
  webhook: "/webhooks/github",
  search: { method: "GET", pattern: "/search" },
});
```

You can also give `route(...)` a prefix when one branch owns a set of relative patterns:

```ts filename=app/routes.ts
import { get, route } from "remix/routes";

const albumRouteDefs = {
  index: get("/"),
  show: get("/:albumId"),
};

export const routes = route({
  albums: route("/albums", albumRouteDefs),
});

// routes.albums.index -> GET /albums
// routes.albums.show  -> GET /albums/:albumId
```

Use `form(...)` when a page and its submit action live at the same URL:

```ts filename=app/routes.ts
import { form, route } from "remix/routes";

export const routes = route({
  albums: {
    edit: form("/albums/:albumId/edit"),
  },
});

// routes.albums.edit.index  -> GET  /albums/:albumId/edit
// routes.albums.edit.action -> POST /albums/:albumId/edit
```

The [Forms and Mutations](/docs/forms-and-mutations) chapter builds on this route shape for validation, redirects, and progressive enhancement.

Use `resources(...)` for a collection and `resource(...)` for a singleton. A collection resource can create `index`, `new`, `show`, `create`, `edit`, `update`, and `destroy` routes. A singleton resource has no `index` route because there is no collection page.

Both helpers support `only`, `exclude`, `param`, and `names`, so you can start from the conventional REST shape and keep only the routes you need:

```ts filename=app/routes.ts
import { resources, route } from "remix/routes";

export const routes = route({
  albums: resources("/albums", {
    only: ["index", "show", "create"],
    param: "albumId",
  }),
});

// routes.albums.index  -> GET    /albums
// routes.albums.show   -> GET    /albums/:albumId
// routes.albums.create -> POST   /albums
```

Use `names` only when the default route keys do not match the words your app uses.

All of these helpers produce ordinary route maps and route leaves. They can be nested and passed to `createController` and `router.map()` the same way a hand-written map can.

## Controllers and actions {#controllers-and-actions}

A controller pairs the leaves of one route map with actions, so `createController(routes.albums, ...)` means “this controller handles the leaf routes inside `routes.albums`.”

```tsx filename=app/actions/albums/controller.tsx
import { createController } from "remix/router";

import { routes } from "../../routes.ts";

export default createController(routes.albums, {
  actions: {
    show(context) {
      return new Response(`Album: ${context.params.albumId}`);
    },
  },
});
```

Because `show` is defined as `get('/albums/:albumId')`, the action receives `context.params.albumId` as a `string`. You don't need to parse the URL yourself, and you don't need to guard against `albumId` being missing for this route.

These are the context fields you will use most often in actions:

- `context.request` is the original Web `Request`.
- `context.url` is the parsed [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL).
- `context.method` is the request method after method override middleware has run.
- `context.params` contains params from the matched route pattern.
- `context.headers` is a mutable [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) copy of the request headers.
- `context.get(key)` reads values added by middleware.

Prefer `context.method`, `context.headers`, and middleware-provided context values over reading everything from `context.request`. Middleware may have already parsed the body, changed the method, or attached values such as parsed [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and a session. The [Request Handling](/docs/request-handling) chapter covers typed context in more detail.

An action can also be an object with route-specific middleware and a `handler`. This is handy when one action needs setup that the rest of the controller does not.

```tsx filename=app/actions/albums/edit/controller.tsx
import { formData } from "remix/middleware/form-data";
import { createController } from "remix/router";

import { routes } from "../../../routes.ts";

export default createController(routes.albums.edit, {
  actions: {
    index() {
      return new Response("Edit album");
    },
    action: {
      middleware: [formData()],
      handler(context) {
        let title = String(context.formData.get("title") ?? "");

        return new Response(`Updated ${title}`, { status: 200 });
      },
    },
  },
});
```

Router middleware runs first, then controller middleware, then action middleware, then the action handler. The [`remix/router` overview](https://api.remix.run/api/remix/router/overview/) covers the API surface for routers, controllers, actions, and middleware.

## Responses, redirects, headers, and errors {#responses-redirects-headers-and-errors}

Actions return Web `Response` objects. A text response can be as small as this:

```ts
return new Response("Album not found", { status: 404 });
```

For redirects, use `redirect` from `remix/response/redirect`. After a successful `POST`, use `303 See Other` so the browser follows up with a `GET` and does not resubmit the form on refresh.

```ts filename=app/actions/albums/edit/controller.tsx
import { redirect } from "remix/response/redirect";

import { routes } from "../../../routes.ts";

// inside an action:
return redirect(
  routes.albums.show.href({ albumId: context.params.albumId }),
  303,
);
```

For HTML outside the normal render pipeline covered in [Rendering UI](/docs/rendering-ui), use `createHtmlResponse` from `remix/response/html`. It sets the HTML content type and makes sure the response starts with a doctype. If you interpolate values into an HTML string, use `html` from `remix/html-template` so user-provided values are escaped.

```ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

return createHtmlResponse(html`<p>${album.title}</p>`);
```

Headers and status use the standard response init object whether you are returning a raw `Response`, a redirect, or an HTML response. For JSON, use the platform [`Response.json(...)`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static) helper.

```ts
return Response.json(album, {
  headers: {
    "Cache-Control": "no-store",
  },
});
```

For expected failures, return a response with the appropriate status: `404` for missing records, `400` for invalid input, `401` for unauthenticated requests, and `403` for authenticated users who still cannot access the route. The [Errors & Error Boundaries](/docs/errors-and-error-boundaries) chapter covers thrown errors, render failures, and error boundaries.

## Nested route maps and ownership {#nested-route-maps-and-ownership}

A route map can contain both leaves and other route maps. In this example, `show` is a leaf and `edit` is a nested map:

```ts filename=app/routes.ts
import { form, get, route } from "remix/routes";

export const routes = route({
  home: "/",
  albums: {
    show: get("/albums/:albumId"),
    edit: form("/albums/:albumId/edit"),
  },
});
```

Controllers own leaves, not whole subtrees. If one controller owns `routes.albums`, it handles `show`. It does not handle `routes.albums.edit.index` or `routes.albums.edit.action`, because those leaves belong to the nested `edit` map.

Wire that ownership in `app/router.ts` with one `router.map(...)` call per controller:

```ts filename=app/router.ts
import { createRouter } from "remix/router";

import rootController from "./actions/controller.tsx";
import albumsController from "./actions/albums/controller.tsx";
import albumsEditController from "./actions/albums/edit/controller.tsx";
import { routes } from "./routes.ts";

export const router = createRouter();

router.map(routes, rootController);
router.map(routes.albums, albumsController);
router.map(routes.albums.edit, albumsEditController);
```

With those mappings:

- `rootController` handles root-level leaves such as `home`.
- `albumsController` handles `routes.albums.show`.
- `albumsEditController` handles `routes.albums.edit.index` and `routes.albums.edit.action`.

Controller middleware follows the same ownership rule. Middleware on `albumsController` runs for `routes.albums.show`, but not for `routes.albums.edit.index` or `routes.albums.edit.action`.

Remix checks this during router setup. If a controller is missing an action for a leaf it owns, setup throws before the app starts serving requests.

## Organizing route-owned code {#organizing-route-owned-code}

The file tree usually follows the same shape as the route map:

```txt
app/actions/
├── controller.tsx              # routes
└── albums/
    ├── controller.tsx          # routes.albums
    └── edit/
        ├── controller.tsx      # routes.albums.edit
        └── page.tsx            # route-local UI
```

Once a route branch has its own nested routes, give it its own directory and controller. The parent controller stays smaller, and the owner of each route is visible from the file path.

Route-local UI belongs next to the controller that renders it, so the page and form for `albums.edit` belong in `actions/albums/edit/`. Move a component to `ui/` once more than one route uses it. The [Rendering UI](/docs/rendering-ui) chapter covers the component model, and [Files and Assets](/docs/files-and-assets) covers browser-loadable `.browser.ts` and `.browser.tsx` modules.

For very large route areas, `router.mount(...)` lets a feature register its own relative route group under a prefix:

```ts filename=app/router.ts
router.mount("/admin", installAdminRoutes);
```

Keep the full app route map in `routes.ts` for links and redirects. Inside the mounted installer, use relative routes for the handlers owned by that feature. Params from the mount prefix are available to child handlers, and if the prefix and child route use the same param name, the child route wins.

## Route pattern syntax {#route-pattern-syntax}

The strings you pass to route helpers use `route-pattern` syntax. Most app routes only need path variables, which match within a segment and become typed route params:

```ts
"/albums/:albumId"; // matches /albums/thriller
"/blog/:year-:month-:day/:slug"; // matches /blog/2024-01-15/hello
```

Use wildcards when a route needs to match across multiple segments or capture only part of a segment:

```ts
"/assets/*path"; // matches /assets/images/logo.png
"/downloads/*file.:ext"; // matches /downloads/releases/remix.tar.gz
```

Patterns also support optional groups, search constraints, escaped literals, hostname variables, and full-origin matches. You probably won't need all of that in one route, but the syntax is expressive enough to describe something like a tenant-aware docs preview route:

```ts
"http(s)://(:tenant.)example.com/docs(/v:version)/:category/*slug.:format?preview";
// matches https://acme.example.com/docs/v2/guides/routing/route-maps.html?preview=1
// params: {
//   tenant: "acme",
//   version: "2",
//   category: "guides",
//   slug: "routing/route-maps",
//   format: "html",
// }
```

The [`route-pattern` overview](https://api.remix.run/api/remix/route-pattern/overview/) covers the full grammar and the lower-level `remix/route-pattern/href` and `remix/route-pattern/match` APIs.

When multiple patterns match the same URL, Remix chooses the most specific match. Static segments beat variables, variables beat wildcards, and the earliest difference wins. This means these two routes can sit next to each other without careful ordering:

```ts filename=app/routes.ts
import { get, route } from "remix/routes";

export const routes = route({
  albums: {
    new: get("/albums/new"),
    show: get("/albums/:albumId"),
  },
});
```

`/albums/new` matches `albums.new`, not `albums.show` with `albumId: 'new'`.
