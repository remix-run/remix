Wait for frame navigation to finish with `navigation.settled()`. Components rendered by a navigation can run their queued tasks before the navigation resets scroll and focus, so a task that scrolls or changes the URL there can be undone or cancel the navigation. Awaiting `navigation.settled()` first runs that work once no navigation is in progress, after redirects are followed and scroll and focus are reset or restored. It also waits for navigations that start while it waits, resolves right away when nothing is navigating or frame navigation is unavailable, and never rejects.

```tsx
import { navigation } from '@remix-run/component'

handle.queueTask(async () => {
  await navigation.settled()
  if (handle.signal.aborted) return
  document.getElementById('reviews')?.scrollIntoView()
})
```
