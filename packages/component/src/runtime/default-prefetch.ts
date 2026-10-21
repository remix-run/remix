/** Options for prefetching frame content. */
export interface PrefetchOptions {
  /** Name of the destination frame, sent as `X-Remix-Target` by the default strategy. */
  target?: string
}

const pendingAssetLinks = new WeakSet<Node>()

export function isPendingPrefetchLink(node: Node): boolean {
  return pendingAssetLinks.has(node)
}

export function createDefaultPrefetch(
  signal?: AbortSignal,
): (src: string, options?: PrefetchOptions) => Promise<void> {
  let pending = new Map<string, Promise<void>>()
  let assets = new Map<string, Promise<void>>()

  function prefetchAsset(link: HTMLLinkElement, activeAssets: Set<string>): Promise<void> {
    let key = assetKey(link)
    let existing = assets.get(key)
    if (existing) return existing
    if (activeAssets.has(key) || !link.relList.supports('prefetch')) return Promise.resolve()

    let ready = new Promise<void>((resolve) => {
      function finish() {
        link.remove()
        pendingAssetLinks.delete(link)
        assets.delete(key)
        signal?.removeEventListener('abort', finish)
        resolve()
      }
      link.addEventListener('load', finish, { once: true })
      link.addEventListener('error', finish, { once: true })
      signal?.addEventListener('abort', finish, { once: true })
      pendingAssetLinks.add(link)
      document.head.append(link)
    })
    assets.set(key, ready)
    return ready
  }

  function discoverAssets(
    source: DocumentFragment,
    baseUrl: string,
    activeAssets: Set<string>,
  ): Promise<void[]> {
    let requests: Promise<void>[] = []
    for (let element of source.querySelectorAll('link[href], script[src], template')) {
      if (element instanceof HTMLTemplateElement) {
        requests.push(discoverAssets(element.content, baseUrl, activeAssets).then(() => {}))
      } else {
        let link = createAssetPrefetch(element, baseUrl)
        if (link) requests.push(prefetchAsset(link, activeAssets))
      }
    }
    return Promise.all(requests)
  }

  async function discover(src: string, options?: PrefetchOptions): Promise<void> {
    try {
      let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
      if (options?.target != null) headers.set('X-Remix-Target', options.target)
      let response = await fetch(src, {
        method: 'GET',
        mode: 'same-origin',
        priority: 'low',
        headers,
        signal,
      })
      if (
        !response.ok ||
        !response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
      ) {
        await response.body?.cancel()
        return
      }
      let html = await response.text()
      if (signal?.aborted) return
      // Template contents stay inert, including scripts, styles, and nested frame templates.
      let template = document.createElement('template')
      template.innerHTML = html
      let responseUrl = response.url || src
      let baseUrl = responseUrl
      let base = template.content.querySelector('base[href]')?.getAttribute('href')
      if (base != null) {
        try {
          baseUrl = new URL(base, responseUrl).href
        } catch {
          // An invalid base falls back to the response URL, as it would in a document.
        }
      }
      let activeAssets = new Set<string>()
      for (let element of document.querySelectorAll('link[href], script[src]')) {
        let link = createAssetPrefetch(element, element.baseURI)
        if (link) activeAssets.add(assetKey(link))
      }
      await discoverAssets(template.content, baseUrl, activeAssets)
    } catch {
      // Speculative failures leave navigation to the default resolver.
    }
  }

  return function prefetch(src, options) {
    if (signal?.aborted) return Promise.resolve()
    let key = JSON.stringify([src, options?.target])
    let existing = pending.get(key)
    if (existing) return existing
    let ready = discover(src, options).finally(() => pending.delete(key))
    pending.set(key, ready)
    return ready
  }
}

function createAssetPrefetch(element: Element, baseUrl: string): HTMLLinkElement | undefined {
  if (element instanceof HTMLLinkElement) {
    if (
      !element.relList.contains('modulepreload') &&
      !element.relList.contains('stylesheet') &&
      !(
        element.relList.contains('preload') &&
        ['script', 'style', 'image', 'font'].includes(element.as)
      )
    ) {
      return
    }
    // Prefetch hints cannot select a responsive candidate from imagesrcset.
    if (element.as === 'image' && element.imageSrcset) return
    if (
      ['image', 'font'].includes(element.as) &&
      element.media &&
      !matchMedia(element.media).matches
    ) {
      return
    }
  } else if (element instanceof HTMLScriptElement) {
    if (
      !['', 'module', 'text/javascript', 'application/javascript'].includes(
        element.type.toLowerCase(),
      )
    ) {
      return
    }
  } else {
    return
  }
  let href = element.getAttribute(element instanceof HTMLScriptElement ? 'src' : 'href')
  if (!href) return
  let url: URL
  try {
    url = new URL(href, baseUrl)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  let isModule =
    element instanceof HTMLScriptElement
      ? element.type.toLowerCase() === 'module'
      : element.relList.contains('modulepreload')
  let link = document.createElement('link')
  // Ordinary prefetches don't evaluate modules or resolve their imports in the current import map.
  link.rel = 'prefetch'
  link.fetchPriority = 'low'
  link.as = 'script'
  if (element instanceof HTMLLinkElement && !isModule) {
    link.as = element.relList.contains('stylesheet') ? 'style' : element.as
  }
  link.href = url.href
  for (let name of ['integrity', 'referrerpolicy']) {
    let value = element.getAttribute(name)
    if (value !== null) link.setAttribute(name, value)
  }
  if (isModule || element.hasAttribute('crossorigin')) {
    link.crossOrigin =
      element.getAttribute('crossorigin')?.toLowerCase() === 'use-credentials'
        ? 'use-credentials'
        : 'anonymous'
  }
  return link
}

function assetKey(link: HTMLLinkElement): string {
  return JSON.stringify([link.href, link.as, link.crossOrigin, link.integrity, link.referrerPolicy])
}
