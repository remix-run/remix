import type { createRoot } from '@remix-run/component'

// Browsers dispatch a popover's `toggle` event from a queued task after `beforetoggle`.
const pendingToggles = new Set<Promise<unknown>>()
document.addEventListener(
  'beforetoggle',
  ({ target }) => {
    let toggled = new Promise((resolve) =>
      target!.addEventListener('toggle', resolve, { once: true }),
    )
    pendingToggles.add(toggled)
    void toggled.then(() => pendingToggles.delete(toggled))
  },
  true,
)

export async function settle(root: ReturnType<typeof createRoot>) {
  root.flush()
  while (pendingToggles.size > 0) {
    await Promise.all(pendingToggles)
    root.flush()
  }
}
