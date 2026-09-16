# Routing and Controllers

Read for URL contracts, controller ownership, or form-to-response flows.

Installed API docs: `src/fetch-router/README.md` (including `remix/routes`), `src/render-middleware/README.md`, and `src/response/README.md` for the `remix/response/*` helpers. See [app structure](app-structure.md) for file placement and [middleware](middleware-and-server.md) for typed context.

## Contents

- Route contract to controller: a complete session-backed form
- Response decisions: status, redirects, JSON, files, caching

## Route Contract to Controller

Define URLs in `app/routes.ts`, then implement their direct leaf keys in controllers. Use `get(...)` for GET-only pages; a string route matches any method. Read the router README for `form`, `resources`, and other builders rather than hand-writing their expansions.

This example saves a browser's display-name preference in its session. It needs `formData()` and `session()` added to the scaffold's middleware stack ahead of `render({ assets })`; see [middleware](middleware-and-server.md#preserve-context-types) for extending `AppContext` and [auth and sessions](auth-and-sessions.md) for session configuration and the CSRF token this form should carry before shipping.

Add `preferences` to the existing route map without removing asset or other routes:

```ts
// app/routes.ts
import { form, get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  preferences: form('/preferences'),
})
```

`form()` creates the `index` and `action` leaves. Their controller belongs at `app/actions/preferences/controller.tsx`:

```tsx
import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { Session } from 'remix/session'

import { routes } from '../../routes.ts'
import { PreferencesPage } from './preferences-page.tsx'

const preferencesSchema = f.object({
  displayName: f.field(s.string().pipe(minLength(1))),
})

export default createController(routes.preferences, {
  actions: {
    index(context) {
      let savedName = context.get(Session).get('displayName')
      return context.render(
        <PreferencesPage value={typeof savedName === 'string' ? savedName : ''} />,
      )
    },
    action(context) {
      let formData = context.get(FormData)
      let parsed = s.parseSafe(preferencesSchema, formData)
      if (!parsed.success) {
        let submittedName = formData.get('displayName')
        return context.render(
          <PreferencesPage
            value={typeof submittedName === 'string' ? submittedName : ''}
            error="Enter a display name."
          />,
          { status: 400 },
        )
      }

      context.get(Session).set('displayName', parsed.value.displayName)
      return redirect(routes.preferences.index.href(), 303)
    },
  },
})
```

Keep the page beside the controller. This uses the starter's existing `Document` shell:

```tsx
// app/actions/preferences/preferences-page.tsx
import type { Handle } from 'remix/ui'

import { routes } from '../../routes.ts'
import { Document } from '../document.tsx'

interface PreferencesPageProps {
  value: string
  error?: string
}

export function PreferencesPage(handle: Handle<PreferencesPageProps>) {
  return () => (
    <Document title="Preferences">
      <h1>Preferences</h1>
      <form method="post" action={routes.preferences.action.href()} data-rmx-document>
        <label for="display-name">Display name</label>
        <input
          id="display-name"
          name="displayName"
          value={handle.props.value}
          required
          aria-invalid={handle.props.error ? 'true' : undefined}
          aria-describedby={handle.props.error ? 'display-name-error' : undefined}
        />
        {handle.props.error && (
          <p id="display-name-error" role="alert">
            {handle.props.error}
          </p>
        )}
        <button type="submit">Save</button>
      </form>
    </Document>
  )
}
```

Import and map this controller in the existing router, alongside the root controller:

```ts
import preferencesController from './actions/preferences/controller.tsx'

router.map(routes.preferences, preferencesController)
```

`data-rmx-document` deliberately keeps the form browser-owned, including when the document boots `run()`. Remove it only after configuring the [enhanced form response policy](hydration-frames-navigation.md#preserve-form-error-responses), so `400` HTML remains visible.

## Response Decisions

- Return `context.render(node, { status, headers })` for HTML. For source-based client entries, the render middleware needs the app's asset server.
- After a successful mutation, return `redirect(destination, 303)` for a GET of the resulting page. Preserve only safe submitted fields on validation failure; never re-render passwords or secrets.
- Return explicit `400`/`422`, `403`, `404`, or `409` responses for expected failures. Translate known persistence failures at the action boundary; do not convert every exception into a validation error.
- Use `Response.json(...)` for actual JSON consumers such as autocomplete, polling, or external clients. Do not add a parallel JSON API solely to avoid returning HTML from a form route.
- Use `remix/response/file` for downloads and `remix/response/html` for HTML that does not use Remix UI. Reserve low-level `renderToStream` for intentionally custom rendering pipelines.
- Decide cache policy explicitly. Private/session-dependent HTML must not be cached as public shared content.

Controller middleware applies only to that controller's direct actions. When a nested route map needs protection, add it to that controller too; registration under a similarly named parent does not establish middleware inheritance.

Verify successful submission, invalid input, relevant authorization failures, redirect location/status, and persisted state through the router. If the form is enhanced, also verify its browser failure path.
