Add `navigation`, which reports the frame navigation Remix is handling and lets components wait for it to finish (see #12051).

```ts
import { navigation } from '@remix-run/component'

navigation.supported // whether links, forms, and navigate() use frame navigation in this browser
navigation.current // the navigation in progress, or null
await navigation.settled() // resolves once nothing is navigating
navigation.addEventListener('change', listener) // navigation.current changed
```

`navigation.current` describes the navigation in progress with its `url`, `type`, `target` frame, form `submission`, and a `signal` that aborts if another navigation replaces it or it fails. It's set as soon as Remix intercepts a navigation and keeps the same object through frame redirects, so it can drive pending UI such as a progress bar, a submitting form, or a loading named frame.

Components rendered by a navigation can run their queued tasks before the navigation resets scroll and focus, so a task that scrolls or changes the URL there can be undone or interrupt the navigation. Await `navigation.settled()` first. It waits through redirects, navigations that start while it waits, and navigations other code intercepts, resolves right away when nothing is navigating, and never rejects.

```tsx
handle.queueTask(async () => {
  await navigation.settled()
  if (handle.signal.aborted) return
  document.getElementById('reviews')?.scrollIntoView()
})
```
