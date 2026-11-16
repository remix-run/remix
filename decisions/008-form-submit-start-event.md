# Follow links and forms with an element event

Use `reloadStart` to observe every reload of a frame and `rmx:navigation` to observe the links and form submissions that start one. Both carry the initiating request details and share the target frame's `finished` promise. Listen through the existing `on('rmx:navigation', handler, captureBoolean?)` mixin.

## Why an element event

A frame's `reloadStart` also fires for links, programmatic reloads, and reloads of an ancestor frame. Filtering those events for a particular link or form repeats source checks and latest-submission tracking in each component. Checking `source.closest('form')` also mistakes links inside a form for submissions.

Dispatching on the submit button and bubbling through the owning form lets a component listen on the element it renders. The form hears submissions from any of its buttons, while a button hears only its own, including implicit submissions through the form's default button. Without a submitter, the event starts on the form.

External or detached submitters have no event path through their owning form. They receive a non-bubbling event followed by a separate bubbling event on the form. This preserves delivery to both while preventing duplicate bubbling events on shared ancestors. Capture listeners can receive both events.

## Naming and cancellation

`NavigationEvent` extends the native `Event` with `cancelable: false`. The name describes an operation already underway and distinguishes it from native `click` and `submit`, where applications can still prevent navigation. `stopPropagation()` controls delivery without cancelling the reload.

Registering `rmx:navigation` in `GlobalEventHandlersEventMap` gives `on()` a typed event, inferred `currentTarget`, and event-name completion. The existing handler signal aborts on reentry or removal, so a dedicated submission mixin would only hide the event name. `reloadStart` and `reloadComplete` retain their existing names.

## Shared request and origin details

The [reload event contract](https://github.com/remix-run/remix/tree/main/packages/component#following-a-reload) defines `src`, `method`, `encType`, `formData`, `element`, `submitter`, and `finished`. Request fields align with `frame.reload()` options, with `body` exposed as `formData`. The navigation event calls the requested frame URL `frameSrc`; GET entries are encoded in that URL; `formData` and `encType` are null on `reloadStart` and absent on `rmx:navigation`. Other body formats remain out of scope, and future encodings can have separate `json` or `text` fields.

Both events identify the initiating HTML or SVG anchor, image-map area, or owning form as `element`. `reloadStart.element` is null for programmatic calls and history traversal. `rmx:navigation` starts on the link or submitter, but its `element` always identifies the link or owning form. Its optional `submitter` identifies the actual submit button, including for GET forms. Descendant frame events inherit the initiating details while tracking their own completion.

## Completion outcomes

`finished` follows the existing `frame.reload()` contract as a `Promise<AbortSignal>`. It resolves after rendering, resolves with an aborted signal on cancellation, and rejects with the original failure. This gives event listeners and imperative callers the same completion API. Cancellation follows the reload lifecycle, so a resolver that throws `AbortError` without cancellation still rejects. Components can catch failures without inspecting error names.

On success, completion follows the response render. Optimistic values can stay applied until the updated props are available, then be cleared in another component render. The handler's signal independently prevents stale updates after another submission or removal.

## Alternatives we considered

- A handle-based state accessor would need another subscription model. Events already provide the submitted data, completion, and moment to update.
- A mixin around `reloadStart`, or an `event.isFrom(form)` method, could hide filtering but would still need source matching and latest-submission tracking. An element event uses the existing event path and reentry signal.
- A resolved `{ error, aborted }` outcome would avoid `try`/`catch` but introduce a second completion contract beside `frame.reload()`. Returning an `AbortSignal` and rejecting on failure keeps the APIs aligned.

## Scope

Only links and native form submissions that start Remix frame reloads emit `rmx:navigation`. Direct `frame.reload()` and `navigate()` calls, and links or forms that fall back to document navigation do not emit it. Dispatch follows the target and descendant frames' `reloadStart` events and is suppressed if a listener has already started a newer reload.

## When to revisit

Revisit this contract if Remix adds mutations outside navigation or the Navigation API gains a way to follow a navigation from its source element.
