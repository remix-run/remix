# Follow a form's own submissions with an element event

Optimistic UI renders what a submission will produce before the server answers, and replaces it with the server's answer when the reload finishes. A Remix form submission is a navigation: the runtime intercepts the Navigation API's `navigate` event, reloads the target frame with the form's entries, and renders the response. Components need three things from that: the entries the visitor submitted, how the reload ended, and whether the submission was theirs.

`FrameReloadStartEvent` gives every frame the first two. `reloadStart` carries `formData` and `sourceElement` as `NavigateEvent` does, and a `finished` promise that settles as `NavigationTransition.finished` does. We chose to also dispatch a `FormSubmitStartEvent` (`rmx:form-submit-start`) on the submit button, or on the form when no button submitted it, when its submission starts a frame reload. It carries the same three properties and bubbles to the form, so a component listens on the element it renders with `on()`:

```tsx
<button
  type="submit"
  mix={on('rmx:form-submit-start', async (event, signal) => {
    save = event
    failed = false
    handle.update()
    try {
      await event.finished
    } catch (error) {
      failed = !(error instanceof DOMException && error.name === 'AbortError')
    }
    if (signal.aborted) return
    save = undefined
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

An external submitter associated through its `form` attribute, or a submitter removed during submission, has no DOM event path through its owning form. The navigation resolver retains that form. The submitter receives a non-bubbling event, then the form receives a separate bubbling event with the same `sourceElement` and `finished`. This keeps bubbling listeners on shared ancestors from receiving the submission twice. Capture listeners on shared ancestors can receive both events.

## Naming

The name follows the conventions the event sits between:

- Remix's DOM events are `rmx:<owner>-<event>` in kebab case, such as `rmx:tabs-change` and `rmx:menu-select`. Events on Remix's own targets drop the prefix, such as the frame handle's `reloadStart` and the mixin handle's `insert`, but this one goes on DOM elements and into `HTMLElementEventMap`.
- Event types are `<Owner><EventType>Event`, such as `FrameReloadStartEvent`, `MixinInsertEvent`, and `TabsChangeEvent`.
- The verb is the platform's: the form's own event is `submit`. As with `reloadStart`, `Start` marks an event whose `finished` reports the end.

It's an `Event &` type made by `createFormSubmitStartEvent()`, as the component package's other events are, rather than a class like `@remix-run/ui`'s.

## What we kept

`reloadStart`'s `formData`, `sourceElement`, and `finished` stay. They serve components that don't own the form but render what it changes, such as a header's cart count after an "add to cart" form in a book card, and components in child frames that a submission reloads.

## Alternatives we considered

- **A hook-style state accessor**, like React's `useFormStatus()` and `useOptimistic()` or Remix 2's `useNavigation().formData`. Remix 3 components have no hooks. A handle API such as `handle.submissions` would need its own subscription model, where an event already gives the moment of change, the data, and the signal.
- **A mixin that wraps `reloadStart`**, such as `submission(handler)`. It would hide the source check, but it adds a second listener API for something `on()` already expresses, and it can't use the element's own event path.
- **A method on `FrameReloadStartEvent`**, such as `event.isFrom(form)`. It removes the check, but leaves the latest-submission tracking to each component.

## Scope

- It's dispatched for form submissions the runtime handles as frame navigations, both GET and non-GET. `formData` is `null` for GET, as on `NavigateEvent`.
- It's not dispatched when the submission falls back to a document navigation (`data-rmx-document`, another origin, a missing named frame), or without the Navigation API, because the page unloads.
- It's dispatched after the target frame's `reloadStart` and those of the frames inside it, and not when one of those listeners already started a newer reload.
- When an unrelated navigation replaces the submission, `finished` rejects with an `AbortError`. The component shows the previous state until the new page renders whatever the server applied.
- It's opt-in: with no listener, nothing changes.

## When to revisit

1. Remix adds mutations that aren't navigations, such as a `fetch()`-based submit API. Those need the same three properties and may share this event.
2. The Navigation API gains a way to follow a single navigation from its source element.
