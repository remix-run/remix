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
  sameSite: "Lax",
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
  sameSite: "Lax",
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

Keep the generated session files out of source control:

```gitignore filename=.gitignore
/var/sessions/
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
    password_hash: c.text().nullable(),
  },
});

export const authAccounts = table({
  name: "auth_accounts",
  columns: {
    id: c.text().primaryKey(),
    user_id: c
      .text()
      .notNull()
      .references("users", "id", "auth_accounts_user_id_fk")
      .onDelete("cascade"),
    provider: c.text().notNull(),
    provider_account_id: c.text().notNull(),
    tokens_ciphertext: c.text().nullable(),
    tokens_iv: c.text().nullable(),
  },
});

// Update the existing definition in place; do not declare a second albums table.
export const albums = table({
  name: "albums",
  columns: {
    id: c.text().primaryKey(),
    artist_id: c
      .integer()
      .notNull()
      .references("artists", "id", "albums_artist_id_fk"),
    title: c.text().notNull(),
    year: c.integer().notNull(),
    revision: c.integer().notNull().default(0),
    owner_id: c
      .text()
      .nullable()
      .references("users", "id", "albums_owner_id_fk"),
  },
});
```

Add matching SQL in a new migration. For an existing table, add the nullable owner column, backfill it deliberately, then make it required in a later database-specific migration if every album must have an owner:

```sql filename=db/migrations/20260722130000_add_auth_and_album_owners/up.sql
create table users (
  id text primary key,
  email text not null unique,
  password_hash text
);

create table auth_accounts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  tokens_ciphertext text,
  tokens_iv text,
  unique (provider, provider_account_id)
);

create index auth_accounts_user_id_index on auth_accounts(user_id);

alter table albums add column owner_id text references users(id);
create index albums_owner_id_index on albums(owner_id);
```

This migration can be reversed, so add its `down.sql` beside `up.sql`:

```sql filename=db/migrations/20260722130000_add_auth_and_album_owners/down.sql
drop index if exists albums_owner_id_index;
alter table albums drop column owner_id;

drop index if exists auth_accounts_user_id_index;
drop table if exists auth_accounts;
drop table if exists users;
```

`password_hash` is nullable because an account created by Google may not have a local password. A local account must receive a hash before credentials login is enabled for it. The account creation and password-change paths own strength policy and hash upgrades.

The composite unique constraint identifies an external account by provider and provider-issued account ID. A profile email can help choose the local user during a verified linking flow, but it never replaces that stable key.

Before adding a development account, put password hashing behind one module. Node's `scrypt` implementation gives us a random salt and a timing-safe comparison without storing a password:

```ts filename=app/data/passwords.ts
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export const DUMMY_PASSWORD_HASH =
  "scrypt:64:72656d69782d67756964652d64756d6d79:6956e00e648db6a69cbbb90c617a95af5c6ffb36be05ee439e481cb59fc7781041767df0ce5c9720a8d1377a237d64938dd5e0ed8f4d162ade11fd0b019accae";

export async function hashPassword(password: string): Promise<string> {
  let salt = randomBytes(16).toString("hex");
  let derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt:${keyLength}:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  let [algorithm, length, salt, expectedValue] = storedHash.split(":");
  if (
    algorithm !== "scrypt" ||
    length !== String(keyLength) ||
    !salt ||
    !expectedValue
  ) {
    return false;
  }

  let expected = Buffer.from(expectedValue, "hex");
  let actual = (await scrypt(password, salt, keyLength)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
```

Now replace the development seed from the previous chapter. This version creates a local demo account and assigns the existing album only when it does not have an owner yet:

```ts filename=app/data/seed.ts
import { albums, artists, users } from "./schema.ts";
import { db } from "./database.ts";
import { hashPassword } from "./passwords.ts";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to install development seed data in production");
}

const demoUserId = "demo-user";
let demoPasswordHash = await hashPassword("albums-demo-only");

await db.transaction(async (transaction) => {
  let user = await transaction.find(users, demoUserId);
  if (user === null) {
    await transaction.create(users, {
      id: demoUserId,
      email: "demo@example.com",
      password_hash: demoPasswordHash,
    });
  }

  let album = await transaction.find(albums, "thriller");
  if (album !== null) {
    if (album.owner_id === null) {
      await transaction.update(albums, album.id, { owner_id: demoUserId });
    }
    return;
  }

  await transaction
    .query(artists)
    .upsert({ name: "Michael Jackson" }, { conflictTarget: ["name"] });
  let artist = await transaction.findOne(artists, {
    where: { name: "Michael Jackson" },
  });
  if (artist === null) {
    throw new Error("Seeded artist could not be loaded");
  }

  await transaction.create(albums, {
    id: "thriller",
    artist_id: artist.id,
    owner_id: demoUserId,
    title: "Thriller",
    year: 1982,
  });
});
```

Apply the new migration and rerun the seed:

```sh
node --import remix/node-tsx app/data/migrate.ts
node --import remix/node-tsx app/data/seed.ts
```

The local walkthrough account is `demo@example.com` with password `albums-demo-only`. The production guard prevents this fixed credential from being installed by a production seed run; a real account enrollment flow must hash a user-chosen password instead.

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
      let loginError = session.get("loginError");

      return context.render(
        <LoginPage
          csrfToken={getCsrfToken(context)}
          error={typeof loginError === "string" ? loginError : undefined}
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

Now add the page imported by the controller:

```tsx filename=app/actions/auth/login/page.tsx
import type { Handle } from "remix/ui";

import { routes } from "../../../routes.ts";
import { Document } from "../../../ui/document.tsx";

interface LoginPageProps {
  csrfToken: string;
  error?: string;
  returnTo: string;
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { csrfToken, error, returnTo } = handle.props;

    return (
      <Document title="Sign in — Albums">
        <main>
          <h1>Sign in</h1>
          {error ? <p role="alert">{error}</p> : null}
          <form action={routes.auth.login.action.href()} method="post">
            <input name="_csrf" type="hidden" value={csrfToken} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <label>
              Email
              <input autoComplete="email" name="email" type="email" required />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                name="password"
                type="password"
                required
              />
            </label>
            <button type="submit">Sign in</button>
          </form>
        </main>
      </Document>
    );
  };
}
```

The form submits to `routes.auth.login.action` and carries the CSRF token and sanitized `returnTo` value from the GET action. It never receives a password prop, so a failed attempt cannot put the password back into the returned HTML.

The redirect target is reduced to an app-owned path before it is rendered or used. An attacker cannot turn this login form into an open redirect.

Use the same public error for malformed input, an unknown email, and a wrong password. The fixed dummy hash uses the same algorithm and cost as a real password, so an unknown email does not skip the expensive verification step.

Password strength policy belongs at enrollment and password change, not at login where it could reject a valid legacy credential. Add per-account and per-source throttling and monitoring for online guessing.

Logout should be a state-changing POST action, not a GET link. Destroy the session and redirect to a public route.

The protected account page below renders logout as a form and includes the same synchronizer token as every other state-changing form.

## OAuth and OIDC login {#oauth-and-oidc-providers}

External login uses two routes: one starts the provider redirect, and one handles the callback. Create the provider once so configuration is validated at startup and its callback URL stays stable:

```ts filename=app/auth.ts
import { createGoogleAuthProvider } from "remix/auth";

import { routes } from "./routes.ts";

// Add to the existing auth module.
function requiredEnv(name: string, testValue?: string): string {
  let value =
    process.env[name]?.trim() ||
    (process.env.NODE_ENV === "test" ? testValue : undefined);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

let appOrigin = new URL(requiredEnv("APP_ORIGIN", "https://albums.test"));
if (appOrigin.pathname !== "/" || appOrigin.search || appOrigin.hash) {
  throw new Error("APP_ORIGIN must contain only an origin");
}
if (process.env.NODE_ENV === "production" && appOrigin.protocol !== "https:") {
  throw new Error("APP_ORIGIN must use HTTPS in production");
}

export const googleProvider = createGoogleAuthProvider({
  clientId: requiredEnv("GOOGLE_CLIENT_ID", "test-google-client-id"),
  clientSecret: requiredEnv(
    "GOOGLE_CLIENT_SECRET",
    "test-google-client-secret",
  ),
  redirectUri: new URL(routes.auth.google.callback.href(), appOrigin),
  authorizationParams: {
    access_type: "offline",
    prompt: "consent",
  },
});
```

The fixed values are available only when `NODE_ENV=test`. The test router imports this module even when a test never visits the Google routes, so it still needs valid provider configuration.

Development and production fail at startup until all three settings are present. Test the provider exchange against a stubbed provider or HTTP boundary rather than sending these placeholder credentials to Google.

The callback needs the `auth-accounts.ts` module imported below. It resolves a provider identity through the request-scoped database, then encrypts any tokens the app keeps. Generate a separate 32-byte key and store its base64 output as `OAUTH_TOKEN_ENCRYPTION_KEY`:

```sh
openssl rand -base64 32
```

```ts filename=app/data/auth-accounts.ts
import { Buffer } from "node:buffer";
import type {
  GoogleAuthProfile,
  OAuthAccount,
  OAuthStandardTokens,
} from "remix/auth";
import type { Database, TableRow } from "remix/data-table";

import { authAccounts, users } from "./schema.ts";

type AuthAccount = TableRow<typeof authAccounts>;
type User = TableRow<typeof users>;

interface ResolvedExternalAccount {
  authAccount: AuthAccount;
  user: User;
}

const testTokenKey = "dGVzdC1vbmx5LW9hdXRoLXRva2VuLWtleS0zMmJ5dGU=";
const tokenKey = createTokenKey();

export async function findOrCreateExternalAccount(
  database: Database,
  account: OAuthAccount<"google">,
  profile: GoogleAuthProfile,
): Promise<ResolvedExternalAccount | null> {
  return database.transaction(
    async (transaction) => {
      let existingAccount = await transaction.findOne(authAccounts, {
        where: {
          provider: account.provider,
          provider_account_id: account.providerAccountId,
        },
      });
      if (existingAccount !== null) {
        let user = await transaction.find(users, existingAccount.user_id);
        if (user === null) throw new Error("External account has no user");
        return { authAccount: existingAccount, user };
      }

      let email = readVerifiedEmail(profile);
      if (email === null) return null;

      await transaction.query(users).upsert(
        {
          id: crypto.randomUUID(),
          email,
          password_hash: null,
        },
        { conflictTarget: ["email"], update: {} },
      );
      let user = await transaction.findOne(users, { where: { email } });
      if (user === null) throw new Error("Upserted user could not be loaded");

      await transaction.query(authAccounts).upsert(
        {
          id: crypto.randomUUID(),
          user_id: user.id,
          provider: account.provider,
          provider_account_id: account.providerAccountId,
          tokens_ciphertext: null,
          tokens_iv: null,
        },
        {
          conflictTarget: ["provider", "provider_account_id"],
          update: {},
        },
      );
      let authAccount = await transaction.findOne(authAccounts, {
        where: {
          provider: account.provider,
          provider_account_id: account.providerAccountId,
        },
      });
      if (authAccount === null) {
        throw new Error("Upserted external account could not be loaded");
      }

      let linkedUser = await transaction.find(users, authAccount.user_id);
      if (linkedUser === null) throw new Error("External account has no user");

      return { authAccount, user: linkedUser };
    },
    { isolationLevel: "serializable" },
  );
}

export async function saveProviderTokens(
  database: Database,
  authAccount: AuthAccount,
  tokens: OAuthStandardTokens,
): Promise<void> {
  let encrypted = await encryptTokens(authAccount, tokens);
  let write = await database.updateMany(
    authAccounts,
    {
      tokens_ciphertext: encrypted.ciphertext,
      tokens_iv: encrypted.iv,
    },
    {
      where: {
        id: authAccount.id,
        provider: authAccount.provider,
        provider_account_id: authAccount.provider_account_id,
        user_id: authAccount.user_id,
      },
    },
  );
  if (write.affectedRows === 0) {
    throw new Error("External account changed before tokens were saved");
  }
}

export async function loadProviderTokens(
  authAccount: AuthAccount,
): Promise<OAuthStandardTokens | null> {
  if (
    authAccount.tokens_ciphertext === null &&
    authAccount.tokens_iv === null
  ) {
    return null;
  }
  if (
    authAccount.tokens_ciphertext === null ||
    authAccount.tokens_iv === null
  ) {
    throw new Error("External account has incomplete token storage");
  }

  let iv = new Uint8Array(Buffer.from(authAccount.tokens_iv, "base64"));
  if (iv.byteLength !== 12) throw new Error("Invalid OAuth token IV");

  let plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: accountBinding(authAccount),
    },
    await tokenKey,
    toArrayBuffer(
      new Uint8Array(Buffer.from(authAccount.tokens_ciphertext, "base64")),
    ),
  );

  return parseStoredTokens(
    JSON.parse(new TextDecoder().decode(plaintext)) as unknown,
  );
}

function readVerifiedEmail(profile: GoogleAuthProfile): string | null {
  if (profile.email_verified !== true || typeof profile.email !== "string") {
    return null;
  }

  let email = profile.email.trim().toLowerCase();
  return email === "" ? null : email;
}

async function encryptTokens(
  authAccount: AuthAccount,
  tokens: OAuthStandardTokens,
): Promise<{ ciphertext: string; iv: string }> {
  let iv = crypto.getRandomValues(new Uint8Array(12));
  let plaintext = new TextEncoder().encode(
    JSON.stringify({
      ...tokens,
      expiresAt: tokens.expiresAt?.toISOString(),
    }),
  );
  let ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: accountBinding(authAccount),
    },
    await tokenKey,
    toArrayBuffer(plaintext),
  );

  return {
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

function accountBinding(authAccount: AuthAccount): ArrayBuffer {
  return toArrayBuffer(
    new TextEncoder().encode(
      `${authAccount.provider}\0${authAccount.provider_account_id}\0${authAccount.user_id}`,
    ),
  );
}

function createTokenKey(): Promise<CryptoKey> {
  let encoded =
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim() ||
    (process.env.NODE_ENV === "test" ? testTokenKey : undefined);
  if (!encoded) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is required");
  }

  let bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength !== 32) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new Uint8Array(bytes)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function parseStoredTokens(value: unknown): OAuthStandardTokens {
  if (
    typeof value !== "object" ||
    value === null ||
    !("accessToken" in value) ||
    typeof value.accessToken !== "string"
  ) {
    throw new Error("Invalid encrypted OAuth token record");
  }

  let record = value as Record<string, unknown>;
  let tokens: OAuthStandardTokens = { accessToken: value.accessToken };
  let refreshToken = optionalString(record, "refreshToken");
  let idToken = optionalString(record, "idToken");
  let tokenType = optionalString(record, "tokenType");
  if (refreshToken !== undefined) tokens.refreshToken = refreshToken;
  if (idToken !== undefined) tokens.idToken = idToken;
  if (tokenType !== undefined) tokens.tokenType = tokenType;

  if (record.expiresAt !== undefined) {
    if (typeof record.expiresAt !== "string") {
      throw new Error("Invalid encrypted OAuth token record");
    }
    let expiresAt = new Date(record.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error("Invalid encrypted OAuth token record");
    }
    tokens.expiresAt = expiresAt;
  }

  if (record.scope !== undefined) {
    if (
      !Array.isArray(record.scope) ||
      !record.scope.every((scope) => typeof scope === "string")
    ) {
      throw new Error("Invalid encrypted OAuth token record");
    }
    tokens.scope = record.scope;
  }

  return tokens;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  let value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error("Invalid encrypted OAuth token record");
  }
  return value;
}
```

This walkthrough links a new Google identity to a local user only when Google marks the email as verified. Both upserts make conflicts no-ops, so a racing callback cannot replace an existing password hash or move a provider identity to another user. An app with a stricter account-linking policy should reject an existing email here and require the person to sign in locally before attaching the provider account.

The test-only key is accepted only under `NODE_ENV=test`, so Chapter 12's router can import the mapped Google controller without production secrets. Development and production fail during module startup unless the real key is present.

AES-GCM authenticates the ciphertext and binds it to the provider account row. The encryption key belongs in a separate secret store from the database and its backups. Re-encrypt stored bundles before rotating that key, or clear them and require provider authorization again. Keep token decryption inside this module, never return tokens to a page, and never include token values or decrypted payloads in logs.

If the app does not call Google APIs after login, remove the token columns and `saveProviderTokens()` instead of retaining credentials it does not need.

Compose the protocol helpers in the controller:

```ts filename=app/actions/auth/google/controller.ts
import {
  completeAuth,
  finishExternalAuth,
  startExternalAuth,
} from "remix/auth";
import { Database } from "remix/data-table";
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
      let database = context.get(Database);
      let resolved = await findOrCreateExternalAccount(
        database,
        result.account,
        result.profile,
      );
      if (resolved === null) {
        return new Response("Google account must provide a verified email", {
          status: 403,
        });
      }
      await saveProviderTokens(database, resolved.authAccount, result.tokens);

      let session = completeAuth(context);
      session.set("auth", { userId: resolved.user.id });

      return redirect(returnTo ?? routes.account.index.href(), 303);
    },
  },
});
```

`startExternalAuth()` sanitizes `returnTo` before storing it, dropping absolute, protocol-relative, and backslash-normalized cross-origin values. Apply the same app-owned relative-path rule to any custom redirect path outside that helper.

Google, Microsoft, Okta, Auth0, GitHub, Facebook, X, and Atmosphere have built-in providers. Use `createOIDCAuthProvider()` for another OpenID Connect provider.

When a stored bundle expires, load it through `loadProviderTokens()`, pass it to `refreshExternalAuth(googleProvider, tokens)`, then pass `refreshed.tokens` to `saveProviderTokens()`. The decrypted values stay inside the server-side provider workflow.

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
import { getCsrfToken } from "remix/middleware/csrf";
import { createController } from "remix/router";

import { requireUser } from "../../middleware/require-user.ts";
import { routes } from "../../routes.ts";
import { AccountPage } from "./page.tsx";

export default createController(routes.account, {
  middleware: [requireUser],
  actions: {
    index(context) {
      return context.render(
        <AccountPage
          csrfToken={getCsrfToken(context)}
          email={context.auth.identity.email}
        />,
      );
    },
  },
});
```

Add the page imported by that controller. The email comes from the current auth identity, while the token comes from this request's session:

```tsx filename=app/actions/account/page.tsx
import type { Handle } from "remix/ui";

import { routes } from "../../routes.ts";
import { Document } from "../../ui/document.tsx";

interface AccountPageProps {
  csrfToken: string;
  email: string;
}

export function AccountPage(handle: Handle<AccountPageProps>) {
  return () => {
    let { csrfToken, email } = handle.props;

    return (
      <Document title="Account — Albums">
        <main>
          <h1>Account</h1>
          <p>Signed in as {email}</p>
          <form action={routes.auth.logout.href()} method="post">
            <input name="_csrf" type="hidden" value={csrfToken} />
            <button type="submit">Log out</button>
          </form>
        </main>
      </Document>
    );
  };
}
```

The logout form works without browser JavaScript. `csrf()` checks its hidden token before the logout action destroys the session and sends the `303` redirect.

The default failure is `401 Unauthorized`. Customize it for the caller: a browser page may redirect to login, an API may return JSON and a `WWW-Authenticate` challenge, and the enhanced album form needs a `401` so its submit handler can start a top-level login navigation instead of embedding a followed login redirect.

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

The album page and recommendations frame are reads, but they still expose an owned resource. Add the owner predicate to both existing actions in the parent album controller:

```tsx filename=app/actions/albums/controller.tsx
// In the existing show action, after loading the album with albumRelations:
if (
  album === null ||
  album.artist === null ||
  album.owner_id !== context.auth.identity.id
) {
  return new Response("Album not found", { status: 404 });
}

// In the existing recommendations action, after loading the album:
if (album === null || album.owner_id !== context.auth.identity.id) {
  return new Response("Album not found", { status: 404 });
}
```

These reads use `404` for both a missing album and an album owned by someone else, so the response does not reveal whether another user's album exists. Keep the existing render branches after these checks.

Start with the edit page. Its GET action already checks that the album and artist relation exist. Add the owner check before rendering their values:

```tsx filename=app/actions/albums/edit/controller.tsx
// In the existing index action, after loading album with albumRelations:
if (album === null || album.artist === null) {
  return new Response("Album not found", { status: 404 });
}
if (album.owner_id !== context.auth.identity.id) {
  return new Response("Forbidden", { status: 403 });
}

return context.render(
  <AlbumEditPage
    albumId={album.id}
    values={{
      artist: album.artist.name,
      revision: String(album.revision),
      title: album.title,
      year: String(album.year),
    }}
  />,
);
```

The POST action from Chapter 8 still returns `404` before parsing submitted fields. After that lookup, reject an album owned by another user. Then keep the owner in the guarded update alongside the revision:

```ts
let album = await db.find(albums, context.params.albumId);

if (album === null) {
  return new Response("Album not found", { status: 404 });
}

if (album.owner_id !== context.auth.identity.id) {
  return new Response("Forbidden", { status: 403 });
}

// Inside the existing transaction, after the artist upsert and lookup:
let write = await transaction.updateMany(
  albums,
  {
    artist_id: artist.id,
    revision: result.value.revision + 1,
    title: result.value.title,
    year: result.value.year,
  },
  {
    where: {
      id: album.id,
      owner_id: context.auth.identity.id,
      revision: result.value.revision,
    },
  },
);

if (write.affectedRows === 0) {
  throw new AlbumEditConflictError();
}
```

The artist upsert and guarded album update remain in the transaction from Chapter 8. Its existing `AlbumEditConflictError` catch renders the `409` form after the transaction rolls back. The ownership read happens before the transaction, but the write repeats the owner predicate so a concurrent ownership change cannot turn a previously authorized read into an unscoped update.

Apply the same rule to the `destroy` action that Chapter 8 added to the parent album controller. Replace that handler with an ownership-aware delete:

```tsx filename=app/actions/albums/controller.tsx
// Replace the existing destroy action. Keep show and recommendations.
async destroy(context) {
  let db = context.get(Database);
  let album = await db.find(albums, context.params.albumId);

  if (album === null) {
    return new Response("Album not found", { status: 404 });
  }
  if (album.owner_id !== context.auth.identity.id) {
    return new Response("Forbidden", { status: 403 });
  }

  let write = await db.deleteMany(albums, {
    where: {
      id: album.id,
      owner_id: context.auth.identity.id,
    },
  });
  if (write.affectedRows === 0) {
    return new Response("Album changed before it could be deleted", {
      status: 409,
    });
  }

  return redirect(routes.home.href(), 303);
},
```

Keep the `Database`, `albums`, `redirect`, and `routes` imports already used by the cumulative controller. The delete repeats `owner_id` in its write predicate, so authorization cannot become stale between the read and delete. Chapter 10 adds the revision predicate and cover cleanup to this same action.

Authorization may depend on ownership, role, tenant, record state, or the requested transition. Put a multi-statement policy in an appropriately isolated transaction or a data-layer function when the rules require a consistent snapshot across every check.

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

Now wire the token into the client entry from Chapter 8. Add `csrfToken` to `AlbumEditFormProps`, read it with the existing props, and put the hidden control inside its existing form:

```tsx filename=app/assets/album-edit-form.tsx
// Partial update to the cumulative client entry from Chapter 8.
export interface AlbumEditFormProps {
  // Keep action, conflict, issues, and values.
  csrfToken: string;
}

// Inside AlbumEditForm's render function, include csrfToken in the
// existing props destructuring. Inside its existing <form>, add:
<input name="_csrf" type="hidden" value={csrfToken} />;
```

The server page accepts the same value and passes it across the client-entry boundary:

```tsx filename=app/actions/albums/edit/page.tsx
// Add csrfToken to the existing AlbumEditPageProps interface.
interface AlbumEditPageProps {
  // Keep albumId, conflict, issues, and values.
  csrfToken: string;
}

// Inside the existing AlbumEditPage render function:
<AlbumEditForm
  action={routes.albums.edit.action.href({ albumId })}
  conflict={conflict}
  csrfToken={csrfToken}
  issues={issues}
  values={values}
/>;
```

Then import `getCsrfToken` in the existing edit controller and pass the request's token every time it renders that page. The validation and conflict branches need it too, because both return a form that can be submitted again:

```tsx filename=app/actions/albums/edit/controller.tsx
import { getCsrfToken } from "remix/middleware/csrf";

// In the GET action:
<AlbumEditPage
  albumId={album.id}
  csrfToken={getCsrfToken(context)}
  values={{
    artist: album.artist.name,
    revision: String(album.revision),
    title: album.title,
    year: String(album.year),
  }}
/>

// In the invalid POST branch:
<AlbumEditPage
  albumId={context.params.albumId}
  csrfToken={getCsrfToken(context)}
  issues={result.issues}
  values={values}
/>

// In the revision-conflict branch:
<AlbumEditPage
  albumId={album.id}
  conflict="This album changed after you opened the form. Reload the latest version before trying again."
  csrfToken={getCsrfToken(context)}
  issues={[]}
  values={values}
/>
```

These are partial snippets: keep the surrounding controller logic from Chapter 8. The login and logout forms already receive the same request-scoped token in their own page/controller code above.

The delete form from Chapter 8 needs the token too. Update the existing album page props, then put the hidden token beside the method override. Keep the album details and recommendations frame already rendered by this component:

```tsx filename=app/actions/albums/show-page.tsx
import type { AlbumWithArtist } from "../../data/schema.ts";

interface AlbumPageProps {
  album: AlbumWithArtist;
  csrfToken: string;
}

// Change the existing handle type to Handle<AlbumPageProps>.
// Inside its render function:
let { album, csrfToken } = handle.props;

// Add this form alongside the existing album details and recommendations frame:
<form action={routes.albums.destroy.href({ albumId: album.id })} method="post">
  <input name="_csrf" type="hidden" value={csrfToken} />
  <input name="_method" type="hidden" value="DELETE" />
  <button type="submit">Delete album</button>
</form>;
```

Finally, import `getCsrfToken` in the album controller and pass the value from the show action:

```tsx filename=app/actions/albums/controller.tsx
import { getCsrfToken } from "remix/middleware/csrf";

// In the existing show action, after its album and ownership checks:
return context.render(
  <AlbumPage
    album={{ ...album, artist: album.artist }}
    csrfToken={getCsrfToken(context)}
  />,
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

CORS does not authenticate a request, authorize an album, or stop a script, server, or command-line client from sending HTTP traffic. A disallowed simple cross-origin request may still execute; the browser only withholds response access. Keep auth and authorization on the operation itself.

If a product requires cross-origin cookie auth, it needs `SameSite=None; Secure`, exact credentialed CORS origins, and matching CSRF/COP trusted-origin policy.

With the browser boundary protected, [Files and Assets](/files-and-assets/) applies the same trust-boundary thinking to browser source, uploaded files, storage keys, and downloads.
