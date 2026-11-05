Follow a form's own submissions with `onSubmission(handler, captureBoolean?)`, a typed mixin for the new `rmx:submission` event. It runs when a form submission starts a Remix frame reload, on the submit button or on the form without a submitter, and bubbles through the form. Its `FormSubmissionEvent` shares request details, the `FormData` object, and the `finished` promise with the target frame's `reloadStart`.

```tsx
// Inside a hydrated component:
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
  {saving ? 'Saving…' : 'Save'}
</button>
```

`finished` always resolves with `{ error, aborted }`; cancellation has no error. The handler's signal aborts on another submission or removal. The event extends `SubmitEvent` with `cancelable: false`, so cancel through native `submit`. Links, programmatic reloads or navigations, and document navigations don't emit it. See [following a form submission](https://github.com/remix-run/remix/tree/main/packages/component#following-a-form-submission) for request fields and external-submitter delivery.
