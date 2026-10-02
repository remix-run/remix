import { useSyncExternalStore } from 'preact/compat'
import { search, spanMatches, traceStore } from '../shared.ts'
import type { Span, TraceState } from '../shared.ts'

export { loadTrace } from '../shared.ts'

// Trace tree viewer backed by a shared store. Searching updates the spans whose
// match state changed (leaves deep in the tree) and the root in the same tick.

// Re-renders the component when its slice changes, like Zustand's `useStore`
function useStore<T>(selector: (state: TraceState) => T): T {
  return useSyncExternalStore(traceStore.subscribe, () => selector(traceStore.getState()))
}

function TraceSpan({ span }: { span: Span }) {
  let matched = useStore((state) => spanMatches(span, state.query))

  return (
    <div class="trace-span">
      <div class={matched ? 'trace-row match' : 'trace-row'}>
        <span class="trace-name">{span.name}</span>
        <span class="trace-bar" style={{ width: `${span.duration}px` }} />
        <small>{span.duration}ms</small>
      </div>
      <div class="trace-children">
        {span.children.map((child) => (
          <TraceSpan key={child.id} span={child} />
        ))}
      </div>
    </div>
  )
}

export function TraceViewer({ onExit }: { onExit: () => void }) {
  // The root shows the query summary, so it re-renders along with every matched span below it
  let trace = useStore((state) => state.trace)
  let query = useStore((state) => state.query)
  let matchCount = useStore((state) => state.matchCount)

  return (
    <div class="container">
      <div class="trace-viewer-toolbar">
        <button id="switchFromTraceViewer" class="btn btn-primary" onClick={onExit}>
          Back
        </button>
        <button id="traceViewerSearch" class="btn btn-primary" onClick={() => search('db.')}>
          Search "db."
        </button>
        <span>Query: "{query}"</span>
        <span class="trace-viewer-matches">{matchCount} matches</span>
      </div>
      <div class="trace-viewer">
        <TraceSpan span={trace} />
      </div>
    </div>
  )
}
