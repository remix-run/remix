import { on } from "remix/component";
import type { Handle } from "remix/component";
import { search, spanMatches, traceStore } from '../shared.ts'
import type { Span } from '../shared.ts'

export { loadTrace } from '../shared.ts'

// Trace tree viewer backed by a shared store. Searching updates the spans whose
// match state changed (leaves deep in the tree) and the root in the same tick.

function TraceSpan(handle: Handle<{ span: Span }>) {
  let isMatch = () => spanMatches(handle.props.span, traceStore.getState().query)
  let matched = isMatch()
  traceStore.addEventListener(
    'change',
    () => {
      if (isMatch() === matched) return
      matched = !matched
      handle.update()
    },
    { signal: handle.signal },
  )

  return () => {
    let { span } = handle.props
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
}

export function TraceViewer(handle: Handle<{ onExit: () => void }>) {
  // The root shows the query summary, so the batch holds it plus every matched leaf below it
  traceStore.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => {
    let { trace, query, matchCount } = traceStore.getState()
    return (
      <div class="container">
        <div class="trace-viewer-toolbar">
          <button
            id="switchFromTraceViewer"
            class="btn btn-primary"
            mix={[on('click', handle.props.onExit)]}
          >
            Back
          </button>
          <button
            id="traceViewerSearch"
            class="btn btn-primary"
            mix={[on('click', () => search('db.'))]}
          >
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
}
