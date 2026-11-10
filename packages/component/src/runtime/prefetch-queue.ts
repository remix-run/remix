import type { PrefetchConfig, PrefetchLink, PrefetchOptions, PrefetchTrigger } from './prefetch.ts'

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
  readonly priority: number
}

const ranks = { viewport: 0, imperative: 1, intent: 2, frame: -1 }

function getPriority<content>(entry: PrefetchEntry<content>): number {
  let priority = -Infinity
  for (let [owner, inherited] of entry.owners)
    priority = Math.max(priority, inherited ?? ranks[owner.trigger])
  return priority
}

export function validatePrefetchConfig(config: PrefetchConfig): void {
  for (let name of ['links', 'assets'] as const) {
    let limit = config[name]?.concurrency
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
      throw new RangeError(`prefetch.${name}.concurrency must be a positive safe integer`)
    }
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
  let concurrency = config.links?.concurrency ?? 3
  let entries = new Map<string, PrefetchEntry<content>>()
  let order: PrefetchEntry<content>[] = []
  let generation = 0
  let stale = true
  let active = 0
  let scheduled = false
  let paused = false

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
          if (entry.state === 'queued') {
            stale = true
            generation++
          }
        }
      }
      if (entry.owners.size === 0) discard(entry)
    }
  }

  function select() {
    let selectedGeneration = generation
    let candidates = new Map<PrefetchLink, PrefetchEntry<content>>()
    for (let entry of entries.values()) {
      if (entry.state !== 'queued') continue
      let anchors = new Set<HTMLAnchorElement>()
      let trigger: PrefetchTrigger = 'frame'
      for (let [owner, inherited] of entry.owners) {
        if (owner.anchor) anchors.add(owner.anchor)
        if (inherited === undefined && ranks[owner.trigger] > ranks[trigger])
          trigger = owner.trigger
      }
      candidates.set(
        Object.freeze({
          src: entry.src,
          target: entry.options?.target,
          trigger,
          anchors: Object.freeze([...anchors]),
        }),
        entry,
      )
    }
    let batch = [...candidates.keys()]
    let selected: readonly PrefetchLink[] = []
    try {
      selected = config.links?.scheduler
        ? config.links.scheduler(Object.freeze(batch))
        : batch.sort(
            (a, b) => (candidates.get(b)?.priority ?? 0) - (candidates.get(a)?.priority ?? 0),
          )
      selected = Array.isArray(selected) ? Array.from(selected) : []
    } catch {
      selected = []
      // Speculative policy failures leave navigation independent.
    }
    order = []
    let included = new Set<PrefetchEntry<content>>()
    for (let candidate of selected) {
      let entry = candidates.get(candidate)
      if (!entry || included.has(entry)) continue
      included.add(entry)
      order.push(entry)
    }
    for (let entry of candidates.values()) {
      if (!included.has(entry)) discard(entry)
    }
    stale = selectedGeneration !== generation
  }

  function pump() {
    prune()
    if (paused || signal?.aborted || active >= concurrency) return
    if (stale) select()
    if (stale) {
      schedule()
      return
    }
    while (!paused && !signal?.aborted && active < concurrency && order.length > 0) {
      let entry = order.shift()
      if (!entry || entry.state !== 'queued' || entry.controller.signal.aborted) continue
      prune()
      if (entry.controller.signal.aborted) continue
      // A selector can change owners synchronously. Refresh its remaining batch before starting.
      if (stale) {
        select()
        continue
      }
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
      order = []
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
          get priority() {
            return getPriority(this)
          },
        }
        entries.set(key, entry)
      }
      if (!entry.owners.has(owner) || entry.owners.get(owner) !== inherited) {
        entry.owners.set(owner, inherited)
        if (entry.state === 'queued') {
          stale = true
          generation++
        }
      }
      schedule()
      return entry
    },
    release(entry: PrefetchEntry<content>, owner: PrefetchOwner) {
      entry.owners.delete(owner)
      if (entry.state === 'queued') {
        stale = true
        generation++
      }
      if (entry.owners.size === 0) discard(entry)
    },
    prune() {
      prune()
      schedule()
    },
    invalidate() {
      generation++
      stale = true
      schedule()
    },
    pause() {
      paused = true
    },
    resume() {
      prune()
      paused = false
      this.invalidate()
    },
  }
}
