export function waitForCssTransition(
  node: HTMLElement,
  signal: AbortSignal,
  action: () => void,
) {
  return new Promise<void>((resolve) => {
    function finish(event: TransitionEvent) {
      if (event.target !== node) {
        return
      }

      node.removeEventListener('transitionend', finish)
      node.removeEventListener('transitioncancel', finish)
      resolve()
    }

    node.addEventListener('transitionend', finish, { signal })
    node.addEventListener('transitioncancel', finish, { signal })
    action()
  })
}
