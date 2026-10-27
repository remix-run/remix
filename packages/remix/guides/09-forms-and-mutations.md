---
title: Forms and Mutations
description: How native forms, action responses, validation failures, redirects, and enhanced mutations fit together.
---

A mutation in Remix starts as a native HTML form that posts to a route action. This guide uses an album edit form at `/albums/:albumId/edit` to cover parsing a submission, rendering field errors with a `400` response, saving valid input and redirecting with `303`, showing pending feedback once the browser runtime starts, and submitting methods other than GET and POST.

## Start with a native form

A `form("/albums/:albumId/edit")` route pairs two actions at the same URL. The GET `index` action loads the album for editing, and the POST `action` handler parses and saves a submission. Map both with one controller, such as `router.map(routes.albums.edit, albumsEditController)`.

Render a native `<form method="post">` with named inputs and a submit button. With JavaScript disabled, the browser still sends those fields to the action and displays its response. The [`formData()` middleware](/request-handling/#common-middleware) from [`remix/middleware/form-data`](../src/form-data-middleware/README.md) parses the body before the action runs and makes it available as `context.formData`.

## Load the edit form

The `index` action loads the album, returns `404` if it is missing, and renders the edit page. These examples read from a `context.db` that [database middleware puts on the request context](/data-and-validation/#give-actions-access-to-the-database), with an `albums` table defined in `app/data/tables.ts`:

```tsx filename=app/actions/albums/edit/controller.tsx lines=[3,9-14]
import { createController } from "remix/router";

import { albums } from "../../../data/tables.ts";
import { routes } from "../../../routes.ts";
import { AlbumEditPage } from "./page.tsx";

export default createController(routes.albums.edit, {
  actions: {
    async index(context) {
      let album = await context.db.find(albums, context.params.albumId);
      if (album === null) return new Response("Album not found", { status: 404 });

      return context.render(<AlbumEditPage album={album} />);
    },
    async action(context) {
      /* ... */
    },
  },
});
```

`/albums/thriller/edit` now renders the form with the album's stored values.

## Return validation failures with the form

The page needs to distinguish the stored album from an unsuccessful edit. Give `AlbumEditPage` optional `values` and `issues` props:

```tsx filename=app/actions/albums/edit/page.tsx lines=[1,10-11,22,28,31-33,41-42,44-45,47]
import type { Issue } from "remix/data-schema";
import type { Handle } from "remix/component";

import type { Album } from "../../../data/tables.ts";
import { routes } from "../../../routes.ts";
import { Document } from "../../document.tsx";

interface AlbumEditPageProps {
  album: Album;
  values?: { title: string; artist: string; year: string };
  issues?: readonly Issue[];
}

const fields = [
  { name: "title", label: "Title" },
  { name: "artist", label: "Artist" },
  { name: "year", label: "Year" },
] as const;

export function AlbumEditPage(handle: Handle<AlbumEditPageProps>) {
  return () => {
    let { album, values, issues = [] } = handle.props;

    return (
      <Document title={`Edit ${album.title} — Albums`}>
        <main>
          <h1>Edit {album.title}</h1>
          {issues.length > 0 && <p role="alert">Please correct the fields below.</p>}
          <form method="post" action={routes.albums.edit.action.href({ albumId: album.id })}>
            {fields.map(({ name, label }) => {
              let issue = issues.find((issue) => issue.path?.[0] === name);
              let inputId = `album-${name}`;
              let errorId = `${inputId}-error`;

              return (
                <div key={name}>
                  <label htmlFor={inputId}>{label}</label>
                  <input
                    id={inputId}
                    name={name}
                    defaultValue={values?.[name] ?? String(album[name])}
                    inputMode={name === "year" ? "numeric" : undefined}
                    required
                    aria-invalid={issue ? true : undefined}
                    aria-describedby={issue ? errorId : undefined}
                  />
                  {issue && <p id={errorId}>{issue.message}</p>}
                </div>
              );
            })}
            <button type="submit">Save album</button>
          </form>
        </main>
      </Document>
    );
  };
}
```

The inputs use the stored album initially and preserve submitted `values` after validation fails. Each field displays its first validation issue, linked to the input with `aria-describedby`.

## Parse and save the submitted form

Describe the fields the form may submit with a form-data schema from [`remix/data-schema/form-data`](../src/data-schema/README.md). This one trims the title and artist, rejects blank values, and converts the year to a positive whole number:

```ts filename=app/actions/albums/edit/schema.ts
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const albumText = s
  .string()
  .transform((value) => value.trim())
  .pipe(checks.minLength(1));

const albumYear = coerce
  .number()
  .refine((value) => Number.isInteger(value) && value > 0, "Enter a positive whole year");

export const albumForm = f.object({
  title: f.field(albumText),
  artist: f.field(albumText),
  year: f.field(albumYear),
});
```

[Defining input schemas](/data-and-validation/#define-the-input-schema) explains each of these helpers.

In the POST action, pass `context.formData` to `s.parseSafe(albumForm, context.formData)`. When `parsed.success` is false, validation errors are available in `parsed.issues`. On success, `parsed.value` contains the validated fields, with trimmed text and a numeric year.

```tsx filename=app/actions/albums/edit/controller.tsx lines=[5,19-20,30-33,36-43]
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { albums } from "../../../data/tables.ts";
import { routes } from "../../../routes.ts";
import { AlbumEditPage } from "./page.tsx";
import { albumForm } from "./schema.ts";

export default createController(routes.albums.edit, {
  actions: {
    async index(context) {
      let album = await context.db.find(albums, context.params.albumId);
      if (album === null) return new Response("Album not found", { status: 404 });

      return context.render(<AlbumEditPage album={album} />);
    },
    async action(context) {
      let parsed = s.parseSafe(albumForm, context.formData);
      if (!parsed.success) {
        let album = await context.db.find(albums, context.params.albumId);
        if (album === null) return new Response("Album not found", { status: 404 });

        let values = {
          title: readText(context.formData, "title"),
          artist: readText(context.formData, "artist"),
          year: readText(context.formData, "year"),
        };

        return context.render(
          <AlbumEditPage album={album} values={values} issues={parsed.issues} />,
          { status: 400 },
        );
      }

      try {
        await context.db.update(albums, context.params.albumId, parsed.value);
      } catch (error) {
        console.error("Failed to save album:", error);
        return new Response("Unable to save album", { status: 500 });
      }

      return redirect(routes.albums.show.href({ albumId: context.params.albumId }), 303);
    },
  },
});

function readText(formData: FormData, name: string): string {
  let value = formData.get(name);
  return typeof value === "string" ? value : "";
}
```

`readText()` collects text for display without converting a missing entry or a file into a string. These values never become the database update. That still comes from `parsed.value`, after trimming, coercion, and validation have succeeded.

The failure branch renders directly with status `400`. Redirecting back to the GET action would load the stored album again and lose the user's changes and errors. For forms with sensitive fields, choose which values to return. Leave password fields empty, and ask the user to select files again.

Validation only checks the shape of the input. Before saving, also check that the current user [may edit this album](/auth-sessions-security/#authorization-checks).

## Redirect after saving

After parsing succeeds, `db.update(...)` saves `parsed.value` to the album selected by the route's `albumId`. If the update fails, the action logs the error on the server and returns `500` without exposing database details to the browser. The [`remix/data-table`](../src/data-table/README.md) overview covers the other read and write helpers and their error behavior.

After a successful save, the action returns `303 See Other` with the album page's URL. The browser follows that redirect with a GET:

```txt
POST /albums/thriller/edit
  → update the album
  → 303 Location: /albums/thriller
GET /albums/thriller
  → render the saved album
```

Refreshing the resulting page repeats the GET instead of submitting the edit again.

To show "Album saved" on the destination page, store the message as [session flash data](/auth-sessions-security/#flash-messages) before redirecting. It is available on the next request and then removed.

## Add pending feedback

Once the page [boots the browser runtime with `run()`](/interactivity/#browser-entry-with-run), Remix handles the form submission as a [frame navigation](/streaming-ui-with-frames/#navigate-a-frame-with-a-form). It renders validation responses into the page and follows redirects after a successful save.

You have two ways to show that a save is in progress:

- Hydrate the whole form with `clientEntry(...)` and set pending state from its `submit` handler, as the [hydrated album form](/start-here/#add-your-first-hydrated-component) does. This fits when the form already needs browser state, or when you intercept the submission with [`fetch()`](/interactivity/#enhancing-forms-with-fetch-and-navigation).
- Hydrate only the submit button and follow the containing frame's `reloadStart` and `reloadComplete` events. The rest of the form stays server-rendered, and the button needs no knowledge of how the form submits.

The second option looks like this. Put the button in the edit action's `public/` directory so it can load in the browser:

```tsx filename=app/actions/albums/edit/public/save-button.tsx
import { clientEntry } from "remix/component";
import type { Handle } from "remix/component";

export const SaveButton = clientEntry(import.meta.url, function SaveButton(handle: Handle) {
  let pending = false;

  handle.frame.addEventListener(
    "reloadStart",
    () => {
      pending = true;
      handle.update();
    },
    { signal: handle.signal },
  );

  handle.frame.addEventListener(
    "reloadComplete",
    () => {
      pending = false;
      handle.update();
    },
    { signal: handle.signal },
  );

  return () => (
    <button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save album"}
    </button>
  );
});
```

Then render `SaveButton` in place of the plain submit button:

```tsx filename=app/actions/albums/edit/page.tsx
import { SaveButton } from "./public/save-button.tsx";

// Inside AlbumEditPage's render function:
<form method="post" action={routes.albums.edit.action.href({ albumId: album.id })}>
  {/* Keep the existing fields and validation messages. */}
  <SaveButton />
</form>;
```

`reloadStart` disables the button and shows "Saving…", and `reloadComplete` restores it after the navigation settles, including a validation response or request failure. Passing `handle.signal` removes the listeners when the component is removed.

## Use other HTTP methods when the route calls for them

HTML forms only submit GET and POST. If a route expects PATCH, PUT, or DELETE, the form still posts and names the intended method in a hidden field, and method override middleware rewrites the request method before routing.

For a PATCH edit route, set the action method with `form("/albums/:albumId/edit", { formMethod: "PATCH" })`, and add this hidden field inside the POST form:

```html
<input type="hidden" name="_method" value="PATCH" />
```

Install `methodOverride()` from [`remix/middleware/method-override`](../src/method-override-middleware/README.md) in the router's middleware stack, immediately after form parsing:

```ts lines=[2,10]
// In app/router.ts:
import { methodOverride } from "remix/middleware/method-override";

// Keep the other middleware and controller mappings:
export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    loadDatabase(),
    formData(),
    methodOverride(),
    render({ assets }),
  ],
});
```

The browser sends POST. After parsing `_method`, the middleware sets `context.method` to PATCH before route matching, so the controller's `action` matches the PATCH route. Installing method override on the controller would be too late to select the route. PUT and DELETE work the same way when you define matching routes.
