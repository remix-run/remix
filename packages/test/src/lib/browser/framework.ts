import { createRoot } from '@remix-run/component'
import type { RemixNode } from '@remix-run/component/jsx-runtime'

export function render(node: RemixNode) {
  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  return {
    container,
    root,
    $: (s: string) => container.querySelector<HTMLElement>(s),
    $$: (s: string) => container.querySelectorAll<HTMLElement>(s),
    async act(fn: () => unknown | Promise<unknown>) {
      await fn()
      root.flush()
    },
    cleanup() {
      root.dispose()
      container.remove()
    },
  }
}
