function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function flashAttribute(node: HTMLElement, attributeName: string, duration: number) {
  await wait(duration)
  node.setAttribute(attributeName, 'true')

  try {
    await wait(duration)
  } finally {
    node.removeAttribute(attributeName)
  }
}
