Follow navigations with the typed `rmx:navigation` event to show pending or optimistic UI. See [following a navigation](https://github.com/remix-run/remix/tree/main/packages/component#following-a-navigation) for details.

```tsx
// Inside a hydrated component:
<button
  type="submit"
  mix={on('rmx:navigation', async (event, signal) => {
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
