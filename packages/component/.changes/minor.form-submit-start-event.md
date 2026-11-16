Follow a form's submissions with the typed `rmx:submission` event to show pending or optimistic UI. See [following a form submission](https://github.com/remix-run/remix/tree/main/packages/component#following-a-form-submission) for details.

```tsx
// Inside a hydrated component:
<button
  type="submit"
  mix={on('rmx:submission', async (event, signal) => {
    saving = true
    handle.update()
    await event.finished.catch(console.error)
    if (signal.aborted) return
    saving = false
    handle.update()
  })}
>
  {saving ? 'Saving…' : 'Save'}
</button>
```
