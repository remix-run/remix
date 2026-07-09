---
title: Routing and Controllers
description: How route maps, route helpers, controllers, actions, and responses define Remix request handling.
---

In [Chapter 1](/docs/start-here), we built one end-to-end request flow: a Web [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) comes in, Remix matches a route, a controller runs an action, and the app returns a Web [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) containing HTML rendered from a Remix component.

Full-stack Remix apps are built around that route/controller boundary. `app/routes.ts` names URLs and methods your app accepts, controllers in `app/actions/` implement them, and each action returns the response that becomes the page, redirect, JSON payload, file, or error the browser receives.

## Routes as the URL contract

In Remix, routes are defined separately from the actions that handle matched requests. That separation lets server code and browser modules share typed URL helpers without pulling controllers into the browser. You define the URLs and methods your app accepts in `app/routes.ts`.

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

`route(...)` returns a typed route map with the same nested shape as its argument. A leaf like `routes.albums.show` is a route with a method, pattern, and `href(...)` helper. A branch like `routes.albums` or `routes.albums.edit` is another route map.

The router uses those leaves to match requests, and the rest of the app uses them to build typed URLs:

```ts
routes.albums.show.href({ albumId: "thriller" });
// /albums/thriller
```

The `albumId` property is required by the `show` route's `href(...)` helper because `:albumId` is a path variable. Path variables match within a segment and become properties on `context.params` inside controllers. If you later rename the pattern to `'/albums/:id'`, old calls that still pass `{ albumId: ... }` will report TypeScript errors. The same `routes` object can be imported into controllers and browser modules, then used in links, forms, redirects, and tests. URL changes are not hidden in string literals around the app.

Path variables are one part of Remix's route pattern syntax. Patterns can also include wildcards, optional groups, search constraints, escaped literals, hostname variables, full origins, and specificity rules. A single pattern can combine all these features:

```ts
"/docs(/v:version)/:category/*slug.:format?preview";
// matches /docs/v2/guides/routing/route-maps.html?preview=1
```

You do not need to memorize Remix's route pattern syntax to follow this guide. The [`route-pattern` overview](https://api.remix.run/api/remix/route-pattern/overview/) covers the full grammar and the lower-level `remix/route-pattern/href` and `remix/route-pattern/match` APIs.

Finally, the `edit` branch has two leaves at the same URL: `index` handles `GET` and `action` handles `POST`.

```ts
routes.albums.edit.index.href({ albumId: "thriller" }); // GET /albums/thriller/edit
routes.albums.edit.action.href({ albumId: "thriller" }); // POST /albums/thriller/edit
```

This difference between leaves and nested maps matters once we start mapping controllers.

## Route builders: route, get, post, put, del, form, resources {#route-builders}

Route helpers replace `{ method, pattern }` objects with calls that name a route's HTTP method or conventional shape. Each helper produces the same route leaves and route maps we saw above.

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

The helpers cover single-method leaves, nested groups, forms, and conventional resources:

| Helper                                                  | Purpose                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `get`, `post`, `put`, `patch`, `del`, `head`, `options` | One route leaf narrowed to an HTTP method.                        |
| `form(pattern)`                                         | A `GET` page and `POST` action at the same URL.                   |
| `route(prefix, defs)`                                   | A nested route map whose child patterns are relative to a prefix. |
| `resources(pattern)`                                    | Conventional collection routes.                                   |
| `resource(pattern)`                                     | Conventional singleton routes.                                    |

A route can also be defined with just a string. For example, `webhook: "/webhooks/github"` matches any request method, so its action must check `context.method` when the method matters.

When a route area benefits from separate ownership, `route(prefix, routes)` composes its route map under a shared prefix. The route area owns its names and relative patterns, while the app decides where the group lives:

```ts filename=app/actions/albums/routes.ts
import { get, route } from "remix/routes";

export const albumRoutes = route({
  index: get("/"),
  show: get("/:albumId"),
});
```

Compose that route map into the app's URL structure:

```ts filename=app/routes.ts
import { route } from "remix/routes";

import { albumRoutes } from "./actions/albums/routes.ts";

export const routes = route({
  albums: route("/albums", albumRoutes),
});

// routes.albums.index -> GET /albums
// routes.albums.show  -> GET /albums/:albumId
```

`form(...)` creates the common page-plus-submit shape where a page and its action live at the same URL:

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

`resources(...)` creates seven conventional routes for a collection: `index`, `new`, `show`, `create`, `edit`, `update`, and `destroy`. `resource(...)` creates routes for a singleton and omits `index` because there is no collection page.

`only` keeps part of the conventional shape, and `param` changes the path variable name from the default `id`:

```ts filename=app/routes.ts
import { resources, route } from "remix/routes";

export const routes = route({
  albums: resources("/albums", {
    only: ["index", "show", "create"],
    param: "albumId", // default is "id"
  }),
});

// routes.albums.index  -> GET    /albums
// routes.albums.show   -> GET    /albums/:albumId
// routes.albums.create -> POST   /albums
```

These helpers produce ordinary route maps and leaves, so you can nest them with hand-written definitions. Pass a map to `createController(...)`, then register it with `router.map(...)` just as you would a hand-written map. The [`remix/router` overview](https://api.remix.run/api/remix/router/overview/) covers the full route builder API.

## Controllers and actions

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

In actions, `context.method`, `context.headers`, and middleware-provided context values reflect the request after middleware has run. Middleware may have already parsed the body, changed the method, or attached values such as parsed [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and a session. The [Request Handling](/docs/request-handling) chapter covers typed context in more detail.

An action can also be an object with route-specific middleware and a `handler`. This is handy for form submissions: the `action` route can parse `FormData` without adding that middleware to the `index` page.

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

Router middleware runs first, then controller middleware, then action middleware, then the action handler.

## Responses, redirects, headers, and errors

Actions return Web `Response` objects. A text response can be as small as this:

```ts
return new Response("Album not found", { status: 404 });
```

Redirects come from `remix/response/redirect`. After a successful `POST`, `303 See Other` tells the browser to follow up with a `GET` instead of resubmitting the form on refresh.

```ts filename=app/actions/albums/edit/controller.tsx
import { redirect } from "remix/response/redirect";

import { routes } from "../../../routes.ts";

// inside an action:
return redirect(
  routes.albums.show.href({ albumId: context.params.albumId }),
  303,
);
```

For HTML outside the normal render pipeline covered in [Rendering UI](/docs/rendering-ui), `createHtmlResponse` from `remix/response/html` sets the HTML content type and makes sure the response starts with a doctype.

The `html` template tag from `remix/html-template` escapes user-provided values interpolated into an HTML string.

```ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

return createHtmlResponse(html`<p>${album.title}</p>`);
```

Headers and status go in the standard response init object for raw `Response` objects, redirects, and HTML responses.

JSON responses can use the platform [`Response.json(...)`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static) helper:

```ts
return Response.json(album, {
  headers: {
    "Cache-Control": "no-store",
  },
});
```

For expected failures, return a response with the appropriate status: `404` for missing records, `400` for invalid input, `401` for unauthenticated requests, and `403` for authenticated users who still cannot access the route. The [Errors & Error Boundaries](/docs/errors-and-error-boundaries) chapter covers thrown errors, render failures, and error boundaries.

## Nested route maps and ownership

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

## Organizing route-owned code

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

When a route branch has its own nested routes, a matching directory and controller keep the parent controller smaller and make each route owner visible from the file path.

Route-local UI belongs next to the controller that renders it, so the page and form for `albums.edit` belong in `actions/albums/edit/`. Move a component to `ui/` once more than one route uses it. The [Rendering UI](/docs/rendering-ui) chapter covers the component model, and [Files and Assets](/docs/files-and-assets) covers browser-loadable `.browser.ts` and `.browser.tsx` modules.

For larger route areas, `router.mount(...)` lets one module own route registration while `app/router.ts` decides where that module lives. That keeps route groups composable: an admin feature can be mounted at `/admin` in one app, `/internal/admin` in another, or under an org prefix later.

```ts filename=app/router.ts
import { createRouter } from "remix/router";

import { installAdminRoutes } from "./actions/admin/routes.ts";

export const router = createRouter();

router.mount("/admin", installAdminRoutes);
```

The installer receives a route builder. It can register routes under the mount prefix, but it is not a full router and cannot dispatch requests.

```ts filename=app/actions/admin/routes.ts
import type { RouteBuilder } from "remix/router";

export function installAdminRoutes(router: RouteBuilder) {
  router.get("/", () => {
    return new Response("Admin");
  });

  router.get("/users/:userId", ({ params }) => {
    return new Response(`Admin user ${params.userId}`);
  });
}
```

Those handlers match `GET /admin` and `GET /admin/users/:userId`. In a real app, the installer can call `router.map(...)` with feature controllers instead of inline handlers; inline handlers just keep the mount example small.

The full app route map still belongs in `routes.ts` for links and redirects. Mounted installers are for registering the handlers owned by that feature.

Mount prefixes are route patterns, so route params from the prefix are available to child handlers:

```ts filename=app/router.ts
// after creating the router:
router.mount("/orgs/:orgId", (org) => {
  org.get("/users/:userId", ({ params }) => {
    return new Response(`${params.orgId}:${params.userId}`);
  });
});
```

If the prefix and child route use the same param name, the child route wins.
