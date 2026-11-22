import { clientEntry, css, on, type Handle } from 'remix/component'

import { routes } from '../../routes.ts'

export interface SpeedHudProps {
  techniques: boolean
  latency: number
  latencyOptions: readonly number[]
}

type LoadSource = 'network' | 'revalidated' | 'cache' | 'pending' | 'unknown'

const loadSources: LoadSource[] = ['network', 'revalidated', 'cache', 'pending', 'unknown']

interface LoadRecord {
  kind: 'document' | 'frame'
  path: string
  duration: number
  source: LoadSource
  prefetched: boolean
  transferSize: number
}

interface PendingNavigation {
  url: string
  startTime: number
  record?: LoadRecord
}

const storageKey = 'speed-hud-records'
const maxRecords = 6

/**
 * Shows how long each navigation took and where its HTML came from: the network, a `304 Not
 * Modified` revalidation, or the browser's HTTP cache. Records survive full document loads in
 * `sessionStorage` so you can compare runs with the speed techniques on and off.
 */
export const SpeedHud = clientEntry(
  import.meta.url,
  function SpeedHud(handle: Handle<SpeedHudProps>) {
    let expanded = true
    let records: LoadRecord[] = []
    let pending: PendingNavigation | undefined

    function addRecord(record: LoadRecord) {
      records = [record, ...records].slice(0, maxRecords)
      saveRecords(records)
      handle.update()
    }

    function settle(navigation: PendingNavigation, entry: PerformanceResourceTiming) {
      if (navigation.record == null) return
      navigation.record.source = classifyEntry(entry)
      navigation.record.transferSize = entry.transferSize
      navigation.record.prefetched = wasPrefetched(navigation.url, navigation.startTime)
      saveRecords(records)
      handle.update()
    }

    handle.queueTask(() => {
      records = loadRecords()
      recordDocumentLoad(addRecord)

      let signal = handle.signal
      // Frame navigations never clear resource timings the way document loads do, so make room for
      // more than the default 250 entries.
      performance.setResourceTimingBufferSize(500)

      let observer = new PerformanceObserver((list) => {
        for (let entry of list.getEntries()) {
          if (!(entry instanceof PerformanceResourceTiming)) continue
          if (pending?.record == null || entry.name !== pending.url) continue
          if (entry.startTime < pending.startTime) continue
          settle(pending, entry)
          pending = undefined
        }
      })
      observer.observe({ type: 'resource', buffered: false })
      signal.addEventListener('abort', () => observer.disconnect())

      window.navigation?.addEventListener(
        'navigate',
        (event) => {
          // Measure page loads only. Form submissions and back/forward traversals are not page
          // loads that prefetching or caching could have sped up.
          if (!event.canIntercept || event.hashChange || event.formData != null) return
          if (event.navigationType !== 'push' && event.navigationType !== 'replace') return
          let url = new URL(event.destination.url)
          url.hash = ''
          pending = { url: url.href, startTime: performance.now() }
        },
        { signal },
      )

      window.navigation?.addEventListener(
        'navigatesuccess',
        () => {
          if (pending == null) return
          let url = new URL(pending.url)
          pending.record = {
            kind: 'frame',
            path: url.pathname + url.search,
            duration: performance.now() - pending.startTime,
            source: 'pending',
            prefetched: false,
            transferSize: 0,
          }
          addRecord(pending.record)

          let navigation = pending
          let entry = findResourceEntry(navigation.url, navigation.startTime)
          if (entry) {
            settle(navigation, entry)
            pending = undefined
            return
          }

          // Some browsers do not report timings for every request. Stop waiting after a moment.
          setTimeout(() => {
            if (signal.aborted || navigation.record?.source !== 'pending') return
            navigation.record.source = 'unknown'
            saveRecords(records)
            handle.update()
          }, 2000)
        },
        { signal },
      )
    })

    return () => {
      let { techniques, latency, latencyOptions } = handle.props
      let [latest, ...earlier] = records

      return (
        <aside aria-label="Speed HUD" mix={hudStyle}>
          <div mix={hudHeaderStyle}>
            <strong>Speed HUD</strong>
            <button
              type="button"
              aria-expanded={expanded}
              mix={[
                hudToggleStyle,
                on('click', () => {
                  expanded = !expanded
                  handle.update()
                }),
              ]}
            >
              {expanded ? 'Hide' : 'Show'}
            </button>
          </div>

          {expanded ? (
            <div mix={hudBodyStyle}>
              {latest ? (
                <LoadSummary record={latest} />
              ) : (
                <p mix={mutedStyle}>Waiting for the first page load…</p>
              )}

              {earlier.length > 0 ? (
                <ol mix={historyStyle}>
                  {earlier.map((record, index) => (
                    <li key={index}>
                      <span mix={pathStyle}>{record.path}</span>
                      <span>{formatDuration(record.duration)}</span>
                      <span mix={mutedStyle}>{describeSource(record)}</span>
                    </li>
                  ))}
                </ol>
              ) : null}

              <form method="post" action={routes.settings.href()} data-rmx-document mix={formStyle}>
                <fieldset mix={fieldsetStyle}>
                  <legend>Speed techniques</legend>
                  <label>
                    <input type="radio" name="techniques" value="on" defaultChecked={techniques} />{' '}
                    On
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="techniques"
                      value="off"
                      defaultChecked={!techniques}
                    />{' '}
                    Off
                  </label>
                </fieldset>
                <label mix={latencyLabelStyle}>
                  Simulated latency
                  <select name="latency">
                    {latencyOptions.map((option) => (
                      <option key={option} value={String(option)} selected={option === latency}>
                        {option} ms
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" mix={applyButtonStyle}>
                  Apply
                </button>
              </form>
            </div>
          ) : null}
        </aside>
      )
    }
  },
)

function LoadSummary(handle: Handle<{ record: LoadRecord }>) {
  return () => {
    let { record } = handle.props

    return (
      <div mix={summaryStyle}>
        <div mix={summaryRowStyle}>
          <span mix={durationStyle}>{formatDuration(record.duration)}</span>
          <span mix={badgeStyle} data-source={record.source}>
            {describeSource(record)}
          </span>
        </div>
        <div mix={pathStyle}>{record.path}</div>
        <div mix={mutedStyle}>
          {record.kind === 'document' ? 'Full document load' : 'Content frame swap'} ·{' '}
          {formatBytes(record.transferSize)} transferred
        </div>
      </div>
    )
  }
}

function recordDocumentLoad(addRecord: (record: LoadRecord) => void) {
  let read = () => {
    let [entry] = performance.getEntriesByType('navigation')
    if (!(entry instanceof PerformanceNavigationTiming)) return

    addRecord({
      kind: 'document',
      path: location.pathname + location.search,
      duration: entry.domContentLoadedEventEnd - entry.startTime,
      source: classifyEntry(entry),
      prefetched: false,
      transferSize: entry.transferSize,
    })
  }

  if (document.readyState === 'complete') read()
  else window.addEventListener('load', read, { once: true })
}

function findResourceEntry(url: string, startTime: number): PerformanceResourceTiming | undefined {
  return performance
    .getEntriesByName(url, 'resource')
    .filter((entry) => entry instanceof PerformanceResourceTiming)
    .findLast((entry) => entry.startTime >= startTime)
}

// Intent prefetching starts 100ms into a hover, so a request for the same URL shortly before the
// click is almost certainly the prefetch rather than an earlier visit.
function wasPrefetched(url: string, startTime: number): boolean {
  return performance
    .getEntriesByName(url, 'resource')
    .some((entry) => entry.startTime < startTime && startTime - entry.startTime < 10_000)
}

function classifyEntry(entry: PerformanceResourceTiming): LoadSource {
  if (entry.transferSize === 0 && entry.decodedBodySize > 0) return 'cache'
  // A 304 transfers only headers, so fewer bytes cross the wire than the cached body contains.
  if (entry.transferSize > 0 && entry.transferSize < entry.encodedBodySize) return 'revalidated'
  return 'network'
}

function describeSource(record: LoadRecord): string {
  let source = {
    network: 'Network',
    revalidated: '304 revalidated',
    cache: 'HTTP cache',
    pending: 'Measuring…',
    unknown: 'Unknown source',
  }[record.source]

  return record.prefetched ? `Prefetched · ${source}` : source
}

function formatDuration(duration: number): string {
  return `${Math.round(duration)} ms`
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

function loadRecords(): LoadRecord[] {
  try {
    let value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(value)) return []

    // A record still measuring when the page unloaded will never finish.
    return value
      .filter(isLoadRecord)
      .map((record) => (record.source === 'pending' ? { ...record, source: 'unknown' } : record))
  } catch {
    return []
  }
}

function saveRecords(records: LoadRecord[]) {
  sessionStorage.setItem(storageKey, JSON.stringify(records))
}

function isLoadRecord(value: unknown): value is LoadRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value.kind === 'document' || value.kind === 'frame') &&
    'path' in value &&
    typeof value.path === 'string' &&
    'duration' in value &&
    typeof value.duration === 'number' &&
    'source' in value &&
    loadSources.some((source) => source === value.source) &&
    'prefetched' in value &&
    typeof value.prefetched === 'boolean' &&
    'transferSize' in value &&
    typeof value.transferSize === 'number'
  )
}

const hudStyle = css({
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: 10,
  width: '19rem',
  borderRadius: '6px',
  backgroundColor: '#1f2328',
  color: '#f6f7f8',
  fontSize: '12px',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.25)',
})

const hudHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0.75rem',
})

const hudToggleStyle = css({
  border: 0,
  background: 'none',
  color: '#c9cdd2',
  font: 'inherit',
  cursor: 'pointer',
  textDecoration: 'underline',
})

const hudBodyStyle = css({
  display: 'grid',
  gap: '0.6rem',
  padding: '0 0.75rem 0.75rem',
})

const summaryStyle = css({ display: 'grid', gap: '0.2rem' })

const summaryRowStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.5rem',
})

const durationStyle = css({
  fontSize: '1.6rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
})

const badgeStyle = css({
  borderRadius: '3px',
  padding: '0.05rem 0.4rem',
  backgroundColor: '#5c6670',
  fontWeight: 600,
  '&[data-source="cache"]': { backgroundColor: '#1d7a46' },
  '&[data-source="revalidated"]': { backgroundColor: '#8a6d00' },
  '&[data-source="network"]': { backgroundColor: '#b42318' },
})

const pathStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
})

const mutedStyle = css({ margin: 0, color: '#aab1b8' })

const historyStyle = css({
  display: 'grid',
  gap: '0.15rem',
  margin: 0,
  padding: '0.5rem 0 0',
  borderTop: '1px solid #3b4148',
  listStyle: 'none',
  '& li': {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    columnGap: '0.5rem',
  },
  '& li > :last-child': { gridColumn: '1 / -1' },
})

const formStyle = css({
  display: 'grid',
  gap: '0.5rem',
  paddingTop: '0.5rem',
  borderTop: '1px solid #3b4148',
})

const fieldsetStyle = css({
  display: 'flex',
  gap: '0.75rem',
  margin: 0,
  padding: 0,
  border: 0,
  '& legend': { float: 'left', marginRight: '0.25rem' },
})

const latencyLabelStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

const applyButtonStyle = css({
  justifySelf: 'start',
  border: 0,
  borderRadius: '3px',
  padding: '0.25rem 0.75rem',
  backgroundColor: '#ffd200',
  color: '#1f2328',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
})
