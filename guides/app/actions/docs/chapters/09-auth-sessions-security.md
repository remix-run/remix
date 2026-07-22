---
title: Auth, Sessions, and Security
description: How Remix stores per-browser state, resolves identity, protects routes, and defends browser request boundaries.
---

Our album form now accepts state-changing requests. This chapter adds the layers around those requests: a signed cookie identifies one browser session, session data remembers login state, auth middleware resolves that state to a current user, and the action authorizes the requested album.

We will build those layers in order. A cookie is not a user, authentication is not authorization, and CORS is not a defense against an unauthorized mutation.

## Plain cookies and sessions {#cookies-vs-sessions}

Use `remix/cookie` when the browser may carry one small value directly, such as a theme, locale, or dismissed banner:

```ts filename=app/cookies.ts
import { createCookie } from "remix/cookie";

export const themeCookie = createCookie("theme", {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
});
```

The app parses and serializes that value itself:

```ts
let theme = await themeCookie.parse(context.headers.get("Cookie"));
let setCookie = await themeCookie.serialize("dark");
```

Use `remix/session` when state needs server-managed lifecycle: login records, carts, flash messages, one-browser submission state, or anything where client tampering would be a bug. A session exposes `get`, `set`, `unset`, `flash`, `regenerateId`, and `destroy` while middleware handles its cookie on the response.

Signed cookies prevent modification without the secret. Signing does not encrypt the value. A reader who can inspect the cookie may still see its contents, so do not put passwords, provider secrets, or unnecessary personal data in it.

## Cookie configuration and secret rotation {#cookie-configuration-and-secret-rotation}

Configure the session cookie at startup and fail before serving requests when its secret is missing:

```ts filename=app/session.ts
import { createCookie } from "remix/cookie";

function readSecret(name: string, fallback?: string): string {
  let value = process.env[name]?.trim() || fallback;
  if (!value || new TextEncoder().encode(value).byteLength < 32) {
    throw new Error(`${name} must contain at least 32 UTF-8 bytes`);
  }
  return value;
}

let currentSecret = readSecret(
  "SESSION_SECRET",
  process.env.NODE_ENV === "test"
    ? "test-only-session-secret-32-characters"
    : undefined,
);
let secrets = [currentSecret];
let previousSecret = process.env.PREVIOUS_SESSION_SECRET?.trim();
if (previousSecret) {
  secrets.push(readSecret("PREVIOUS_SESSION_SECRET"));
}

export const sessionCookie = createCookie("__session", {
  secrets,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
});
```

These attributes serve different purposes:

- `httpOnly` keeps browser JavaScript from reading the cookie.
- `sameSite` controls when the browser sends it with cross-site requests.
- `secure` restricts it to HTTPS.
- `path` limits which request paths receive it.
- `maxAge` or `expires` controls browser retention.

For a routine rotation, set the new value as `SESSION_SECRET` and temporarily keep the validated old value as `PREVIOUS_SESSION_SECRET`. New cookies use the first secret while parsing accepts either.

That grace period is wrong for a compromised key: remove a leaked secret immediately and invalidate every session that depended on it. Keeping it would let an attacker continue minting valid cookies. A signing secret should be generated with high entropy, stored outside source control, and never logged.

## Session middleware and storage strategies {#session-storage-strategies}

Pair the cookie with a storage backend and add `session(...)` middleware:

```ts filename=app/session.ts
import { createFsSessionStorage } from "remix/session-storage/fs";

export const sessionStorage = createFsSessionStorage("./var/sessions");
```

```ts filename=app/router.ts
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { csrf } from "remix/middleware/csrf";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { session } from "remix/middleware/session";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type RouterContext } from "remix/router";

import accountController from "./actions/account/controller.tsx";
import controller from "./actions/controller.tsx";
import albumsController from "./actions/albums/controller.tsx";
import albumsEditController from "./actions/albums/edit/controller.tsx";
import authController from "./actions/auth/controller.ts";
import authGoogleController from "./actions/auth/google/controller.ts";
import authLoginController from "./actions/auth/login/controller.tsx";
import { loadAuth } from "./auth.ts";
import { loadAssetEntry } from "./middleware/asset-entry.ts";
import { loadDatabase } from "./middleware/database.ts";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";
import { sessionCookie, sessionStorage } from "./session.ts";

export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    cop(),
    formData(),
    methodOverride(),
    asyncContext(),
    loadDatabase(),
    session(sessionCookie, sessionStorage),
    csrf(),
    loadAuth(),
    loadAssetEntry(),
    render(),
  ],
});

export type AppContext = RouterContext<typeof router>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

router.map(routes, controller);
router.map(routes.albums, albumsController);
router.map(routes.albums.edit, albumsEditController);
router.map(routes.account, accountController);
router.map(routes.auth, authController);
router.map(routes.auth.login, authLoginController);
router.map(routes.auth.google, authGoogleController);
```

This is the cumulative router, not a replacement for the stack from earlier chapters. `staticFiles()` can still short-circuit, and `asyncContext()` still runs before the asset-entry helper calls `getContext()`. Form parsing precedes method override and CSRF, database and session state precede session-backed auth, and every nested route map has its own controller mapping. The sections below fill in the auth-specific files imported here. [Production](/production/#compression-and-streams) adds logging and compression when the deployment policy is defined.

The middleware reads the request cookie, exposes `context.session` and `context.get(Session)`, then saves changes and adds `Set-Cookie` to the returned response.

Choose storage based on the deployment:

| Storage        | Good fit                                        | Important limit                                             |
| -------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Cookie         | Small stateless sessions                        | Size limit and no server-side revocation of a copied cookie |
| Memory         | Tests and local development                     | Lost on restart and unavailable to other processes          |
| Filesystem     | Dedicated persistent directory on one Node host | Does not follow requests across independent hosts           |
| Redis/Memcache | Multiple processes or hosts                     | Requires an external service and expiry policy              |

The cookie still needs signing when session values live in Redis, Memcache, or a filesystem. It protects the session identifier that selects server-side data.

Cookie storage puts the complete session in a signed bearer cookie. `destroy()` can expire the current browser's copy, but a stolen earlier copy remains replayable until its signature is no longer accepted. Use server-side storage with expiry when logout revocation, absolute expiry, or administrative invalidation matters.

Authentication also needs an account record, and album authorization needs an owner. Extend the data-table definitions from [Data and Validation](/data-and-validation/):

```ts filename=app/data/schema.ts
// Add `users` and update `albums` in the existing schema module.
export const users = table({
  name: "users",
  columns: {
    id: c.text().primaryKey(),
    email: c.text().notNull().unique(),
    password_hash: c.text().notNull(),
  },
});

// Update the existing definition in place; do not declare a second albums table.
export const albums = table({
  name: "albums",
  columns: {
    id: c.text().primaryKey(),
    artist_id: c.integer().notNull(),
    title: c.text().notNull(),
    year: c.integer().notNull(),
    revision: c.integer().notNull().default(0),
    owner_id: c.text(),
  },
});
```

Add matching SQL in a new migration. For an existing table, add the nullable owner column, backfill it deliberately, then make it required in a later database-specific migration if every album must have an owner:

```sql filename=db/migrations/20260722130000_add_album_owners/up.sql
create table users (
  id text primary key,
  email text not null unique,
  password_hash text not null
);

alter table albums add column owner_id text references users(id);
create index albums_owner_id_index on albums(owner_id);
```

Store only a password hash produced by an established password-hashing library. The account creation and password-change paths own strength policy and hash upgrades.

## Define and map the auth routes {#auth-routes-and-controllers}

Add the account page, credentials form, logout action, and Google redirect pair to the route contract before writing their controllers:

```ts filename=app/routes.ts
import { del, form, get, post, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: "/",
  albums: {
    show: get("/albums/:albumId"),
    recommendations: get("/albums/:albumId/recommendations"),
    edit: form("/albums/:albumId/edit"),
    destroy: del("/albums/:albumId"),
  },
  account: {
    index: get("/account"),
  },
  auth: {
    login: form("/login"),
    logout: post("/logout"),
    google: {
      login: get("/login/google"),
      callback: get("/auth/google/callback"),
    },
  },
});
```

`routes.auth` directly owns `logout`. The credentials GET and POST belong to `routes.auth.login`, while the two Google GET routes belong to `routes.auth.google`. The cumulative `app/router.ts` above maps all three route maps separately, along with `routes.account` and the two album route maps. Controller middleware on one of those mappings does not protect another.

## Session values, flash data, rotation, and destruction {#flash-messages}

Read and update the session inside an action:

```ts
import { Session } from "remix/session";

let session = context.get(Session);

let returnTo = session.get("returnTo");
session.set("cartId", "cart_123");
session.unset("returnTo");
session.flash("message", "Album saved.");
```

A flash value becomes available on the next request and is removed after it is read. This fits a POST-redirect-GET success message without putting it in the URL.

Rotate the session ID after login and any other privilege change. `completeAuth(context)` does this for successful authentication. With the server-side storage used here, `session.regenerateId(true)` rotates it directly and deletes the old record when the session is saved.

On logout, destroy the session rather than only removing `auth`:

```ts filename=app/actions/auth/controller.ts
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import { Session } from "remix/session";

import { routes } from "../../routes.ts";

export default createController(routes.auth, {
  actions: {
    logout(context) {
      context.get(Session).destroy();
      return redirect(routes.home.href(), 303);
    },
  },
});
```

With server-side storage, destruction clears the stored record and expires the browser's session ID on the response. If the app intentionally preserves non-auth session values through logout, remove the auth record and regenerate the ID instead, then document which values survive.

## Credentials login and logout {#credentials-auth}

Create a credentials provider once at module scope. Its `parse` step reads the request boundary, and `verify` checks the submitted credentials against the app's account store:

```ts filename=app/auth.ts
import { createCredentialsAuthProvider } from "remix/auth";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { Database } from "remix/data-table";

import { users } from "./data/schema.ts";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./data/passwords.ts";

const loginSchema = f.object({
  email: f.field(s.string()),
  password: f.field(s.string()),
});

export const passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let result = s.parseSafe(loginSchema, context.formData);
    if (!result.success) return { email: "", password: "" };

    return {
      email: result.value.email.trim().toLowerCase(),
      password: result.value.password,
    };
  },
  async verify({ email, password }, context) {
    let user = email
      ? await context.get(Database).findOne(users, { where: { email } })
      : null;
    let passwordHash = user?.password_hash ?? DUMMY_PASSWORD_HASH;
    let passwordMatches = await verifyPassword(password, passwordHash);

    if (user === null || !passwordMatches) return null;

    return user;
  },
});
```

The login controller owns both leaves created by `form("/login")`. Its GET action reads the one-request error and renders a CSRF token. Its POST action verifies the credentials, rotates the session, and writes the small auth record later requests will resolve:

```tsx filename=app/actions/auth/login/controller.tsx
import { completeAuth, verifyCredentials } from "remix/auth";
import { getCsrfToken } from "remix/middleware/csrf";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import { Session } from "remix/session";

import { passwordProvider } from "../../../auth.ts";
import { routes } from "../../../routes.ts";
import { LoginPage } from "./page.tsx";

function safeReturnTo(value: string | null): string {
  let fallback = routes.account.index.href();
  if (
    value === null ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  let base = new URL("https://app.invalid");
  let target = new URL(value, base);
  if (target.origin !== base.origin) return fallback;

  return target.pathname + target.search + target.hash;
}

export default createController(routes.auth.login, {
  actions: {
    index(context) {
      let session = context.get(Session);
      let returnTo = safeReturnTo(context.url.searchParams.get("returnTo"));

      return context.render(
        <LoginPage
          csrfToken={getCsrfToken(context)}
          error={session.get("loginError")}
          returnTo={returnTo}
        />,
      );
    },
    async action(context) {
      let returnTo = safeReturnTo(
        String(context.formData.get("returnTo") ?? ""),
      );
      let user = await verifyCredentials(passwordProvider, context);

      if (user === null) {
        context.get(Session).flash("loginError", "Invalid email or password");
        let search = new URLSearchParams({ returnTo });
        return redirect(`${routes.auth.login.index.href()}?${search}`, 303);
      }

      let session = completeAuth(context);
      session.set("auth", { userId: user.id });

      return redirect(returnTo, 303);
    },
  },
});
```

`LoginPage` submits to `routes.auth.login.action`, includes hidden `_csrf` and `returnTo` fields, and never repopulates the password after a failed attempt. The redirect target is reduced to an app-owned path before it is rendered or used, so an attacker cannot turn login into an open redirect.

Use the same public error for malformed input, an unknown email, and a wrong password. A fixed dummy hash with the same algorithm and cost prevents an unknown email from skipping the expensive verification step. Password strength policy belongs at enrollment and password change, not at login where it could reject a valid legacy credential. Add per-account and per-source throttling and monitoring for online guessing.

Logout should be a state-changing POST action, not a GET link. Destroy the session and redirect to a public route.

Render logout as a form and include the same synchronizer token as every other state-changing form:

```tsx
// Inside server-rendered navigation; pass csrfToken from getCsrfToken(context).
<form action={routes.auth.logout.href()} method="post">
  <input name="_csrf" type="hidden" value={csrfToken} />
  <button type="submit">Log out</button>
</form>
```

## OAuth and OIDC login {#oauth-and-oidc-providers}

External login uses two routes: one starts the provider redirect, and one handles the callback. Create the provider once so configuration is validated at startup and its callback URL stays stable:

```ts filename=app/auth.ts
import { createGoogleAuthProvider } from "remix/auth";

import { routes } from "./routes.ts";

// Add to the existing auth module.
function requiredEnv(name: string): string {
  let value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

let appOrigin = new URL(requiredEnv("APP_ORIGIN"));
if (appOrigin.pathname !== "/" || appOrigin.search || appOrigin.hash) {
  throw new Error("APP_ORIGIN must contain only an origin");
}
if (process.env.NODE_ENV === "production" && appOrigin.protocol !== "https:") {
  throw new Error("APP_ORIGIN must use HTTPS in production");
}

export const googleProvider = createGoogleAuthProvider({
  clientId: requiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
  redirectUri: new URL(routes.auth.google.callback.href(), appOrigin),
  authorizationParams: {
    access_type: "offline",
    prompt: "consent",
  },
});
```

Compose the protocol helpers in the controller:

```ts filename=app/actions/auth/google/controller.ts
import {
  completeAuth,
  finishExternalAuth,
  startExternalAuth,
} from "remix/auth";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { googleProvider } from "../../../auth.ts";
import {
  findOrCreateExternalAccount,
  saveProviderTokens,
} from "../../../data/auth-accounts.ts";
import { routes } from "../../../routes.ts";

export default createController(routes.auth.google, {
  actions: {
    async login(context) {
      return startExternalAuth(googleProvider, context, {
        returnTo: context.url.searchParams.get("returnTo"),
      });
    },

    async callback(context) {
      let { result, returnTo } = await finishExternalAuth(
        googleProvider,
        context,
      );
      let user = await findOrCreateExternalAccount(
        result.account,
        result.profile,
      );
      await saveProviderTokens(user.id, result.tokens);

      let session = completeAuth(context);
      session.set("auth", { userId: user.id });

      return redirect(returnTo ?? routes.account.index.href(), 303);
    },
  },
});
```

`startExternalAuth()` sanitizes `returnTo` before storing it, dropping absolute, protocol-relative, and backslash-normalized cross-origin values. Apply the same app-owned relative-path rule to any custom redirect path outside that helper.

Google, Microsoft, Okta, Auth0, GitHub, Facebook, X, and Atmosphere have built-in providers. Use `createOIDCAuthProvider()` for another OpenID Connect provider. Key the external account by `result.account.provider` and `providerAccountId`, not by an unverified profile email. Link to an existing local account only through an explicit authenticated or provider-verified flow. Store provider tokens server-side only when the app needs them, encrypt or tightly restrict them at rest, never put them in a cookie session or log, and refresh an expired bundle with `refreshExternalAuth(provider, tokens)`.

## Resolve request identity with auth middleware {#request-auth-schemes}

Login writes `{ userId }` into the session. On later requests, `auth(...)` turns that record into a current user:

```ts filename=app/auth.ts
import { auth, createSessionAuthScheme } from "remix/middleware/auth";
import { Database } from "remix/data-table";

import { users } from "./data/schema.ts";

// Add to the existing auth module.
interface SessionAuthRecord {
  userId: string;
}

function isSessionAuthRecord(value: unknown): value is SessionAuthRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string"
  );
}

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme({
        read(session) {
          let value: unknown = session.get("auth");
          if (value === undefined || value === null) return null;
          if (isSessionAuthRecord(value)) return value;

          session.unset("auth");
          return null;
        },
        async verify(value, context) {
          return context.get(Database).find(users, value.userId);
        },
        invalidate(session) {
          session.unset("auth");
        },
      }),
    ],
  });
}
```

Put `session(...)` and database middleware before `loadAuth()`. The middleware stores either `{ ok: true, identity, method }` or `{ ok: false, error? }` in `context.auth` and `context.get(Auth)`.

Schemes run in order. The first success or failure stops evaluation; only `null` or `undefined` falls through to the next scheme. Remix includes session, bearer-token, and API-key schemes, and an app may supply a custom scheme for trusted infrastructure. A scheme should return no result when its credential source is absent and a failure when a supplied credential is invalid.

## Protect routes with requireAuth {#route-protection-with-requireauth}

Build the app's browser failure behavior once, then reuse that exact middleware on every protected controller:

```ts filename=app/middleware/require-user.ts
import type { TableRow } from "remix/data-table";
import { requireAuth } from "remix/middleware/auth";
import { redirect } from "remix/response/redirect";

import { users } from "../data/schema.ts";
import { routes } from "../routes.ts";

type User = TableRow<typeof users>;

export const requireUser = requireAuth<User>({
  onFailure(context) {
    if (context.headers.get("X-Remix-Frame") === "true") {
      return new Response("Authentication required", {
        status: 401,
        headers: {
          "X-Login-Location": routes.auth.login.index.href(),
        },
      });
    }

    let returnTo = encodeURIComponent(
      context.url.pathname + context.url.search,
    );
    return redirect(
      `${routes.auth.login.index.href()}?returnTo=${returnTo}`,
      303,
    );
  },
});
```

The account controller can now apply it to all of its direct actions:

```tsx filename=app/actions/account/controller.tsx
import { createController } from "remix/router";

import { requireUser } from "../../middleware/require-user.ts";
import { routes } from "../../routes.ts";
import { AccountPage } from "./page.tsx";

export default createController(routes.account, {
  middleware: [requireUser],
  actions: {
    index(context) {
      return context.render(<AccountPage user={context.auth.identity} />);
    },
  },
});
```

The default failure is `401 Unauthorized`. Customize it for the caller: a browser page may redirect to login, an API may return JSON and a `WWW-Authenticate` challenge, and a frame request should return `401` so the browser frame resolver can perform a top-level login navigation instead of embedding a followed login redirect.

Controller middleware applies only to that controller's direct actions. Add protection to every separately mapped nested controller that needs it.

The album mutation from the previous chapter lives in its own nested controller, so protect it explicitly:

```tsx filename=app/actions/albums/edit/controller.tsx
import { requireUser } from "../../../middleware/require-user.ts";

// Add alongside `actions` in the existing createController(...) options.
middleware: [requireUser],
```

The album controller is a separate mapping. Protect it too; the private cover leaf added in the next chapter belongs to this controller and does not inherit middleware from `routes.albums.edit`:

```tsx filename=app/actions/albums/controller.tsx
import { requireUser } from "../../middleware/require-user.ts";

// Add alongside `actions` in the existing createController(...) options.
middleware: [requireUser],
```

This makes the current album page private as well. If the product needs a public album page and a private cover, move the cover into its own nested route map and put `requireUser` on that controller instead. Do not remove protection from the cover merely to keep `show` public.

## Authorize each resource operation {#authorization-checks}

`requireAuth()` proves the request has an identity. It does not prove that identity may update this album.

Check the record inside the action or data write:

```ts
let album = await db.find(albums, context.params.albumId);

if (album === null) {
  return new Response("Album not found", { status: 404 });
}

if (album.owner_id !== context.auth.identity.id) {
  return new Response("Forbidden", { status: 403 });
}

let { revision, title, year } = result.value;
let write = await db.updateMany(
  albums,
  { title, year, revision: revision + 1 },
  {
    where: {
      id: album.id,
      owner_id: context.auth.identity.id,
      revision,
    },
  },
);

if (write.affectedRows === 0) {
  return new Response("Album changed before it could be saved", {
    status: 409,
  });
}
```

Authorization may depend on ownership, role, tenant, record state, or the requested transition. The conditional write repeats the ownership predicate so a concurrent ownership change cannot turn a previously authorized read into an unscoped update. Put this read/check/write sequence in an appropriately isolated transaction or a data-layer function when the policy spans several statements.

Choose intentionally between `403` and a `404` that conceals whether a private record exists. Do not include internal IDs or policy details in a public failure body.

## CSRF synchronizer tokens {#csrf-protection}

Cookie-authenticated browsers send cookies automatically, including on requests initiated by another site in cases allowed by cookie policy. A state-changing form needs a deliberate cross-site request defense.

`csrf()` stores a synchronizer token in the session and validates unsafe requests. Order the middleware so form fields and the session are available first:

```ts filename=app/router.ts
// Relevant positions in the existing cumulative middleware array:
formData(),
asyncContext(),
loadDatabase(),
session(sessionCookie, sessionStorage),
csrf(),
loadAuth(),
```

Render the token into each state-changing form:

```tsx
import { getCsrfToken } from "remix/middleware/csrf";

let csrfToken = getCsrfToken(context);

return context.render(
  <form action={routes.albums.edit.action.href({ albumId })} method="post">
    <input name="_csrf" type="hidden" value={csrfToken} />
    {/* fields */}
  </form>,
);
```

By default, the middleware checks CSRF headers first, then `_csrf` in `FormData`, then the query string. Prefer a header or hidden field; query tokens are more likely to appear in logs and copied URLs.

Unsafe requests also receive same-origin checks when `Origin` or `Referer` is present. Missing provenance headers are allowed by default, so set `allowMissingOrigin: false` only when the deployment can require them from every legitimate unsafe caller.

## Tokenless cross-origin protection {#cross-origin-protection}

`cop()` rejects unsafe cross-origin browser requests using `Sec-Fetch-Site` and `Origin` without storing a token:

```ts filename=app/router.ts
// Relevant positions in the existing cumulative middleware array:
staticFiles("./public", { index: false }),
cop(),
formData(),
```

This lighter model fits deployments that can rely on modern browser provenance signals and same-origin request handling. If both headers are missing, `cop()` allows the request, so it is not the conservative choice for every session-backed form workflow.

The cumulative router layers both middlewares: `cop()` rejects obvious cross-origin requests early, while `csrf()` still requires the synchronizer token after form and session parsing. To use the lighter model alone, remove only `csrf()` and keep the rest of the cumulative stack. Trusted origins and insecure bypass patterns weaken the boundary, so scope them to exact callers or webhook routes and review them as security exceptions.

## CORS is not authentication or CSRF protection {#cors}

CORS tells browsers which origins may read a cross-origin response. Add it only to endpoints that need cross-origin browser access:

```ts
import { cors } from "remix/middleware/cors";
import { createRouter } from "remix/router";

// `loadBearerAuth()` is the separate API's bearer-auth middleware.
export const apiRouter = createRouter({
  middleware: [
    cors({
      origin: ["https://app.example.com", "https://admin.example.com"],
      methods: ["GET", "POST", "PATCH"],
      allowedHeaders: ["Authorization", "Content-Type"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 600,
    }),
    loadBearerAuth(),
  ],
});
```

This separate API uses bearer authentication rather than the guide's `SameSite=Lax` cookie. The middleware answers preflight `OPTIONS` requests and adds the corresponding response headers. Exact origins are easier to reason about than reflecting every caller.

CORS does not authenticate a request, authorize an album, or stop a script, server, or command-line client from sending HTTP traffic. A disallowed simple cross-origin request may still execute; the browser only withholds response access. Keep auth and authorization on the operation itself. If a product instead requires cross-origin cookie auth, it needs `SameSite=None; Secure`, exact credentialed CORS origins, and matching CSRF/COP trusted-origin policy.

With the browser boundary protected, [Files and Assets](/files-and-assets/) applies the same trust-boundary thinking to browser source, uploaded files, storage keys, and downloads.
