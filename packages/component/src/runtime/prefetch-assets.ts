import { pendingPrefetchLinks } from './frame.ts'
import { normalizeSrcset } from './prefetch-srcset.ts'

interface AssetEntry {
  link: HTMLLinkElement
  signals: Set<AbortSignal>
  ready: Promise<void>
  cancel(): void
  finish(): void
  state: 'queued' | 'running' | 'complete'
}

export function createPrefetchAssetQueue(signal: AbortSignal | undefined, concurrency: number) {
  let entries = new Map<string, AssetEntry>()
  let batches: AssetEntry[][] = []
  let active = 0
  let paused = false

  function pump() {
    if (paused || signal?.aborted) return
    while (active < concurrency && batches.length > 0) {
      let batch = batches.shift()
      if (!batch) continue
      let entry = batch.shift()
      if (batch.length > 0) batches.push(batch)
      if (!entry || entry.state !== 'queued') continue
      entry.cancel()
      if (entry.state !== 'queued') continue
      if (!entry.link.relList.supports(entry.link.rel)) {
        entry.finish()
        continue
      }
      entry.state = 'running'
      active++
      pendingPrefetchLinks.add(entry.link)
      document.head.append(entry.link)
    }
  }

  signal?.addEventListener(
    'abort',
    () => {
      for (let entry of entries.values()) entry.finish()
      batches = []
    },
    { once: true },
  )

  return {
    submit(links: HTMLLinkElement[], jobSignal: AbortSignal): Promise<void> {
      if (signal?.aborted || jobSignal.aborted) return Promise.resolve()
      let batch: AssetEntry[] = []
      let requests: Promise<void>[] = []
      for (let link of links) {
        let key = assetKey(link)
        let existing = entries.get(key)
        if (existing) {
          if (!existing.signals.has(jobSignal)) {
            existing.signals.add(jobSignal)
            jobSignal.addEventListener('abort', existing.cancel, { once: true })
          }
          if (existing.state === 'queued') batch.push(existing)
          requests.push(existing.ready)
          continue
        }
        let { promise: ready, resolve } = Promise.withResolvers<void>()
        let entry: AssetEntry = {
          link,
          ready,
          signals: new Set([jobSignal]),
          state: 'queued',
          finish() {
            if (entry.state === 'complete') return
            if (entry.state === 'running') active--
            entry.state = 'complete'
            link.removeEventListener('load', entry.finish)
            link.removeEventListener('error', entry.finish)
            link.remove()
            pendingPrefetchLinks.delete(link)
            entries.delete(key)
            batches = batches
              .map((batch) => batch.filter((candidate) => candidate !== entry))
              .filter((batch) => batch.length > 0)
            for (let subscriber of entry.signals)
              subscriber.removeEventListener('abort', entry.cancel)
            entry.signals.clear()
            resolve()
            // Drain after all completions/cancellations in this turn to avoid reentrant starts.
            queueMicrotask(pump)
          },
          cancel() {
            for (let subscriber of entry.signals) {
              if (!subscriber.aborted) continue
              subscriber.removeEventListener('abort', entry.cancel)
              entry.signals.delete(subscriber)
            }
            if (entry.signals.size === 0) entry.finish()
          },
        }
        link.addEventListener('load', entry.finish)
        link.addEventListener('error', entry.finish)
        jobSignal.addEventListener('abort', entry.cancel, { once: true })
        entries.set(key, entry)
        batch.push(entry)
        requests.push(ready)
      }
      if (batch.length > 0) batches.push(batch)
      pump()
      return Promise.all(requests).then(() => {})
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
      pump()
    },
  }
}

export function createAssetPrefetch(
  element: Element,
  baseURL: string,
): HTMLLinkElement | undefined {
  let image = element instanceof HTMLImageElement
  if (element instanceof HTMLLinkElement) {
    if (
      !element.relList.contains('modulepreload') &&
      !element.relList.contains('stylesheet') &&
      !(
        element.relList.contains('preload') &&
        ['script', 'style', 'image', 'font'].includes(element.as)
      )
    )
      return
    image = element.as === 'image'
    if (element.media && !matchMedia(element.media).matches) return
  } else if (element instanceof HTMLScriptElement) {
    if (
      !['', 'module', 'text/javascript', 'application/javascript'].includes(
        element.type.toLowerCase(),
      )
    )
      return
  } else if (!image) return

  let srcset = image
    ? element.getAttribute(element instanceof HTMLImageElement ? 'srcset' : 'imagesrcset')
    : null
  let normalized = srcset ? normalizeSrcset(srcset, baseURL) : ''
  let href = element.getAttribute(
    element instanceof HTMLScriptElement || element instanceof HTMLImageElement ? 'src' : 'href',
  )
  let url: URL | undefined
  if (href) {
    try {
      url = new URL(href, baseURL)
    } catch {
      /* Invalid fallback URLs are ignored. */
    }
    if (url && url.protocol !== 'http:' && url.protocol !== 'https:') url = undefined
  }
  if (!url && !normalized) return
  let isModule =
    element instanceof HTMLScriptElement
      ? element.type.toLowerCase() === 'module'
      : element instanceof HTMLLinkElement && element.relList.contains('modulepreload')
  let link = document.createElement('link')
  // Responsive choice requires preload: prefetch ignores image source-set attributes.
  link.rel = image && (element instanceof HTMLImageElement || normalized) ? 'preload' : 'prefetch'
  link.fetchPriority = 'low'
  link.as = image ? 'image' : 'script'
  if (element instanceof HTMLLinkElement && !image && !isModule) {
    link.as = element.relList.contains('stylesheet') ? 'style' : element.as
  }
  if (normalized) {
    link.imageSrcset = normalized
    let sizes = element.getAttribute(element instanceof HTMLImageElement ? 'sizes' : 'imagesizes')
    if (sizes !== null) link.imageSizes = sizes
  }
  if (url) link.href = url.href
  for (let name of ['integrity', 'referrerpolicy']) {
    let value = element.getAttribute(name)
    if (value !== null) link.setAttribute(name, value)
  }
  if (element instanceof HTMLLinkElement) {
    for (let name of ['media', 'type']) {
      let value = element.getAttribute(name)
      if (value !== null) link.setAttribute(name, value)
    }
  }
  if (isModule || element.hasAttribute('crossorigin')) {
    link.crossOrigin =
      element.getAttribute('crossorigin')?.toLowerCase() === 'use-credentials'
        ? 'use-credentials'
        : 'anonymous'
  }
  return link
}

export function assetKey(link: HTMLLinkElement): string {
  return JSON.stringify([
    link.rel,
    link.getAttribute('href'),
    link.as,
    link.crossOrigin,
    link.integrity,
    link.referrerPolicy,
    link.imageSrcset,
    link.imageSizes,
    link.media,
    link.type,
  ])
}
