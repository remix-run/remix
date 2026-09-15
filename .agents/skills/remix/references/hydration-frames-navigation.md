# Hydration, Frames, and Navigation

Read when server-rendered UI needs browser behavior, targeted reloads, or enhanced navigation.

Installed API docs: `src/ui/README.md`, `src/ui/server/README.md`, and `src/render-middleware/README.md`. For compatibility with late import maps, use `src/multiple-import-maps-polyfill/README.md`. Use [assets and browser modules](assets-and-browser-modules.md) for source URLs and HMR; use [component model](component-model.md) for state and lifecycle.

## Contents

- Add interactivity to an existing server path: `clientEntry`
- `run()` also changes navigation, including preserving form error responses
- Support client entries discovered during navigation
- Choose a state refresh mechanism
- Frames and identity
- Rendering and head ownership

## Add Interactivity to an Existing Server Path

A GET should already render the intended page; a POST should already validate, authorize, mutate, and return HTML or a redirect. Keep a real link/form route contract even when adding browser behavior.

Mark the smallest interactive boundary with `clientEntry`. Place its entire browser module graph in allowed source locations, and pass the asset server to render middleware:

```tsx
// app/actions/public/counter.tsx
import { clientEntry, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount: number }>) {
    let count = handle.props.initialCount

    return () => (
      <button
        type="button"
        mix={on('click', () => {
          count++
          handle.update()
        })}
      >
        Count: {count}
      </button>
    )
  },
)
```

Use an explicit `#ExportName` in the entry ID when the module export name differs from the component function's name. Pass serializable values only: supported primitives, plain objects/arrays, and supported JSX/Frame values. Functions, class instances, secrets, and database objects must stay on the server. Read the server README for serialization details.

The component also renders on the server. Put browser-only work in tasks/events/refs, not unguarded module or setup code. Reuse the document's existing browser entry and `run()` call rather than booting a runtime for every widget.

## `run()` Also Changes Navigation

`run()` hydrates entries **and** enhances eligible same-origin links/forms, even without an explicit `<Frame>`. Inspect the existing `resolveFrame` before relying on its behavior.

- Use native `<a href={routes.page.href()}>` and `<form action={routes.form.action.href()}>` elements.
- `data-rmx-document` leaves a link/form to the browser, including its response and download behavior.
- `data-rmx-target` selects a named frame. Use `data-rmx-src`, history, and scroll options only when the UX needs them; the UI README owns their exact semantics.
- Keep real document navigation working before the runtime starts and in browsers without enhancement support.

### Preserve Form Error Responses

An action returning useful HTML with `400`, `403`, `404`, or `422` does not guarantee that the enhanced form will display it. The default `run()` resolver throws on non-OK responses, and the scaffolded `app/actions/public/entry.ts` replaces those bodies with a generic `Frame error: <status>` message.

Choose a policy before removing `data-rmx-document` from a form:

1. **Document submission:** leave the attribute in place. The browser renders the action's response directly.
2. **Enhanced HTML submission:** make the app's `resolveFrame` return the original HTML `Response`, including expected non-2xx statuses. Do not replace validation/auth error bodies with a generic string.

For the second option, keep the existing resolver's request encoding and cancellation handling. Replace its response-handling tail, after `fetch(...)`, with an HTML response policy such as:

```ts
// Inside resolveFrame, after the existing fetch has produced `response`:
let contentType = response.headers.get('Content-Type') ?? ''
if (!/^text\/html(?:;|$)/i.test(contentType)) {
  throw new Error(`Expected an HTML frame response (${response.status})`)
}
return response
```

This deliberately accepts HTML error pages while rejecting unexpected JSON or empty non-HTML responses. Network failures still need the app's error UI/logging policy. Keep server error pages free of internal details.

When writing a resolver from scratch, use the installed UI README's request-encoding example: GET values are in `src`; non-GET forms need their effective method, encoding, `FormData`, and abort signal forwarded. URL-encoded, multipart, and plain-text forms have different body encodings. Do not replace this with an unconditional JSON POST or drop CSRF fields.

Test invalid input and expired authentication with JavaScript both enabled and disabled. For targeted forms, verify that the response updates the intended region and exposes its errors accessibly.

## Support Client Entries Discovered During Navigation

Later frame responses can introduce client entries whose import-map entries were not in the initial document. Inspect the scaffolded browser entry before changing it; current scaffolds already configure this compatibility path.

When the app targets browsers without native multiple-import-map support, configure `run()` to load modules with `importModule` and process late preloads with `detectMultipleImportMapSupport` and `preloadShim` from `remix/multiple-import-maps-polyfill`. Native-capable browsers continue using native imports and modulepreload links. Keep the initial import map before all module scripts, and import the polyfill from the initial browser entry when HMR uses it as `hmr.moduleImporter`.

The polyfill evaluates affected module graphs from blob URLs and compiles a parser from Wasm. Check the package README before changing Content Security Policy or Trusted Types rules; do not enable the polyfill without preserving the required directives.

## Choose a State Refresh Mechanism

| Situation                                                 | Prefer                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| A form already maps to server-rendered HTML               | Native form navigation, optionally targeting a frame                |
| An existing server-rendered region changed                | Reload its frame                                                    |
| A small widget consumes data without shared server markup | A focused JSON endpoint                                             |
| State changes outside this page                           | Polling or another explicit update mechanism appropriate to the app |

Do not build a second client-rendered data model merely to refresh an existing server-rendered region. Conversely, do not force every small JSON consumer into a frame.

For custom fetch-based mutations, check the response before declaring success or reloading a frame. Display validation/auth failures and pass the event's cancellation signal. Avoid `preventDefault()` plus `fetch()` when the native enhanced form already provides the needed behavior.

## Frames and Identity

A `<Frame src={...}>` renders a server-owned region. Without a fallback, server rendering waits for it; with a fallback, the placeholder can stream before the final content. Use route-generated URLs.

Client entries can reload their containing frame with `handle.frame.reload()`, find a named frame through `handle.frames.get(name)`, or reload the document through `handle.frames.top.reload()`. Handle missing named frames rather than asserting they exist.

Frame updates preserve matching client entries and their local state while updating props. State initialized once from a prop will not automatically reset when the prop changes. Read current props in render, derive values when possible, and use deliberate keys/identity when a new instance is wanted.

For third-party widgets that own live DOM, consult the UI README's `data-rmx-preserve-dom` guidance. Preserve the smallest necessary region, not the whole page.

## Rendering and Head Ownership

Use the standard render middleware for internal frame resolution, credential forwarding, redirects, response status, and request cancellation. Do not rebuild those policies with an ad hoc `fetchHtml` helper.

Keep `title`, `meta`, `link`, and styles in the document's explicit `<head>`; bare head-like elements elsewhere are not automatically hoisted. Update the existing document shell rather than creating a competing one. Use low-level `renderToStream`/`renderToString` only for an intentionally custom pipeline.

Verify loading/error states, focus after region changes, navigation history, keyboard operation, and preservation of user-entered input. HMR is a separate development concern; its coordination recipe is in [assets](assets-and-browser-modules.md#development-hmr).
