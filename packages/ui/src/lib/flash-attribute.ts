function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function flashAttribute(node: HTMLElement, attributeName: string, duration: number) {
  node.setAttribute(attributeName, 'true')
  await wait(duration)
  node.removeAttribute(attributeName)
}
