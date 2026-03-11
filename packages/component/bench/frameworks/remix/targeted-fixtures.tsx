import {
  Frame,
  createMixin,
  createRangeRoot,
  on,
  ref,
  type FrameContent,
  type Handle,
} from '@remix-run/component'

import type { Row } from '../shared.ts'

let hiddenFixtureStyle = {
  position: 'absolute',
  left: '-10000px',
  top: '-10000px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
}

let benchFrameVersion = 0

let persistUntilReclaimed = createMixin((handle) => {
  handle.addEventListener('beforeRemove', (event) => {
    event.persistNode(
      (signal) =>
        new Promise<void>((resolve) => {
          if (signal.aborted) {
            resolve()
            return
          }

          signal.addEventListener('abort', () => resolve(), { once: true })
        }),
    )
  })
})

export let benchFrameInit = {
  src: '/',
  resolveFrame(src: string): FrameContent {
    if (src === '/bench/frame') {
      return renderBenchFrameHtml(benchFrameVersion)
    }

    return `<div data-frame-src="${src}">Unsupported frame source</div>`
  },
}

function events(handlers: Record<string, (...args: any[]) => void>) {
  return Object.entries(handlers).map(([type, handler]) => on(type as any, handler as any))
}

function makeBenchRows(count: number, prefix: string): Row[] {
  let rows = new Array<Row>(count)
  for (let index = 0; index < count; index++) {
    rows[index] = {
      id: index + 1,
      label: `${prefix}-${String(index + 1).padStart(4, '0')}`,
    }
  }
  return rows
}

function denseReorderRows(rows: Row[]): Row[] {
  let firstHalf: Row[] = []
  let secondHalf: Row[] = []

  for (let index = 0; index < rows.length; index++) {
    if (index % 2 === 0) {
      firstHalf.push(rows[index])
    } else {
      secondHalf.push(rows[index])
    }
  }

  return [...secondHalf, ...firstHalf]
}

function renderBenchFrameHtml(version: number): string {
  let items = Array.from({ length: 40 }, (_, index) => {
    return `<li data-frame-item="${index}">frame-${version}-${index}</li>`
  }).join('')

  return `<section id="frameReloadStableContent" data-version="${version}"><h2>frame-${version}</h2><ul>${items}</ul></section>`
}

function getRangeRootPayload(stage: number) {
  if (stage === 0) {
    return (
      <>
        <div key="range-alpha">alpha</div>
        <div key="range-beta">beta</div>
        <p key="range-tail">tail</p>
      </>
    )
  }

  return (
    <>
      <span key="range-head">head</span>
      <div key="range-beta">beta-updated</div>
      <span key="range-gamma">gamma</span>
      <strong key="range-tail">tail-updated</strong>
    </>
  )
}

function KeyedMoveDenseFixture(handle: Handle) {
  let initialRows = makeBenchRows(400, 'dense')
  let rows = initialRows
  let reordered = false

  function reset() {
    rows = initialRows
    reordered = false
    handle.update()
  }

  function reorder() {
    rows = reordered ? initialRows : denseReorderRows(initialRows)
    reordered = !reordered
    handle.update()
  }

  return () => (
    <section id="keyedMoveDenseFixture">
      <button id="resetKeyedMoveDense" mix={events({ click: reset })}>
        reset keyed move
      </button>
      <button id="keyedMoveDense" mix={events({ click: reorder })}>
        keyed move dense
      </button>
      <ul id="keyedMoveDenseList">
        {rows.map((row) => (
          <li key={row.id} data-row-id={row.id}>
            {row.label}
          </li>
        ))}
      </ul>
    </section>
  )
}

function FragmentPrependFixture(handle: Handle) {
  let prependCount = 0

  function reset() {
    prependCount = 0
    handle.update()
  }

  function prepend() {
    prependCount = 60
    handle.update()
  }

  return () => (
    <section id="fragmentPrependFixture">
      <button id="resetFragmentPrepend" mix={events({ click: reset })}>
        reset fragment prepend
      </button>
      <button id="fragmentPrepend" mix={events({ click: prepend })}>
        fragment prepend
      </button>
      <div id="fragmentPrependTarget">
        <>
          {Array.from({ length: prependCount }, (_, index) => (
            <span key={`fragment-prepend-${index}`} data-fragment-index={index}>
              prepended-{index}
            </span>
          ))}
        </>
        <span id="fragmentPrependTail">tail</span>
      </div>
    </section>
  )
}

function RangeRootPatchFixture(handle: Handle) {
  let stage = 0
  let nestedRoot: ReturnType<typeof createRangeRoot> | null = null
  let markers: [Comment, Comment] | null = null

  function renderStage() {
    nestedRoot?.render(getRangeRootPayload(stage))
    nestedRoot?.flush()
  }

  function reset() {
    stage = 0
    renderStage()
  }

  function patch() {
    stage = stage === 0 ? 1 : 0
    renderStage()
  }

  return () => (
    <section id="rangeRootPatchFixture">
      <button id="resetRangeRootPatch" mix={events({ click: reset })}>
        reset range root patch
      </button>
      <button id="rangeRootPatch" mix={events({ click: patch })}>
        range root patch
      </button>
      <div
        id="rangeRootPatchHost"
        mix={[
          ref((node, signal) => {
            if (!(node instanceof HTMLDivElement)) return

            let start = document.createComment(' bench:range:start ')
            let end = document.createComment(' bench:range:end ')
            node.append(start, end)

            markers = [start, end]
            nestedRoot = createRangeRoot(markers)
            renderStage()

            signal.addEventListener(
              'abort',
              () => {
                nestedRoot?.dispose()
                nestedRoot = null
                start.remove()
                end.remove()
                markers = null
              },
              { once: true },
            )
          }),
        ]}
      />
    </section>
  )
}

function FrameReloadStableFixture(handle: Handle) {
  function reset() {
    benchFrameVersion = 0
    void handle.frames.get('bench-frame')?.replace(renderBenchFrameHtml(benchFrameVersion))
  }

  function reloadStable() {
    benchFrameVersion++
    void handle.frames.get('bench-frame')?.reload()
  }

  return () => (
    <section id="frameReloadStableFixture">
      <button id="resetFrameReloadStable" mix={events({ click: reset })}>
        reset frame reload stable
      </button>
      <button id="frameReloadStable" mix={events({ click: reloadStable })}>
        frame reload stable
      </button>
      <Frame name="bench-frame" src="/bench/frame" fallback={<div>Loading bench frame...</div>} />
    </section>
  )
}

function PersistedHostReclaimFixture(handle: Handle) {
  let visible = true

  function reset() {
    visible = true
    handle.update()
  }

  function removePersisted() {
    visible = false
    handle.update()
  }

  function reclaim() {
    visible = true
    handle.update()
  }

  return () => (
    <section id="persistedHostReclaimFixture">
      <button id="resetPersistedHostReclaim" mix={events({ click: reset })}>
        reset persisted host reclaim
      </button>
      <button id="removePersistedHost" mix={events({ click: removePersisted })}>
        remove persisted host
      </button>
      <button id="persistedHostReclaim" mix={events({ click: reclaim })}>
        reclaim persisted host
      </button>
      <div id="persistedHostReclaimTarget">
        {visible ? (
          <div
            key="persisted-host"
            id="persistedHostNode"
            mix={[persistUntilReclaimed()]}
            data-persisted="true"
          >
            persisted-host
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function TargetedBenchFixtures() {
  return () => (
    <div id="targetedBenchFixtures" aria-hidden="true" style={hiddenFixtureStyle}>
      <KeyedMoveDenseFixture />
      <FragmentPrependFixture />
      <RangeRootPatchFixture />
      <FrameReloadStableFixture />
      <PersistedHostReclaimFixture />
    </div>
  )
}
