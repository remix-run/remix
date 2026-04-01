import { createRoot, type VirtualRoot, type VirtualRootOptions } from '@remix-run/component'
import type { RemixNode } from '@remix-run/component/jsx-runtime'

export function render(
  node: RemixNode,
  opts: { container?: HTMLElement } & VirtualRootOptions = {},
) {
  let { container: userContainer, ...virtualRootOpts } = opts

  let container: HTMLElement | undefined
  if (userContainer) {
    container = userContainer
  } else {
    container = document.createElement('div')
    document.body.appendChild(container)
  }

  let root: VirtualRoot | undefined = createRoot(container, virtualRootOpts)
  root.render(node)
  root.flush()

  let ctx = {
    get container() {
      if (!container) throw new Error('Test container has already been cleaned up')
      return container
    },
    get root() {
      if (!root) throw new Error('Test root has already been cleaned up')
      return root
    },
    $: (s: string) => ctx.container.querySelector<HTMLElement>(s),
    $$: (s: string) => ctx.container.querySelectorAll<HTMLElement>(s),
    async act(fn: () => unknown | Promise<unknown>) {
      await fn()
      ctx.root.flush()
    },
    cleanup() {
      root?.dispose()
      container?.remove()
      container = undefined
      root = undefined
    },
  }

  return ctx
}
