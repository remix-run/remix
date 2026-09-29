export interface Benchmark {
  run(): void
  teardown(): void
}

export interface Framework {
  name: string
  insert: () => Benchmark
  // swap: Benchmark
  // update: Benchmark
  // replace: Benchmark
}

export type Row = { id: number; label: string }

let idCounter = 1

const A = [
    'pretty',
    'large',
    'big',
    'small',
    'tall',
    'short',
    'long',
    'handsome',
    'plain',
    'quaint',
    'clean',
    'elegant',
    'easy',
    'angry',
    'crazy',
    'helpful',
    'mushy',
    'odd',
    'unsightly',
    'adorable',
    'important',
    'inexpensive',
    'cheap',
    'expensive',
    'fancy',
  ],
  C = [
    'red',
    'yellow',
    'blue',
    'green',
    'pink',
    'brown',
    'purple',
    'brown',
    'white',
    'black',
    'orange',
  ],
  N = [
    'table',
    'chair',
    'house',
    'bbq',
    'desk',
    'car',
    'pony',
    'cookie',
    'sandwich',
    'burger',
    'pizza',
    'mouse',
    'keyboard',
  ]

export function buildData(count: number) {
  let data = new Array(count)

  for (let i = 0; i < count; i++) {
    // Use deterministic selection based on index to ensure same data every time
    data[i] = {
      id: idCounter++,
      label: `${A[i % A.length]} ${C[i % C.length]} ${N[i % N.length]}`,
    }
  }

  return data
}

export function get1000Rows(): Row[] {
  return buildData(1000)
}

export function get10000Rows(): Row[] {
  return buildData(10000)
}

export function updatedEvery10thRow(data: Row[]): Row[] {
  let newData = data.slice(0)
  for (let i = 0, d = data, len = d.length; i < len; i += 10) {
    newData[i] = { id: data[i].id, label: data[i].label + ' !!!' }
  }
  return newData
}

export function swapRows(data: Row[]): Row[] {
  let d = data.slice()
  if (d.length > 998) {
    let tmp = d[1]
    d[1] = d[998]
    d[998] = tmp
  }
  return d
}

export function remove(data: Row[], id: number): Row[] {
  return data.filter((d) => d.id !== id)
}

export function sortRows(data: Row[], ascending: boolean = true): Row[] {
  let sorted = data.slice().sort((a, b) => {
    if (ascending) {
      return a.label.localeCompare(b.label)
    } else {
      return b.label.localeCompare(a.label)
    }
  })
  return sorted
}

export type Span = { id: number; name: string; duration: number; children: Span[] }

// Like real traces, leaves are I/O calls and inner spans are resolvers/services,
// so searching for I/O hits non-nested spans deep below the root.
const INNER_NAMES = ['resolve.field', 'render.template', 'auth.check', 'service.call']
const LEAF_NAMES = [...Array(6).fill('db.query'), ...Array(3).fill('http.get'), 'cache.get']

// Attach chains of 1..maxChain spans to random existing spans, capped at maxDepth.
// Each chain ends with `fanout` sibling leaves (N+1 query pattern).
export function buildTrace(
  count: number,
  maxChain: number,
  maxDepth: number,
  fanout: number,
): Span {
  let seed = 42
  let rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let root: Span = { id: 0, name: 'GET /api/orders', duration: 100, children: [] }
  let all = [{ span: root, depth: 0 }]
  while (all.length < count) {
    let parent = all[Math.floor(rand() * all.length)]
    let length = 1 + Math.floor(rand() * maxChain)
    for (let i = 0; i < length + fanout - 1 && parent.depth < maxDepth && all.length < count; i++) {
      let chainEnd = i >= length - 1 ? parent : null
      let span: Span = {
        id: all.length,
        name: '',
        duration: Math.floor(rand() * 100),
        children: [],
      }
      parent.span.children.push(span)
      all.push({ span, depth: parent.depth + 1 })
      parent = chainEnd ?? all[all.length - 1]
    }
  }
  for (let { span } of all.slice(1)) {
    let names = span.children.length > 0 ? INNER_NAMES : LEAF_NAMES
    span.name = names[Math.floor(rand() * names.length)]
  }
  return root
}

export function spanMatches(span: Span, query: string): boolean {
  return query !== '' && span.name.includes(query)
}

export function countMatches(span: Span, query: string): number {
  let count = spanMatches(span, query) ? 1 : 0
  for (let child of span.children) count += countMatches(child, query)
  return count
}

// Minimal vanilla store with the same API as Zustand's `createStore`. It is also
// an EventTarget, so listeners can be removed with an AbortSignal.
export function createStore<T extends object>(initialState: T) {
  let state = initialState
  let store = Object.assign(new EventTarget(), {
    getState: () => state,
    setState(partial: Partial<T>) {
      state = { ...state, ...partial }
      store.dispatchEvent(new Event('change'))
    },
    subscribe(listener: () => void) {
      store.addEventListener('change', listener)
      return () => store.removeEventListener('change', listener)
    },
  })
  return store
}

// Placeholder until a trace is loaded
export const EMPTY_TRACE: Span = { id: 0, name: '', duration: 0, children: [] }

export type TraceState = {
  trace: Span
  query: string
  matchCount: number
}

export let traceStore = createStore<TraceState>({
  trace: EMPTY_TRACE,
  query: '',
  matchCount: 0,
})

export function createTrace(): Span {
  return buildTrace(5000, 150, 250, 1000)
}

export function loadTrace() {
  traceStore.setState({
    trace: createTrace(),
    query: '',
    matchCount: 0,
  })
}

export function search(query: string) {
  let { trace } = traceStore.getState()
  traceStore.setState({ query, matchCount: countMatches(trace, query) })
}
