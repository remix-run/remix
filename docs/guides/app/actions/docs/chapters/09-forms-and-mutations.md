---
title: Forms and Mutations
description: How native forms, action responses, validation failures, redirects, and enhanced mutations fit together.
---

In [Data and Validation](/data-and-validation/), we moved our albums into SQLite and defined `albumForm` to validate edits.

Let's connect the edit form to that database. We'll parse submissions, return the form with field errors when validation fails, and save valid edits before redirecting to the album. Then we'll add pending feedback.

## Keep the native form

Our existing `form("/albums/:albumId/edit")` route pairs two actions at the same URL. The GET `index` action loads the album for editing, and the POST `action` handler parses and saves a submission. Both belong to the controller mapped with `router.map(routes.albums.edit, albumsEditController)`.

We'll keep a native `<form method="post">`, named inputs, and a submit button. With JavaScript disabled, the browser still sends those fields to the action and displays its response. The router's `formData()` middleware already makes the parsed body available as `context.formData`.

## Load the edit form

First, replace the edit controller's array lookup with a database query. The `index` action loads the album, returns `404` if it is missing, and renders the edit page:

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

Open `/albums/thriller/edit`. The form now starts with the album's stored values.

## Return validation failures with the form

The page needs to distinguish the stored album from an unsuccessful edit. Add optional `values` and `issues` props to `AlbumEditPage`:

```tsx filename=app/actions/albums/edit/page.tsx lines=[1,10-11,22,28,31-33,41-42,44-45,47]
import type { Issue } from "remix/data-schema";
import type { Handle } from "remix/ui";

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

Pass `context.formData` to `s.parseSafe(albumForm, context.formData)` in the edit action. When `parsed.success` is false, validation errors are available in `parsed.issues`. On success, `parsed.value` contains the validated fields, with trimmed text and a numeric year.

Update the controller to load the album from SQLite, render invalid submissions with their errors, and save validated edits:

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

## Redirect after saving

After parsing succeeds, `db.update(...)` saves `parsed.value` to the album selected by the route's `albumId`. If the update fails, the action logs the error on the server and returns `500` without exposing database details to the browser. For other read and write helpers and their error behavior, see the [`data-table` overview](https://api.remix.run/api/remix/data-table/overview/).

After a successful save, the action returns `303 See Other` with the album page's URL. The browser follows that redirect with a GET:

```txt
POST /albums/thriller/edit
  → update the album
  → 303 Location: /albums/thriller
GET /albums/thriller
  → render the saved album
```

Refreshing the resulting page repeats the GET instead of submitting the edit again.

If the destination should display “Album saved,” session flash data can carry that message across the redirect. We'll add sessions in [Auth, Sessions, and Security](/auth-sessions-security/).

## Add pending feedback

With the app's browser runtime running, Remix handles the form submission as a navigation. It renders validation responses into the page and follows redirects after a successful save.

We can show progress by hydrating just the save button. Put it in the edit action's `public/` directory:

```tsx filename=app/actions/albums/edit/public/save-button.tsx
import { clientEntry } from "remix/ui";
import type { Handle } from "remix/ui";

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

Now, replace the plain submit button with `<SaveButton />`. The button listens to its containing frame: `reloadStart` disables it and shows “Saving…”, and `reloadComplete` restores it. Passing `handle.signal` removes the listeners when the component is removed.

## Use other HTTP methods when the route calls for them

Our edit route works with POST. If your app instead exposes a PATCH update route, HTML forms need a method override because their submission methods are GET and POST.

Change the edit route's action method with `form("/albums/:albumId/edit", { formMethod: "PATCH" })`, and add this hidden field inside its existing POST form:

```html
<input type="hidden" name="_method" value="PATCH" />
```

Install method override in the router's middleware stack, immediately after form parsing:

```ts lines=[2,10]
// In app/router.ts:
import { methodOverride } from "remix/middleware/method-override";

// Keep the other middleware and controller mappings:
export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    database(db),
    formData(),
    methodOverride(),
    render({ assets }),
  ],
});
```

The browser sends POST. After parsing `_method`, the middleware sets `context.method` to PATCH before route matching. The same controller's `action` now matches that PATCH route. Installing method override on the controller would be too late to select the route. PUT and DELETE work the same way when you define matching routes.

In [Auth, Sessions, and Security](/auth-sessions-security/), we'll decide who is allowed to edit an album and connect those decisions to the request's session.
