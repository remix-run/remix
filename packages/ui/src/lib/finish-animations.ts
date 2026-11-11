export function finishAnimations(nodes: HTMLElement[]): Promise<void> | undefined {
  // Infinite decorative animations must not keep a closed overlay mounted forever.
  let animations = nodes
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
  if (animations.length === 0) return
  return Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(
    () => {},
  )
}
