---
title: Forms and Mutations
description: How native forms, action responses, validation failures, redirects, and enhanced mutations fit together.
---

The album edit action in [Data and Validation](/data-and-validation/) can parse a trusted value. Now we will finish the browser workflow: render the form, return field errors without losing the submitted values, update the album, and redirect to its page.

We will build the complete HTML request first. Pending state, fetch submission, and optimistic UI come afterward and use the same form action.

## HTML-first form workflows {#html-first-form-workflows}

A form names the route, method, and fields the browser will submit. Use native controls so the request still works before the browser entry loads:

```tsx filename=app/actions/albums/edit/page.tsx
import type { Issue } from "remix/data-schema";
import type { Handle } from "remix/ui";

import { routes } from "../../../routes.ts";
import { Document } from "../../../ui/document.tsx";

interface AlbumEditPageProps {
  albumId: string;
  conflict?: string;
  issues?: ReadonlyArray<Issue>;
  values: {
    artist: string;
    title: string;
    year: string;
    revision: string;
  };
}

export function AlbumEditPage(handle: Handle<AlbumEditPageProps>) {
  return () => {
    let { albumId, conflict, issues = [], values } = handle.props;
    let artistIssue = issues.find((issue) => issue.path?.[0] === "artist");
    let revisionIssue = issues.find((issue) => issue.path?.[0] === "revision");
    let titleIssue = issues.find((issue) => issue.path?.[0] === "title");
    let yearIssue = issues.find((issue) => issue.path?.[0] === "year");

    return (
      <Document title={`Edit ${values.title} — Albums`}>
        <main>
          <h1>Edit {values.title}</h1>
          {conflict ? <p role="alert">{conflict}</p> : null}
          {revisionIssue ? (
            <p role="alert">
              This form is no longer valid. Reload the page before trying again.
            </p>
          ) : null}
          <form
            action={routes.albums.edit.action.href({ albumId })}
            method="post"
          >
            <input name="revision" type="hidden" value={values.revision} />
            <label>
              Title
              <input
                aria-describedby={titleIssue ? "title-error" : undefined}
                aria-invalid={titleIssue ? "true" : undefined}
                name="title"
                defaultValue={values.title}
                required
              />
            </label>
            {titleIssue ? (
              <p id="title-error" role="alert">
                {titleIssue.message}
              </p>
            ) : null}
            <label>
              Artist
              <input
                aria-describedby={artistIssue ? "artist-error" : undefined}
                aria-invalid={artistIssue ? "true" : undefined}
                name="artist"
                defaultValue={values.artist}
                required
              />
            </label>
            {artistIssue ? (
              <p id="artist-error" role="alert">
                {artistIssue.message}
              </p>
            ) : null}
            <label>
              Year
              <input
                aria-describedby={yearIssue ? "year-error" : undefined}
                aria-invalid={yearIssue ? "true" : undefined}
                name="year"
                defaultValue={values.year}
                inputMode="numeric"
                required
              />
            </label>
            {yearIssue ? (
              <p id="year-error" role="alert">
                {yearIssue.message}
              </p>
            ) : null}
            <button type="submit">Save album</button>
          </form>
        </main>
      </Document>
    );
  };
}
```

The GET action builds `values` from the loaded album, including `String(album.year)` and `String(album.revision)`. The submitted revision is still untrusted: the schema checks its shape, and the conditional update below checks it against the database.

The `name` attributes become `FormData` keys. The year control stays text-shaped so an invalid value can survive the round trip, while `inputMode` still asks for a numeric keyboard. The action owns the integer and range checks because a caller can bypass the page.

Every expected action outcome should be an explicit response:

- `400` HTML with the form for invalid input.
- `404` when the album does not exist.
- `409` when an app-owned revision detects a conflicting edit.
- `303` redirect after a successful write.

That response contract is useful to a browser navigation, a router test, and an enhanced form.

## Form routes and controller ownership {#form-routes}

`form(pattern)` creates the common page-and-submit route map:

```ts filename=app/routes.ts
import { del, form, get, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: "/",
  albums: {
    show: get("/albums/:albumId"),
    recommendations: get("/albums/:albumId/recommendations"),
    edit: form("/albums/:albumId/edit"),
    destroy: del("/albums/:albumId"),
  },
});
```

That gives us two direct leaves:

```txt
routes.albums.edit.index  -> GET  /albums/:albumId/edit
routes.albums.edit.action -> POST /albums/:albumId/edit
```

Both belong to the existing controller for `routes.albums.edit`. Keep its `index` and `action` handlers together when the sections below fill in `action`; a controller that owns only one leaf from `form(...)` fails during router setup.

Map the form route map separately from its parent, as covered in [Routing and Controllers](/routing-and-controllers/#mapping-controllers):

```ts filename=app/router.ts
// Keep both mappings in the cumulative router.
router.map(routes.albums, albumsController);
router.map(routes.albums.edit, albumsEditController);
```

`destroy` is a direct leaf of `routes.albums`, so add a `destroy` handler to `albumsController.actions`. The existing `router.map(routes.albums, albumsController)` registers it; do not add a separate `router.map(routes.albums.destroy, ...)` call.

Use separate `post`, `put`, `patch`, or `del` leaves when those operations have distinct URLs or ownership. `form(...)` is shorthand for the common GET/POST pair, not a requirement that every mutation share one route.

## Parse FormData once, then validate it {#parse-and-validate-form-data}

Put `formData()` before middleware and actions that depend on form fields:

```ts filename=app/router.ts
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import { loadAssetEntry } from "./middleware/asset-entry.ts";
import { loadDatabase } from "./middleware/database.ts";
import { render } from "./middleware/render.tsx";

// Replace only the existing createRouter(...) call. Keep the AppContext
// declaration and controller mappings that follow it.
export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    formData(),
    asyncContext(),
    loadDatabase(),
    loadAssetEntry(),
    render(),
  ],
});
```

The action reads `context.formData` (or `context.get(FormData)`) without consuming the request body again. Validate that `FormData` with a schema:

```ts filename=app/actions/albums/edit/schema.ts
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

export const albumFormSchema = f.object({
  artist: f.field(
    s
      .string()
      .refine((value) => value.trim().length > 0, "Artist is required")
      .transform((value) => value.trim()),
  ),
  title: f.field(
    s
      .string()
      .refine((value) => value.trim().length > 0, "Title is required")
      .transform((value) => value.trim()),
  ),
  year: f.field(
    coerce
      .number()
      .refine(Number.isInteger, "Enter a whole year")
      .refine(
        (value) => value >= 1860 && value <= 2100,
        "Enter a valid release year",
      ),
  ),
  revision: f.field(
    coerce
      .number()
      .refine(Number.isInteger, "Invalid album revision")
      .refine((value) => value >= 0, "Invalid album revision"),
  ),
});
```

`f.field(...)` selects one text value. Use `f.fields(...)` for repeated controls, `f.file(...)` for one upload, and `f.files(...)` for repeated uploads. Checkboxes that are not selected are absent, so give them a default or model their optional state in the schema.

Coerce values such as `year` at this boundary. The rest of the action receives a number instead of carrying a string through business logic.

## Return validation failures with the form {#validation-failures}

The server should return enough HTML for the reader to fix the request. Capture safe text values before parsing, then render issues beside their controls:

```tsx filename=app/actions/albums/edit/controller.tsx
// Inside the existing actions object for routes.albums.edit:
async action(context) {
  let formData = context.formData;
  let values = {
    artist: String(formData.get("artist") ?? ""),
    title: String(formData.get("title") ?? ""),
    year: String(formData.get("year") ?? ""),
    revision: String(formData.get("revision") ?? ""),
  };
  let result = s.parseSafe(albumFormSchema, formData);

  if (!result.success) {
    return context.render(
      <AlbumEditPage albumId={context.params.albumId} issues={result.issues} values={values} />,
      { status: 400 },
    );
  }

  // Update and redirect below.
},
```

The page maps `title`, `artist`, and `year` issues to their editable controls and connects each message with `aria-describedby`. A `revision` issue gets a reload message because there is no user-editable value to correct.

Keep submitted text for another attempt, but do not replay password fields or file inputs. Browsers do not allow assigning a previous file selection, and putting a password back into HTML exposes it unnecessarily.

Return a `400` status with the form. A validation response is not a successful `200`, and tests or enhanced callers should be able to tell the difference without reading prose from the page.

## Redirect after a successful mutation {#post-redirect-get}

After validation and the database write, redirect to the album's stable GET page:

```tsx filename=app/actions/albums/edit/controller.tsx
import { redirect } from "remix/response/redirect";

// After the guarded database update shown below succeeds:
return redirect(
  routes.albums.show.href({ albumId: context.params.albumId }),
  303,
);
```

`303 See Other` tells the browser to follow the POST with a GET. Refreshing the album page repeats that GET instead of asking to resubmit the form.

Once the next chapter installs session middleware, a one-request success message can go into flash data before redirecting:

```ts
let session = context.get(Session);
session.flash("message", `Saved ${result.value.title}.`);
```

The session middleware persists the changed session on the redirect response, and the destination reads the flash value once.

## Multiple submit intents and mutation responses {#mutation-intents-and-responses}

One form may have a few related actions. Name the submit buttons so the clicked button joins the submitted `FormData`:

```tsx
<button name="intent" type="submit" value="save">
  Save draft
</button>
<button name="intent" type="submit" value="publish">
  Publish
</button>
```

Add the field to the form schema:

```ts
const albumFormSchema = f.object({
  // album fields...
  intent: f.field(s.enum_(["save", "publish"])),
});
```

Branch after the complete form has been validated. Both intents still belong to the edit action because they operate on the same resource and fields. Separate routes are clearer when operations have different authorization, payloads, or lifecycle.

Choose a response for its caller:

- Render HTML with a failure status when the current page can resolve the problem.
- Redirect after a normal browser mutation succeeds.
- Return JSON for an endpoint whose consumer genuinely needs data rather than a page.

## PUT, PATCH, and DELETE from HTML forms {#method-override-for-put-patch-and-delete}

HTML forms submit `GET` or `POST`. If the route contract uses `PUT`, `PATCH`, or `DELETE`, add `methodOverride()` after form parsing:

```ts filename=app/router.ts
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import { loadAssetEntry } from "./middleware/asset-entry.ts";
import { loadDatabase } from "./middleware/database.ts";
import { render } from "./middleware/render.tsx";

// Replace only the existing createRouter(...) call. Keep the AppContext
// declaration and controller mappings that follow it.
export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    formData(),
    methodOverride(),
    asyncContext(),
    loadDatabase(),
    loadAssetEntry(),
    render(),
  ],
});
```

The form remains a browser-valid POST and supplies the effective method in a hidden field:

```tsx
<form action={routes.albums.destroy.href({ albumId: album.id })} method="post">
  <input name="_method" type="hidden" value="DELETE" />
  <button type="submit">Delete album</button>
</form>
```

`methodOverride()` updates `context.method` before route matching. `context.request.method` remains `POST`, which records what arrived over HTTP. Change the field name with `methodOverride({ fieldName: "__method__" })` when `_method` conflicts with an existing payload.

## Enhance submissions without replacing the action {#enhanced-form-submissions}

Once the form works as a navigation, a client entry can intercept `submit`. Preserve the clicked submit button, follow a redirect as navigation, and clear pending state on every non-aborted outcome:

```tsx
// In the client entry's setup scope:
let pending = false;
let submissionError: string | undefined;

// Add this mixin to the form in its render function:
mix={on("submit", async (event, signal) => {
  event.preventDefault();
  pending = true;
  submissionError = undefined;
  handle.update();

  let form = event.currentTarget;

  try {
    let response = await fetch(form.action, {
      method: form.method,
      headers: { "X-Remix-Frame": "true" },
      body: new FormData(form, event.submitter),
      signal,
    });

    if (signal.aborted) return;

    if (response.redirected) {
      let redirectUrl = new URL(response.url, window.location.href);
      if (redirectUrl.origin !== window.location.origin) {
        submissionError = "The save response contained an invalid redirect";
        return;
      }

      window.location.assign(redirectUrl.href);
      return;
    }

    if (response.status === 401) {
      let loginLocation = response.headers.get("X-Login-Location");
      if (loginLocation === null) {
        submissionError = "Sign in before saving this album";
        return;
      }

      let loginUrl = new URL(loginLocation, window.location.href);
      if (loginUrl.origin !== window.location.origin) {
        submissionError = "The login response was invalid";
        return;
      }

      if (!loginUrl.searchParams.has("returnTo")) {
        loginUrl.searchParams.set("returnTo", window.location.pathname + window.location.search);
      }

      window.location.assign(loginUrl.href);
      return;
    }

    if (response.status === 400 || response.status === 409) {
      await handle.frame.replace(response.body ?? (await response.text()));
      return;
    }

    if (!response.ok) {
      submissionError = `Save failed (${response.status})`;
      return;
    }

    await handle.frame.reload();
  } catch {
    if (signal.aborted) return;
    submissionError = "The network request failed";
  } finally {
    if (!signal.aborted) {
      pending = false;
      handle.update();
    }
  }
})}
```

The event handler sends the same action URL and fields. Its signal cancels stale work when the handler is re-entered or removed, and the check immediately after `fetch(...)` prevents an obsolete response from changing the page. Validation and conflict bodies stream into the form's current frame, while a non-redirecting success reloads that same declared frame. Both redirect branches require a same-origin destination before starting a top-level navigation; [Auth, Sessions, and Security](/auth-sessions-security/#route-protection-with-requireauth) defines the `401` response contract.

For validation-heavy forms, target the form frame so a `400` response can replace it with server-rendered errors. [Interactivity](/interactivity/#coordinating-forms-fetches-frame-reloads-and-navigation) covers client entries and frame reloads in detail.

## Pending, optimistic, and conflicting mutations {#optimistic-ui}

Set pending state as soon as a request begins. Change a button label, disable duplicate submission when appropriate, and keep an accessible status message for work that takes long enough to notice.

Optimistic UI renders the expected result before the server confirms it. Use it for reversible operations such as starring an album, and keep the prior value for rollback:

```ts
let previous = favorite;
favorite = !favorite;
handle.update();

let response = await fetch(action, { method: "POST", signal });

if (signal.aborted) return;
if (!response.ok) {
  favorite = previous;
  error = "Could not update favorite";
  handle.update();
  return;
}
```

Do not optimistically claim success for an irreversible payment, permission change, or file deletion unless the product has a real recovery path.

When multiple writers can edit the same row, include the app-owned `revision` from the table and migration in the form. Update only when that revision still matches:

```tsx
import { Database } from "remix/data-table";

import { albums } from "../../../data/schema.ts";

let db = context.get(Database);
let album = await db.find(albums, context.params.albumId);
if (album === null) {
  return new Response("Album not found", { status: 404 });
}

let { revision, title, year } = result.value;
let write = await db.updateMany(
  albums,
  { title, year, revision: revision + 1 },
  { where: { id: album.id, revision } },
);

if (write.affectedRows === 0) {
  return context.render(
    <AlbumEditPage
      albumId={context.params.albumId}
      conflict="This album changed after you opened the form. Reload the latest version before trying again."
      issues={[]}
      values={values}
    />,
    { status: 409 },
  );
}

return redirect(routes.albums.show.href({ albumId: album.id }), 303);
```

The complete action can resolve or create the submitted artist inside the same transaction before this guarded album update. When the revision no longer matches, return `409 Conflict` and tell the reader how to load the current value before reconciling it. Disabling one browser's button does not prevent a competing write elsewhere.

## When to return JSON {#resource-routes-and-json-endpoints}

JSON fits endpoints consumed as data: autocomplete results, polling state, isolated widgets, public APIs, and service-to-service calls.

```ts
return Response.json(
  { albums: matches },
  {
    headers: {
      "Cache-Control": "private, max-age=30",
    },
  },
);
```

A form that already has a useful HTML failure and redirect path usually does not need a parallel JSON mutation endpoint. Enhance the existing action and choose a frame or navigation response. Add JSON when it is the natural representation for the caller, not merely because browser JavaScript is involved.

Forms now have a complete request contract from native controls through validation and persistence. Next, [Auth, Sessions, and Security](/auth-sessions-security/) adds the browser state, identity, authorization, and cross-origin defenses around those mutations.
