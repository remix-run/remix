---
title: Routing and Controllers
description: How route maps, route helpers, controllers, actions, and responses define Remix request handling.
---

In [Chapter 1](/start-here/), we built one end-to-end request flow: a Web [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) comes in, Remix matches a route, a controller runs an action, and the app returns a Web [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) containing HTML rendered from a Remix component.

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

The [Forms and Mutations](/forms-and-mutations/) chapter builds on this route shape for validation, redirects, and progressive enhancement.

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

A controller owns request handling for the direct leaves in one route map. It can run middleware shared by those actions, and its `actions` object supplies one handler per leaf. `createController(...)` uses the map to type each action name and its params while keeping request-handling behavior out of the route map.

For `routes.albums`, the controller owns the `show` leaf:

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

The `show` action receives request context and returns a Web `Response`. Because its route is defined as `get('/albums/:albumId')`, `context.params.albumId` is a `string` when the route matches. Remix matches the pattern before the action runs, so the action does not need to parse the URL or guard against a missing `albumId`.

Every action receives these built-in request context properties and methods:

| Property or method        | What it provides                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `context.request`         | The original Web `Request`.                                                                                  |
| `context.url`             | The parsed [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL).                                    |
| `context.method`          | The request method.                                                                                          |
| `context.params`          | Typed values parsed from the matched route pattern.                                                          |
| `context.headers`         | A mutable [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) copy of the request headers. |
| `context.router`          | The router handling the request.                                                                             |
| `context.set(key, value)` | Stores a request-scoped value on the shared context.                                                         |
| `context.get(key)`        | A request-scoped value stored under a context key.                                                           |
| `context.has(key)`        | Whether a value has been stored for a context key.                                                           |

Middleware can extend this base context with typed properties such as `context.formData` or `context.render`. Those properties depend on the app's middleware stack, so they do not form a fixed list. The built-in `methodOverride()` middleware deliberately changes one base value: it updates `context.method` before route matching so a `POST` form with a `_method` field can target a `PUT`, `PATCH`, or `DELETE` route. `context.request.method` remains the original method.

Controllers can have their own middleware that applies to every action it owns. When middleware is needed for only one route, define that action as an object with `middleware` and a `handler`. Here, only the `POST` action parses `FormData`; the `index` page skips that work.

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

Router middleware runs first, then controller middleware, then action middleware, then the action handler. The [Request Handling](/request-handling/) chapter covers middleware scopes and typed context in more detail.

## Responses, redirects, headers, and errors

Actions return Web `Response` objects. To render pages, add the `render()` middleware from `remix/middleware/render` to the router. That middleware provides `context.render(...)`, which turns a Remix component tree into an HTML response. The [Rendering UI](/rendering-ui/) chapter covers it in more detail. Once it is installed, use it in an action:

```tsx filename=app/actions/albums/controller.tsx
// inside the show action:
return context.render(<AlbumPage album={album} />);
```

The result is still an ordinary Web `Response`. An action can render a page, return text or JSON, redirect the browser, send a file, or return an error response.

Expected outcomes such as invalid input, conflicts, and missing records should also return a `Response` with the appropriate status. Reserve thrown errors for unexpected failures. If an action or middleware throws, `router.fetch(...)` rejects so the server boundary can log the error and return a `500` response. The [Errors and Error Boundaries](/errors-and-error-boundaries/) chapter covers that path in detail.

A text response can be as simple as:

```ts
return new Response("Album not found", { status: 404 });
```

`redirect(...)` creates redirect responses. An edit action might use `303 See Other` for a POST-redirect-GET flow:

```ts filename=app/actions/albums/edit/controller.tsx
import { redirect } from "remix/response/redirect";

import { routes } from "../../../routes.ts";

// inside an action:
return redirect(routes.albums.show.href({ albumId: context.params.albumId }), 303);
```

For HTML outside the Remix UI render pipeline, the `html` template tag escapes interpolated values and `createHtmlResponse(...)` sets the HTML content type and adds a doctype:

```ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

// inside an action:
return createHtmlResponse(html`<p>${album.title}</p>`);
```

Remix's `redirect(...)` and `createHtmlResponse(...)`, like `new Response(...)` and [`Response.json(...)`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static), accept a standard `ResponseInit` when you need to set a status or headers. The numeric `303` above is a shorthand supported by `redirect(...)`.

```ts
// inside an action:
return Response.json(album, {
  headers: {
    "Cache-Control": "no-store",
  },
});
```

Note: `context.headers` represents the request headers, not the headers sent with the response. Controllers do not have a separate response-header API because their actions return standard Web responses. Use Web [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) directly, or `remix/headers` when typed accessors for values such as `Cache-Control` and `Set-Cookie` make header handling clearer.

## Mapping controllers

`createController(...)` defines what a controller handles, and `router.map(...)` registers it. Because a controller owns only the direct leaves of its route map, register nested maps separately when they have their own actions:

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

`router.map(...)` is the app-level convention for route maps and controllers. Direct methods such as `router.get(...)` and `router.post(...)` register individual handlers without a controller:

```ts filename=app/router.ts
// after creating the router:
router.get("/health", () => new Response("OK"));
```

Controller middleware follows the same ownership rule. Middleware on `albumsController` runs for `routes.albums.show`, but not for `routes.albums.edit.index` or `routes.albums.edit.action`.

Remix checks this during router setup. If a controller is missing an action for a leaf it owns, setup throws before the app starts serving requests.

## Organizing route-owned code

The file tree typically follows the same shape as the route map:

```txt
app/actions/
├── controller.tsx              # routes
└── albums/
    ├── controller.tsx          # routes.albums
    ├── routes.ts               # albumRoutes
    └── edit/
        ├── controller.tsx      # routes.albums.edit
        └── page.tsx            # route-local UI
```

When a route branch has its own nested routes, a matching directory and controller keep the parent controller smaller and make each route owner visible from the file path.

Keep route-local UI next to the controller that renders it, so the page and form for `albums.edit` belong in `actions/albums/edit/`. Components shared by multiple route areas belong in `ui/`. The [Rendering UI](/rendering-ui/) chapter covers the component model.

With the route map and controllers connected, [Request Handling](/request-handling/) backs up to the server entry and follows the middleware that runs before and after those actions.
