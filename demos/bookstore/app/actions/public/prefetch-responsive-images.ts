// The default asset prefetcher skips srcset because rel=prefetch can't select a candidate.
// Temporary low-priority preloads let the browser use the destination's sizes instead.
export async function prefetchResponsiveImages(
  elements: Iterable<Element>,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted || !document.createElement('link').relList.supports('prefetch')) return

  let requests: Promise<void>[] = []
  for (let element of elements) {
    let srcSet: string
    let sizes: string
    let href: string
    if (element instanceof HTMLImageElement) {
      srcSet = element.srcset
      sizes = element.sizes
      href = element.src
    } else if (element instanceof HTMLLinkElement) {
      srcSet = element.imageSrcset
      sizes = element.imageSizes
      href = element.href
    } else {
      continue
    }
    if (!srcSet) continue

    requests.push(
      new Promise<void>((resolve) => {
        let link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.fetchPriority = 'low'
        link.imageSrcset = srcSet
        link.imageSizes = sizes
        link.href = href
        link.dataset.responsivePrefetch = ''

        function finish() {
          link.remove()
          link.removeEventListener('load', finish)
          link.removeEventListener('error', finish)
          signal.removeEventListener('abort', finish)
          resolve()
        }
        link.addEventListener('load', finish, { once: true })
        link.addEventListener('error', finish, { once: true })
        signal.addEventListener('abort', finish, { once: true })
        document.head.append(link)
      }),
    )
  }
  await Promise.all(requests)
}
