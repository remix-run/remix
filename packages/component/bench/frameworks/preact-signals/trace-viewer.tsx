import { batch, signal, useComputed } from '@preact/signals'
import { countMatches, createTrace, EMPTY_TRACE, spanMatches } from '../shared.ts'
import type { Span } from '../shared.ts'

// Trace tree viewer backed by shared signals. Searching updates the spans whose
// match state changed (leaves deep in the tree) and the root's summary in the
// same tick.

let trace = signal(EMPTY_TRACE)
let query = signal('')
let matchCount = signal(0)

export function loadTrace() {
  batch(() => {
    trace.value = createTrace()
    query.value = ''
    matchCount.value = 0
  })
}

function search(nextQuery: string) {
  batch(() => {
    query.value = nextQuery
    matchCount.value = countMatches(trace.value, nextQuery)
  })
}

function TraceSpan({ span }: { span: Span }) {
  let rowClass = useComputed(() =>
    spanMatches(span, query.value) ? 'trace-row match' : 'trace-row',
  )

  return (
    <div class="trace-span">
      <div class={rowClass}>
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
        <TraceSpan span={trace.value} />
      </div>
    </div>
  )
}
