# Follow a form's own submissions with an element event

Use `reloadStart` to observe every reload of a frame and `rmx:submission` to observe the form submissions that start one. Both carry the initiating request details and share the target frame's `finished` promise. The typed `onSubmission(handler, captureBoolean?)` mixin follows the same signature and reentry behavior as `on()`.

## Why an element event

A frame's `reloadStart` also fires for links, programmatic reloads, and reloads of an ancestor frame. Filtering those events for a particular form repeats source checks and latest-submission tracking in each component. Checking `source.closest('form')` also mistakes links inside a form for submissions.

Dispatching on the submit button and bubbling through the owning form lets a component listen on the element it renders. The form hears submissions from any of its buttons, while a button hears only its own, including implicit submissions through the form's default button. Without a submitter, the event starts on the form.

External or detached submitters have no event path through their owning form. They receive a non-bubbling event followed by a separate bubbling event on the form. This preserves delivery to both while preventing duplicate bubbling events on shared ancestors. Capture listeners can receive both events.

## Naming and cancellation

`FormSubmissionEvent` extends the native `SubmitEvent` with `cancelable: false`. The name describes an operation already underway and distinguishes it from native `submit`, where applications can still prevent submission. `stopPropagation()` controls delivery without cancelling the reload.

`onSubmission()` wraps `on('rmx:submission', handler, captureBoolean)`, preserving inferred `currentTarget` types and the signal aborted on reentry or removal. `reloadStart` and `reloadComplete` retain their existing names.

## Shared request and origin details

The [reload event contract](https://github.com/remix-run/remix/tree/main/packages/component#following-a-reload) defines `src`, `method`, `encType`, `formData`, `element`, `submitter`, and `finished`. Request fields align with `frame.reload()` options, with `body` exposed as `formData`. GET entries are encoded in `src`; `formData` and `encType` are null. Other body formats remain out of scope, and future encodings can have separate `json` or `text` fields.

On `reloadStart`, `element` is an `HTMLAnchorElement`, `HTMLAreaElement`, or `HTMLFormElement`, and is null for programmatic calls and history traversal. On `rmx:submission`, the origin is always a form, so `form: HTMLFormElement` replaces `element` for convenient access without narrowing. Both events' `submitter` identifies the actual submit button or is null. This avoids the ambiguity of the Navigation API's `sourceElement`, which can identify either a form or its button. Descendant frame events inherit the initiating details while tracking their own completion.

## Completion outcomes

`finished` follows the existing `frame.reload()` contract as a `Promise<AbortSignal>`. It resolves after rendering, resolves with an aborted signal on cancellation, and rejects with the original failure. This gives event listeners and imperative callers the same completion API. Cancellation follows the reload lifecycle, so a resolver that throws `AbortError` without cancellation still rejects. Components can catch failures without inspecting error names.

On success, completion follows the response render. Optimistic values can stay applied until the updated props are available, then be cleared in another component render. The handler's signal independently prevents stale updates after another submission or removal.

## Alternatives we considered

- A handle-based state accessor would need another subscription model. Events already provide the submitted data, completion, and moment to update.
- A mixin around `reloadStart`, or an `event.isFrom(form)` method, could hide filtering but would still need source matching and latest-submission tracking. An element event uses the existing event path and reentry signal.
- A resolved `{ error, aborted }` outcome would avoid `try`/`catch` but introduce a second completion contract beside `frame.reload()`. Returning an `AbortSignal` and rejecting on failure keeps the APIs aligned.

## Scope

Only native form submissions that start Remix frame reloads emit `rmx:submission`. Links, direct `frame.reload()` and `navigate()` calls, and forms that fall back to document navigation do not emit it. Dispatch follows the target and descendant frames' `reloadStart` events and is suppressed if a listener has already started a newer reload.

## When to revisit

Revisit this contract if Remix adds mutations outside navigation or the Navigation API gains a way to follow a navigation from its source element.
