---
title: Testing
description: How to choose a test boundary and test Remix routes, stateful request flows, components, and end-to-end behavior.
---

Remix includes `remix/test`, whose three runner types—`server`, `browser`, and `e2e`—determine how and where a test runs. They do not determine how much application code the test exercises. `remix/assert` provides assertions in all three.

A Remix app already exposes its main test boundary in `app/router.ts`. The router accepts a Web `Request` and returns a Web `Response`, so most request behavior can be tested without starting a server or opening a browser.

This chapter starts at that boundary, then moves outward to browser component tests and full end-to-end flows.

## Choose the narrowest useful test

Choose the smallest boundary that includes the behavior you want to prove:

| Test boundary          | Use it for                                                           | How to test it                                                   | Runner type |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------- |
| Unit test              | A data helper, schema, utility, or other isolated module             | Import it, call it, and assert on the result                     | `server`    |
| Router test            | An action, response, middleware, session, or database-backed request | Send a request through `router.fetch(...)`                       | `server`    |
| Browser component test | A component event, DOM update, or browser API                        | Render the component with `remix/ui/test`'s `render()` helper    | `browser`   |
| End-to-end test        | Navigation or a complete browser/server flow                         | Run the router behind a test server and drive it with Playwright | `e2e`       |

A controller that returns the wrong status belongs in a router test. A submit button that does not enter its pending state belongs in a browser component test. Use an end-to-end test when browser and server behavior must work together, such as submitting a form and following its redirect to the updated page.

## Run tests with remix test

Add a test script to `package.json`:

```json filename=package.json
{
  "scripts": {
    "test": "NODE_ENV=test remix test"
  }
}
```

Then run the suite with:

```sh
npm test
```

By default, the runner maps each runner type to a file pattern and execution model:

| Runner type | File pattern                 | Execution model                          |
| ----------- | ---------------------------- | ---------------------------------------- |
| `server`    | `**/*.test.{ts,tsx}`         | Server-side test worker                  |
| `browser`   | `**/*.test.browser.{ts,tsx}` | Isolated browser frame via Playwright    |
| `e2e`       | `**/*.test.e2e.{ts,tsx}`     | Test worker driving a Playwright browser |

The `server` runner type covers both unit tests and router tests. It describes the execution model, not the test boundary.

All three use the same `describe(...)` and `it(...)` API from `remix/test`. The [`remix/test` overview](https://api.remix.run/api/remix/test/overview/) covers lifecycle hooks, test context, mocks, fake timers, and runner configuration. The [`remix/assert` overview](https://api.remix.run/api/remix/assert/overview/) lists the available assertion functions and `expect(...)` matchers. Both work in every test environment:

```ts filename=app/actions/albums/edit/schema.test.ts
import * as assert from "remix/assert";
import * as s from "remix/data-schema";
import { describe, it } from "remix/test";

import { albumFormSchema } from "./schema.ts";

describe("albumFormSchema", () => {
  it("parses an album edit", () => {
    let formData = new FormData();
    formData.set("artist", "Michael Jackson");
    formData.set("title", "Thriller");
    formData.set("year", "1982");
    formData.set("revision", "0");

    let result = s.parseSafe(albumFormSchema, formData);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.deepEqual(result.value, {
      artist: "Michael Jackson",
      title: "Thriller",
      year: 1982,
      revision: 0,
    });
  });
});
```

Keep a plain module's test beside that module. Route behavior belongs beside its controller, while helpers shared by several tests can live under `test/`:

```txt
app/
└── actions/
    └── albums/
        ├── controller.tsx
        ├── controller.test.ts
        └── edit/
            ├── controller.tsx
            ├── controller.test.ts
            ├── schema.ts
            └── schema.test.ts
test/
└── utils.ts                   # helpers shared by several tests
```

## Test routes with router.fetch

A router test sends the same `Request` that a runtime adapter would send in production. Router, controller, and action middleware run normally, and the test receives the final `Response`. The [`remix/router` overview](https://api.remix.run/api/remix/router/overview/) covers the complete router API, while this chapter uses its Fetch boundary for app tests.

This test exercises the album show route without opening a network socket:

```ts filename=app/actions/albums/controller.test.ts
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../../routes.ts";
import { createTestRouter } from "../../../test/router.ts";

describe("album show", () => {
  it("renders the requested album", async (t) => {
    let app = await createTestRouter();
    t.after(() => app.close());

    let response = await app.router.fetch(
      app.authenticatedRequest(
        routes.albums.show.href({ albumId: "thriller" }),
      ),
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), /Thriller/);
  });
});
```

Build test URLs with the same `routes.<name>.href(...)` helpers used by links, forms, and redirects. The test keeps the route name and params checked against the app's route map, while `authenticatedRequest(...)` supplies the absolute same-origin URL, signed session cookie, and authenticated identity required by this private route.

Mutation tests construct the request body with Web APIs. The album edit action expects `FormData` and returns a redirect:

```ts filename=app/actions/albums/edit/controller.test.ts
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../../../routes.ts";
import { createTestRouter } from "../../../../test/router.ts";

describe("album editing", () => {
  it("redirects to the album after an update", async (t) => {
    let app = await createTestRouter();
    t.after(() => app.close());

    let albumId = "thriller";
    let formData = new FormData();
    formData.set("title", "Thriller");
    formData.set("artist", "Michael Jackson");
    formData.set("year", "1982");
    formData.set("revision", "0");

    let response = await app.router.fetch(
      app.authenticatedRequest(routes.albums.edit.action.href({ albumId }), {
        method: "POST",
        body: formData,
      }),
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      routes.albums.show.href({ albumId }),
    );
  });
});
```

The same `FormData` can carry an upload:

```ts
import { readFile } from "node:fs/promises";

let coverBytes = await readFile(
  new URL("../../../../test/fixtures/cover.png", import.meta.url),
);
let formData = new FormData();
formData.set(
  "cover",
  new File([Uint8Array.from(coverBytes)], "cover.png", { type: "image/png" }),
);
```

Pass that form directly as the request body. Do not set `Content-Type` yourself because `Request` adds the multipart boundary when it serializes the `FormData`.

Use a real, decodable image fixture when the action normalizes uploads. A MIME type and filename do not turn arbitrary bytes into an image, and the decoder should reject fake image data.

Middleware does not need a separate app test harness. Send a request through the router and assert on the middleware's observable result: a rejection status, a response header, a persisted session value, or a context value used by the action. A reusable middleware package may use a small router with one test route, but app middleware should usually run in the same stack as the app's controllers.

## Isolate stateful app tests

The router itself is request-driven, but the values supplied by its middleware may be stateful. Sessions, databases, upload storage, caches, and module-level arrays can all leak changes into the next test.

Stateful tests are easier when `app/router.ts` exports a `createAppRouter(options)` factory in addition to the production `router`. The factory keeps the cumulative middleware and every controller mapping in one place while allowing tests to replace infrastructure.

The options must reach the code that uses them. Change `loadDatabase()` to accept a database, put album-cover storage in request context, and have the edit and cover actions read that storage from context instead of importing the production filesystem singleton. The factory then uses `loadDatabase(options.database)`, `loadAlbumCovers(options.albumCovers)`, `session(options.sessionCookie, options.sessionStorage)`, and the rest of the existing middleware. Passing an option that an action never reads does not isolate anything.

A test helper can now provide memory-backed session and file storage:

```ts filename=test/router.ts
import { createCookie } from "remix/cookie";
import { createMemoryFileStorage } from "remix/file-storage/memory";
import { createSession } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";

import { createAppRouter } from "../app/router.ts";
import { createAlbumFixtureDatabase } from "./database.ts";

const origin = "https://albums.test";

export async function createTestRouter() {
  let database = await createAlbumFixtureDatabase({
    user: {
      id: "user_1",
      email: "michael@example.com",
      password: "test-password",
    },
    album: {
      id: "thriller",
      artist: "Michael Jackson",
      ownerId: "user_1",
      revision: 0,
      title: "Thriller",
      year: 1981,
    },
  });
  let sessionCookie = createCookie("__session", {
    secrets: ["test-only-session-secret-32-characters"],
  });
  let sessionStorage = createMemorySessionStorage();
  let albumCovers = createMemoryFileStorage();
  let router = createAppRouter({
    albumCovers,
    database,
    sessionCookie,
    sessionStorage,
  });

  let session = createSession();
  let csrfToken = crypto.randomUUID();
  session.set("auth", { userId: "user_1" });
  session.set("_csrf", csrfToken);

  let sessionId = await sessionStorage.save(session);
  if (sessionId === null)
    throw new Error("Expected the test session to be saved");

  let cookie = (await sessionCookie.serialize(sessionId)).split(";", 1)[0];

  return {
    albumCovers,
    router,
    authenticatedRequest(path: string, init: RequestInit = {}) {
      let headers = new Headers(init.headers);
      headers.set("Cookie", cookie);
      headers.set("Origin", origin);
      headers.set("X-Csrf-Token", csrfToken);

      return new Request(new URL(path, origin), { ...init, headers });
    },
    async close() {
      await database.close();
    },
  };
}
```

`createAlbumFixtureDatabase()` is an app-owned test helper that opens an isolated database, applies migrations, hashes the fixture password, and inserts the user, artist, and owner-backed album. The returned request helper serializes the signed session cookie, supplies an `Origin` that matches the request URL, and submits the session's CSRF token through one of the header names accepted by `csrf()`. The edit test still includes `revision` in `FormData` because that value belongs to the album mutation, not the request helper.

Create a fresh fixture inside a test when it mutates session, database, or file state. The memory session and file stores need no explicit close; they become collectible with the fixture. `close()` owns the database connection. A suite may share a fixture only when its dependencies are read-only or reset between tests.

A browser manages cookies automatically in an [end-to-end test](#test-complete-flows-end-to-end). To keep a multi-request session flow in a router test, read the cookie from one response and send its name/value pair in the next request:

```ts filename=test/http.ts
import * as assert from "remix/assert";

export function getResponseCookie(response: Response, name: string): string {
  let setCookie = response.headers
    .getSetCookie()
    .find((header) => header.startsWith(`${name}=`));

  assert.ok(setCookie, `Expected a ${name} cookie`);
  return setCookie.split(";", 1)[0];
}
```

```ts
// inside a multi-request test:
let cookie = getResponseCookie(loginResponse, "__session");
let accountResponse = await router.fetch(
  new Request(accountUrl, {
    headers: { Cookie: cookie },
  }),
);
```

Database state needs the same boundary. For SQLite, create a database backed by `:memory:`, apply the app's migrations, and seed only the records the test needs. PostgreSQL and MySQL tests should use a dedicated test database or schema and reset changed rows between tests. Do not point tests at development or production data.

The [`remix/file-storage/memory` overview](https://api.remix.run/api/remix/file-storage/memory/overview/) provides `createMemoryFileStorage()` for upload tests. A fresh temporary directory also works. Register cleanup with `t.after(...)` when a fixture opens a database connection, starts a server, or creates files that outlive the request.

## Test Remix components in the browser

Use a browser component test when the behavior depends on an event, a DOM property, or a component update. These tests run in isolated browser frames rather than a simulated DOM.

Browser and end-to-end tests require Playwright and its browser binaries:

```sh
npm i -D playwright
npx playwright install
```

Consider a small client component that tracks whether an album is a favorite:

```tsx filename=app/assets/favorite-button.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const FavoriteButton = clientEntry(
  import.meta.url,
  function FavoriteButton(handle: Handle<{ albumTitle: string }>) {
    let favorite = false;

    return () => (
      <button
        aria-pressed={favorite}
        mix={on("click", () => {
          favorite = !favorite;
          handle.update();
        })}
        type="button"
      >
        {favorite
          ? `Remove ${handle.props.albumTitle} from favorites`
          : `Add ${handle.props.albumTitle} to favorites`}
      </button>
    );
  },
);
```

`render(...)` from [`remix/ui/test`](https://api.remix.run/api/remix/ui/test/overview/) mounts the component, flushes its initial render, and returns helpers for querying and interacting with the DOM:

```tsx filename=app/assets/favorite-button.test.browser.tsx
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import { FavoriteButton } from "./favorite-button.tsx";

describe("FavoriteButton", () => {
  it("toggles an album as a favorite", async (t) => {
    let { $, act, cleanup } = render(<FavoriteButton albumTitle="Thriller" />);
    t.after(cleanup);

    let button = $("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.getAttribute("aria-pressed"), "false");
    assert.equal(button.textContent, "Add Thriller to favorites");

    await act(() => button.click());

    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.equal(button.textContent, "Remove Thriller from favorites");
  });
});
```

Use `act(...)` around an interaction that may call `handle.update()` or complete asynchronous component work. It flushes pending updates before the next assertion. Registering `cleanup` with `t.after(...)` disposes the component even when an assertion fails.

The button has no request behavior to prove, so this test stays at the browser component boundary.

## Test complete flows end to end

An end-to-end test runs the router behind a real local HTTP server and drives the app through a Playwright `Page`. Use this boundary for a small number of flows where navigation, browser behavior, server rendering, and persistence must work together.

[`createTestServer(...)`](https://api.remix.run/api/remix/node-fetch-server/test/function/createTestServer/) adapts the router to a server on an available local port. [`t.serve(...)`](https://api.remix.run/api/remix/test/interface/TestContext/) gives the Playwright page that server as its base URL and closes both after the test:

```ts filename=app/app.test.e2e.ts
import * as assert from "remix/assert";
import { createTestServer } from "remix/node-fetch-server/test";
import { describe, it } from "remix/test";

import { routes } from "./routes.ts";
import { createTestRouter } from "../test/router.ts";

describe("album editing", () => {
  it("updates an album from the edit page", async (t) => {
    let app = await createTestRouter();
    t.after(() => app.close());

    let page = await t.serve(await createTestServer(app.router.fetch));
    let albumId = "thriller";

    await page.goto(routes.auth.login.index.href());
    await page.getByLabel("Email").fill("michael@example.com");
    await page.getByLabel("Password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto(routes.albums.edit.index.href({ albumId }));
    await page.getByLabel("Year").fill("1982");
    await page.getByRole("button", { name: "Save album" }).click();
    await page.getByRole("heading", { name: "Thriller" }).waitFor();

    assert.equal(
      new URL(page.url()).pathname,
      routes.albums.show.href({ albumId }),
    );
    await page.getByText("Michael Jackson · 1982").waitFor();
  });
});
```

`t.serve(...)` closes the Playwright page and HTTP server after the test. The registered `app.close()` callback closes the fixture database. Memory-backed session and file stores do not hold external resources; a temporary directory or external service would need another `t.after(...)` callback.

Keep validation statuses, redirects, and middleware branches in router tests. One representative end-to-end flow can prove that the form, pending state, POST, redirect, and rendered result work together without repeating every server-side case in Playwright.

## Configure discovery, coverage, and CI

The default discovery rules are enough for the file names used in this chapter. Add `remix-test.config.ts` when the app needs custom browser projects, excluded paths, or global setup. The [`RemixTestConfig` API](https://api.remix.run/api/remix/test/interface/RemixTestConfig/) lists every available field:

```ts filename=remix-test.config.ts
import type { RemixTestConfig } from "remix/test";

export default {
  glob: {
    exclude: ["node_modules/**", "tmp/**"],
  },
  playwrightConfig: {
    projects: [
      { name: "chromium", use: { browserName: "chromium" } },
      { name: "firefox", use: { browserName: "firefox" } },
    ],
  },
} satisfies RemixTestConfig;
```

A `coverage` object enables coverage for every run with that config. Put thresholds in a separate CI config when focused development runs should stay fast:

```ts filename=remix-test.ci.config.ts
import type { RemixTestConfig } from "remix/test";

import config from "./remix-test.config.ts";

export default {
  ...config,
  coverage: {
    dir: ".coverage",
    include: ["app/**/*.{ts,tsx}"],
    exclude: ["app/**/*.test{,.browser,.e2e}.{ts,tsx}"],
    statements: 80,
    lines: 80,
    branches: 70,
    functions: 80,
  },
} satisfies RemixTestConfig;
```

Run that config when CI should enforce the thresholds:

```sh
npm test -- --config remix-test.ci.config.ts
```

For an occasional report without configured thresholds, use `npm test -- --coverage`.

During development, run only the boundary you are changing:

```sh
npm test -- --type server
npm test -- --type browser --project chromium
npm test -- --type e2e --project chromium
npm test -- --watch
```

CI can run the same `npm test` command to cover all configured test types. Install Playwright's system dependencies and browser binaries first when the CI image does not include them:

```sh
npx playwright install --with-deps
npm test -- --config remix-test.ci.config.ts
npm run typecheck
```

Keep type checking as a separate command. The test runner executes TypeScript, but it does not replace the compiler's project-wide checks. The next chapter, [CLI and Tooling](/cli-and-tooling/), covers the `remix test` flags alongside the rest of the Remix command-line workflow.
