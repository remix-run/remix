Follow a form's own submissions with `onSubmission()` from `remix/component`, a typed mixin for the `rmx:submission` event. When a GET or POST submission reloads a frame, Remix dispatches a `FormSubmissionEvent` on the submit button, or on the form when there is no submitter, after the target and descendant frames' `reloadStart` events. It bubbles and shares the target frame event's `src`, lowercase `method`, `encType`, `formData`, `element`, `submitter`, and `finished` promise. `element` is always the owning form and `submitter` is the actual submit button or `null`. External or detached submitters receive a non-bubbling event followed by a separate bubbling event on their owning form.

`finished` always resolves with `{ error, aborted }`. Successful reloads and aborted reloads have no error; failures carry an `Error`.

`onSubmission(handler, captureBoolean?)` infers the host element as `event.currentTarget` and passes a signal that aborts on the next submission or mixin removal, as `on()` does.

The event extends the native `SubmitEvent` with `cancelable: false`. Cancel submissions through the native `submit` event; `stopPropagation()` still works on `rmx:submission`. GET submissions encode the entries in `src` and leave `formData` and `encType` null. Links, `navigate()`, `frame.reload()`, and document navigations don't dispatch it.

```tsx
<button
  type="submit"
  mix={onSubmission(async (event, signal) => {
    saving = event
    handle.update()
    await event.finished
    // The button's next submission, or its removal, aborts the signal.
    if (signal.aborted) return
    saving = undefined
    handle.update()
  })}
>
  {saving ? `Saving ${saving.formData?.get('title')}…` : 'Save'}
</button>
```
