# Follow a form's own submissions with an element event

Optimistic UI renders what a submission will produce before the server answers, and replaces it with the server's answer when the reload finishes. A Remix form submission is a navigation: the runtime intercepts the Navigation API's `navigate` event, reloads the target frame with the form's entries, and renders the response. Components need three things from that: the entries the visitor submitted, how the reload ended, and whether the submission was theirs.

`FrameReloadStartEvent` gives every frame the first two. We extend `reloadStart` and also dispatch a `FormSubmissionEvent` (`rmx:submission`) on the submit button, or on the form when no button submitted it, when its submission starts a frame reload. Both events carry the initiating reload's `src`, lowercase effective `method`, normalized `encType`, `formData`, `element`, `submitter`, and a `finished` promise that always resolves with `{ error, aborted }`. The DOM event bubbles to the form, so a component listens on the element it renders with `onSubmission()`:

```tsx
<button
  type="submit"
  mix={onSubmission(async (event, signal) => {
    saving = true
    failed = false
    handle.update()
    let { error } = await event.finished
    if (signal.aborted) return
    saving = false
    failed = error !== undefined
    handle.update()
  })}
>
```

## Why the frame event wasn't enough

A frame's `reloadStart` fires for every reload of the frame: other forms, links (including links inside the form), `frame.reload()`, and reloads an ancestor frame starts. A component that only wants its own form's submissions has to filter them, then track which of its submissions is the latest so an older one finishing doesn't clear a newer one's state. The README's `SaveStatus` example and the bookstore's `SaveButton` each repeated the same check:

```tsx
let submitted = source === form || (source != null && 'form' in source && source.form === form)
```

Each copy is a chance to get it wrong, for example by testing `source.closest('form') === form`, which matches links inside the form.

## Why an element event

Remix already has both halves of the answer:

- **Element events dispatched by Remix**, such as `@remix-run/ui`'s `TabsChangeEvent` (`rmx:tabs-change`), typed through `HTMLElementEventMap` and listened to with `on()`.
- **`on()`'s reentry signal**, which aborts when the same element receives the next event of that type (`packages/component/src/runtime/mixins/on-mixin.ts`). That is "a newer submission of this form replaced mine".

Dispatching on the submitter and bubbling to the form means a submit button hears only its own submissions, including implicit ones, whose submitter is the form's [default button](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission). The form hears all of its own submissions, including `requestSubmit()` and `form.submit()` without a submitter. Links never dispatch it, so a link inside the form can't be mistaken for a submission.

An external submitter associated through its `form` attribute, or a submitter removed during submission, has no DOM event path through its owning form. The navigation resolver retains that form. The submitter receives a non-bubbling event, then the form receives a separate bubbling event with the same request details, `element`, `submitter`, and `finished`. This keeps bubbling listeners on shared ancestors from receiving the submission twice. Capture listeners on shared ancestors can receive both events.

## Naming

`onSubmission(handler, captureBoolean?)` wraps `on('rmx:submission', handler, captureBoolean)`. It hides the event name, types the handler as `FormSubmissionEvent`, infers the host as `event.currentTarget`, and retains `on()`'s reentry and removal behavior. Native `on('submit', handler)` remains available for interception.

`rmx:submission` uses the platform's verb with Remix's DOM-event prefix. Its public type is `FormSubmissionEvent`, created as a native `SubmitEvent` with the shared reload details. The frame event keeps the existing `reloadStart` name and `reloadComplete` remains available.

The event is noncancelable. Native `submit` remains the place to intercept or cancel a submission. `rmx:submission` reports a reload that has started, so `preventDefault()` has no effect. `stopPropagation()` still controls event delivery. Extending `SubmitEvent` gives listeners its native nullable `submitter` property without introducing another cancellation mechanism.

## Shared request and origin details

`element` identifies the initiating anchor or area for a link, or the owning form for a submission. Programmatic reloads, programmatic navigations, and history traversal use `null`. `submitter` identifies the actual submit button, including one captured before it is detached, or is `null`. This replaces the event payload's `sourceElement`, whose Navigation API meaning could be either a form or its button.

For a button submission, the DOM event's `target` is the button, `element` is its owning form, and `submitter` is the button. The matching frame event's `target` is the frame. Their effective request fields match and they share the same `FormData` object and `finished` promise. Descendant frames inherit the initiating request and origin metadata while tracking their own reload completion.

The request fields align with `frame.reload()` options, with `body` exposed as `formData`. GET entries are encoded in `src`, and `formData` and `encType` are `null`. POST exposes the submitted entries and effective encoding. Other body formats remain out of scope; future encodings can use separate `json` or `text` fields.

## Completion outcomes

Both events share a `Promise<FrameReloadOutcome>` that never rejects. It resolves with `{ error: undefined, aborted: false }` after rendering, `{ error, aborted: false }` after failure, or `{ error: undefined, aborted: true }` after cancellation, supersession, or frame removal. The runtime classifies cancellation from the reload lifecycle, so components do not inspect error names. An `AbortError` thrown by a resolver without cancelling the reload is still a failure.

Failures preserve an `Error` object. Other thrown values are wrapped in an `Error` with the original value as its `cause`, so even `throw undefined` produces a distinguishable failure. The promise returned by `frame.reload()` retains its existing rejection behavior. The handler's signal still handles reentry and removal independently of the reload's outcome.

## Alternatives we considered

- **A hook-style state accessor**, like React's `useFormStatus()` and `useOptimistic()` or Remix 2's `useNavigation().formData`. Remix 3 components have no hooks. A handle API such as `handle.submissions` would need its own subscription model, where an event already gives the moment of change, the data, and the signal.
- **A mixin that wraps `reloadStart`**, such as `submission(handler)`. It would hide the source check, but it adds a second listener API for something `on()` already expresses, and it can't use the element's own event path.
- **A method on `FrameReloadStartEvent`**, such as `event.isFrom(form)`. It removes the check, but leaves the latest-submission tracking to each component.

## Scope

- It's dispatched for form submissions the runtime handles as frame navigations, both GET and non-GET. `formData` is `null` for GET, as on `NavigateEvent`.
- It's not dispatched when the submission falls back to a document navigation (`data-rmx-document`, another origin, a missing named frame), or without the Navigation API, because the page unloads.
- It's dispatched after the target frame's `reloadStart` and those of the frames inside it, and not when one of those listeners already started a newer reload.
- When an unrelated navigation replaces the submission, `finished` resolves with `aborted: true` and no error. The component shows the previous state until the new page renders whatever the server applied.
- It's opt-in: with no listener, nothing changes.

## When to revisit

1. Remix adds mutations that aren't navigations, such as a `fetch()`-based submit API. Those need request and lifecycle details and may share this event.
2. The Navigation API gains a way to follow a single navigation from its source element.
