# Follow frame navigations with one event

Use `reloadStart` to observe every reload of a frame and `rmx:navigation` to observe accepted navigations, including links, forms, programmatic calls, and history traversal. Both carry the initiating request details directly on the event. `reloadStart.finished` tracks frame rendering; `rmx:navigation`'s `finished` also waits for redirected URL updates and navigation scroll and focus handling. Listen through the existing `on('rmx:navigation', handler, captureBoolean?)` mixin.

## Why an element event

A frame's `reloadStart` also fires for links, programmatic reloads, and reloads of an ancestor frame. Filtering those events for a particular link or form repeats source checks and latest-submission tracking in each component. Checking `source.closest('form')` also mistakes links inside a form for submissions.

Dispatching on the submit button and bubbling through the owning form lets a component listen on the element it renders. The form hears submissions from any of its buttons, while a button hears only its own, including implicit submissions through the form's default button. Without a submitter, the event starts on the form.

External or detached submitters have no event path through their owning form. They receive a non-bubbling event followed by a separate bubbling event on the form. This preserves delivery to both while preventing duplicate bubbling events on shared ancestors. Capture listeners can receive both events.

## Naming and cancellation

`NavigationEvent` extends the native `Event` with `cancelable: false`. Remix metadata lives directly on the event, matching other framework events. `frameTarget` names the destination frame while native `event.target` identifies the DOM dispatch target. The name describes an operation already underway and distinguishes it from native `click` and `submit`, where applications can still prevent navigation. `stopPropagation()` controls delivery without cancelling the reload.

Registering `rmx:navigation` in `GlobalEventHandlersEventMap` gives `on()` a typed event, inferred `currentTarget`, and event-name completion. The existing handler signal aborts on reentry or removal, so a dedicated submission mixin would only hide the event name. `reloadStart` and `reloadComplete` retain their existing names.

## Shared request and origin details

The [reload event contract](https://github.com/remix-run/remix/tree/main/packages/component#following-a-reload) defines `src`, `method`, `encType`, `formData`, `element`, `submitter`, and `finished`. Request fields align with `frame.reload()` options, with `body` exposed as `formData`. The navigation event calls the originally requested frame URL `frameSrc`, including GET entries. For GET requests, `formData` and `encType` are null on `reloadStart` and absent on `rmx:navigation`. Other body formats remain out of scope, and future encodings can have separate `json` or `text` fields.

Both events identify the initiating HTML or SVG anchor, image-map area, or owning form as `element`. `reloadStart.element` is null for programmatic calls and history traversal. `rmx:navigation` starts on the link or submitter, while its `element` identifies the link or owning form. Programmatic navigation and history traversal dispatch on `window` with `element: null`. Its optional `submitter` identifies the actual submit button, including for GET forms. Descendant `reloadStart` events inherit the initiating details while tracking their own completion.

## Completion outcomes

`finished` uses a `Promise<AbortSignal>` like `frame.reload()`. It resolves after rendering and the enclosing navigation, resolves with an aborted signal on cancellation, and rejects with the original failure. Navigation completion follows redirects and scroll and focus handling through the runtime's existing commit coordinator. On success, the signal returned by `finished` stays active after later navigations. Cancellation follows the reload lifecycle, so a resolver that throws `AbortError` without cancellation still rejects. Components can catch failures without inspecting error names.

On success, completion follows the response render and enclosing navigation. Optimistic values can stay applied until the updated props are available, then be cleared in another component render. The handler's signal independently prevents stale updates after another submission or removal.

## Alternatives we considered

- A handle-based state accessor would need another subscription model. Events already provide the submitted data, completion, and moment to update.
- A mixin around `reloadStart`, or an `event.isFrom(form)` method, could hide filtering but would still need source matching and latest-submission tracking. An element event uses the existing event path and reentry signal.
- A resolved `{ error, aborted }` outcome would avoid `try`/`catch` but introduce a second completion contract beside `frame.reload()`. Returning an `AbortSignal` and rejecting on failure keeps the APIs aligned.

## Scope

Every navigation accepted by Remix emits `rmx:navigation`, including programmatic `navigate()` and Back/Forward. Direct `frame.reload()`, `updateUrl()`, initial hydration, and links or forms that fall back to document navigation do not emit it. Dispatch happens synchronously at acceptance, before `reloadStart`. A listener that starts another navigation cancels the previous operation before its frame work begins.

## When to revisit

Revisit this contract if Remix adds mutations outside navigation or the Navigation API gains a way to follow a navigation from its source element.

## Application-wide observation

A window capture listener observes the same `rmx:navigation` before source handlers can stop propagation. The event crosses shadow roots, and disconnected sources notify window directly as well as receiving their local event. External submitters and owning forms can produce multiple capture notifications for the same operation; observers compare `finished` to ignore duplicates. Redirects do not dispatch another event; `to` remains the initial browser destination, and `finished` waits through redirect completion. `navigationType` and `from` match the options passed to `resolveFrame`; `frameSrc` and `frameTarget` correspond to its `src` argument and `target` option. Neither API exposes a native transition completion promise. The browser entry can maintain a userland navigation store without a separate app event, a framework singleton, or reconstructing browser redirect transitions.
