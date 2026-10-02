import { batch, createMemo, createSignal, For } from 'solid-js'
import { countMatches, createTrace, EMPTY_TRACE, spanMatches } from '../shared.ts'
import type { Span } from '../shared.ts'

// Trace tree viewer backed by shared signals. Searching updates the spans whose
// match state changed (leaves deep in the tree) and the root's summary in the
// same tick.

let [trace, setTrace] = createSignal(EMPTY_TRACE)
let [query, setQuery] = createSignal('')
let [matchCount, setMatchCount] = createSignal(0)

export function loadTrace() {
  batch(() => {
    setTrace(createTrace())
    setQuery('')
    setMatchCount(0)
  })
}

function search(nextQuery: string) {
  batch(() => {
    setQuery(nextQuery)
    setMatchCount(countMatches(trace(), nextQuery))
  })
}

function TraceSpan(props: { span: Span }) {
  let matched = createMemo(() => spanMatches(props.span, query()))

  return (
    <div class="trace-span">
      <div class={matched() ? 'trace-row match' : 'trace-row'}>
        <span class="trace-name">{props.span.name}</span>
        <span class="trace-bar" style={{ width: `${props.span.duration}px` }} />
        <small>{props.span.duration}ms</small>
      </div>
      <div class="trace-children">
        <For each={props.span.children}>{(child) => <TraceSpan span={child} />}</For>
      </div>
    </div>
  )
}

export function TraceViewer(props: { onExit: () => void }) {
  return (
    <div class="container">
      <div class="trace-viewer-toolbar">
        <button id="switchFromTraceViewer" class="btn btn-primary" onClick={props.onExit}>
          Back
        </button>
        <button id="traceViewerSearch" class="btn btn-primary" onClick={() => search('db.')}>
          Search "db."
        </button>
        <span>Query: "{query()}"</span>
        <span class="trace-viewer-matches">{matchCount()} matches</span>
      </div>
      <div class="trace-viewer">
        <TraceSpan span={trace()} />
      </div>
    </div>
  )
}
