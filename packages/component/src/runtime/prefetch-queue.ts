/** Options for prefetching frame content. */
export interface PrefetchOptions {
  /** Name of the destination frame, sent as `X-Remix-Target` by the default strategy. */
  target?: string
  /** Cancels this caller's queued and running prefetches, including nested frames. */
  signal?: AbortSignal
}

/**
 * Starts loading same-origin frame content so a later navigation can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 * @param options Destination frame and optional cancellation signal.
 */
export type PrefetchFrame = (src: string, options?: PrefetchOptions) => void

/** How a prefetch candidate was discovered. */
export type PrefetchTrigger = 'viewport' | 'intent' | 'imperative' | 'frame'

/** Context supplied to the default prefetch queue's policy callbacks. */
export interface PrefetchContext {
  /** Name of the destination frame, or `undefined` for an unnamed frame. */
  target: string | undefined
  /** Discovery trigger; direct requests take precedence over nested-frame discovery. */
  trigger: PrefetchTrigger
  /** Tracked links owning this request; nested frames inherit their ancestor's links. */
  anchors: readonly HTMLAnchorElement[]
}

/** Policy for Remix's HTML prefetch queue, asset discovery, and nested-frame traversal. */
export interface PrefetchConfig {
  /**
   * Maximum simultaneous HTML fetches through body consumption and parsing (default: 3).
   * Must be a positive safe integer; other values throw `RangeError` when starting the runtime.
   */
  concurrency?: number
  /** Returns `false` to drop a candidate. Re-evaluated when queued policy is invalidated. */
  filter?(src: string, context: PrefetchContext): boolean
  /**
   * Scores candidates, with larger finite numbers starting first and ties in discovery order.
   * Scores are cached until scroll, resize, tracked DOM changes, or `app.invalidatePrefetch()`.
   * By default intent precedes imperative calls, then viewport links; nested frames inherit
   * their parent's score. This callback owns any layout reads needed for position-based ranking.
   */
  priority?(src: string, context: PrefetchContext): number
}

export interface PrefetchOwner {
  anchor?: HTMLAnchorElement
  trigger: Exclude<PrefetchTrigger, 'frame'>
  valid(): boolean
}

interface PrefetchEntry<content> {
  src: string
  options: PrefetchOptions | undefined
  owners: Map<PrefetchOwner, number | undefined>
  controller: AbortController
  ready: Promise<content | undefined>
  resolve(content: content | undefined): void
  state: 'queued' | 'running' | 'complete'
  priority: number
  scored: boolean
  stale: boolean
  generation: number
}

export function validatePrefetchConfig(config: PrefetchConfig): void {
  let concurrency = config.concurrency ?? 3
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError('prefetch.concurrency must be a positive integer')
  }
}

export function createPrefetchQueue<content>(
  signal: AbortSignal | undefined,
  config: PrefetchConfig,
  load: (
    src: string,
    options: PrefetchOptions | undefined,
    signal: AbortSignal,
  ) => Promise<content | undefined>,
) {
  validatePrefetchConfig(config)
  let concurrency = config.concurrency ?? 3
  let entries = new Map<string, PrefetchEntry<content>>()
  let active = 0
  let scheduled = false
  let paused = false
  let generation = 0

  function schedule() {
    if (scheduled || signal?.aborted) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      pump()
    })
  }

  function discard(entry: PrefetchEntry<content>) {
    let key = JSON.stringify([entry.src, entry.options?.target])
    if (entries.get(key) === entry) entries.delete(key)
    entry.controller.abort()
    entry.resolve(undefined)
  }

  function prune() {
    let valid = new Map<PrefetchOwner, boolean>()
    for (let entry of entries.values()) {
      for (let owner of entry.owners.keys()) {
        let eligible = valid.get(owner) ?? owner.valid()
        valid.set(owner, eligible)
        if (!eligible) {
          entry.owners.delete(owner)
          entry.stale = true
        }
      }
      if (entry.owners.size === 0) discard(entry)
    }
  }

  function score(entry: PrefetchEntry<content>): boolean {
    let anchors = new Set<HTMLAnchorElement>()
    let trigger: PrefetchTrigger = 'frame'
    let priority = -Infinity
    let ranks = { viewport: 0, imperative: 1, intent: 2, frame: -1 }
    for (let [owner, inherited] of entry.owners) {
      if (owner.anchor) anchors.add(owner.anchor)
      if (inherited === undefined && ranks[owner.trigger] > ranks[trigger]) trigger = owner.trigger
      priority = Math.max(priority, inherited ?? ranks[owner.trigger])
    }
    let context: PrefetchContext = { target: entry.options?.target, trigger, anchors: [...anchors] }
    try {
      if (config.filter && !config.filter(entry.src, context)) return false
      let value = config.priority?.(entry.src, context) ?? priority
      entry.priority = Number.isFinite(value) ? value : 0
      entry.scored = true
      entry.stale = false
      entry.generation = generation
      return true
    } catch {
      // A failed speculative policy must not prevent a later navigation.
      return false
    }
  }

  function pump() {
    prune()
    if (paused || signal?.aborted) return
    let queued: PrefetchEntry<content>[] = []
    for (let entry of entries.values()) {
      if (entry.state !== 'queued') continue
      // New candidates get a score even when all slots are busy. Refresh older scores only
      // when we can launch work, so a stream of scroll events does not repeatedly read layout.
      if (
        (!entry.scored ||
          ((entry.stale || entry.generation !== generation) && active < concurrency)) &&
        !score(entry)
      ) {
        discard(entry)
        continue
      }
      queued.push(entry)
    }
    if (active >= concurrency) return
    queued.sort((a, b) => b.priority - a.priority)
    for (let entry of queued) {
      if (active >= concurrency) break
      entry.state = 'running'
      active++
      void load(entry.src, entry.options, entry.controller.signal)
        .then(
          (content) => {
            entry.state = 'complete'
            entry.resolve(entry.controller.signal.aborted ? undefined : content)
          },
          () => {
            entry.state = 'complete'
            entry.resolve(undefined)
          },
        )
        .finally(() => {
          active--
          schedule()
        })
    }
  }

  signal?.addEventListener(
    'abort',
    () => {
      for (let entry of entries.values()) discard(entry)
    },
    { once: true },
  )

  return {
    read(
      src: string,
      options: PrefetchOptions | undefined,
      owner: PrefetchOwner,
      inherited?: number,
    ) {
      if (signal?.aborted || !owner.valid()) return
      let key = JSON.stringify([src, options?.target])
      let entry = entries.get(key)
      if (!entry) {
        let { promise, resolve } = Promise.withResolvers<content | undefined>()
        entry = {
          src,
          options,
          ready: promise,
          resolve,
          owners: new Map(),
          controller: new AbortController(),
          state: 'queued',
          priority: 0,
          scored: false,
          stale: true,
          generation: -1,
        }
        entries.set(key, entry)
      }
      entry.owners.set(owner, inherited)
      entry.stale = true
      schedule()
      return entry
    },
    release(entry: PrefetchEntry<content>, owner: PrefetchOwner) {
      entry.owners.delete(owner)
      entry.stale = true
      if (entry.owners.size === 0) discard(entry)
    },
    prune() {
      prune()
      schedule()
    },
    invalidate() {
      generation++
      schedule()
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
      this.invalidate()
    },
  }
}
