import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import type { Handle } from '../runtime/component.ts'
import { createFrame, type LoadModule } from '../runtime/frame.ts'
import { jsx } from '../runtime/jsx.ts'
import { createScheduler } from '../runtime/scheduler.ts'
import { appendFlushMarker } from '../runtime/stream-protocol.ts'
import { createStyleManager } from '../style/index.ts'

describe('frame reloads', () => {
  afterEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>'
  })

  it('preserves hydrated client entries while streaming a top frame reload', async () => {
    let setupCount = 0
    let disconnectCount = 0

    function StreamingEntry(handle: Handle<{ label: string }>) {
      setupCount++
      handle.signal.addEventListener('abort', () => {
        disconnectCount++
      })

      return () => jsx('section', { 'data-entry': '', children: handle.props.label })
    }

    document.documentElement.innerHTML = [
      '<head><title>Initial</title></head>',
      '<body>',
      '<main>',
      '<!-- rmx:h:h1 -->',
      '<section data-entry="">initial</section>',
      '<!-- /rmx:h -->',
      '</main>',
      rmxDataScript('initial'),
      '</body>',
    ].join('')

    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let scheduler = createScheduler(document, errorTarget, styleManager)
    let loadModule = ((moduleUrl: string, exportName: string) => {
      expect(moduleUrl).toBe('/entry.js')
      expect(exportName).toBe('StreamingEntry')
      return StreamingEntry
    }) satisfies LoadModule

    let frame = createFrame(document, {
      src: 'https://example.com/initial',
      errorTarget,
      loadModule,
      resolveFrame() {
        return htmlStream([
          '<!doctype html><html><head><title>Next</title></head>',
          [
            '<body><main>',
            '<!-- rmx:h:h1 -->',
            '<section data-entry="">next</section>',
            '<!-- /rmx:h -->',
            rmxDataScript('next'),
            appendFlushMarker('</main></body></html>', 'document'),
          ].join(''),
        ])
      },
      pendingClientEntries: new Map(),
      scheduler,
      styleManager,
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    try {
      await frame.ready()
      expect(document.querySelector('[data-entry]')?.textContent).toBe('initial')
      let setupCountBeforeReload = setupCount
      let disconnectCountBeforeReload = disconnectCount

      await frame.handle.reload()

      expect(document.querySelector('[data-entry]')?.textContent).toBe('next')
      expect(setupCount).toBe(setupCountBeforeReload)
      expect(disconnectCount).toBe(disconnectCountBeforeReload)
    } finally {
      frame.dispose()
    }
  })
})

describe('frame disposal', () => {
  afterEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>'
  })

  it('disposes a frame whose nested frame end marker is outside its region', async () => {
    // A frame region can be truncated while its parent region is replaced, which
    // leaves a nested frame start marker inside the region and its end marker
    // outside of it. Region scans must keep moving forward instead of restarting
    // and hanging the page.
    let outerStart = document.createComment(' rmx:f:outer ')
    let innerStart = document.createComment(' rmx:f:inner ')
    let innerContent = document.createElement('p')
    innerContent.textContent = 'inner'
    // The outer end marker comes first, so the nested range escapes the region.
    let outerEnd = document.createComment(' /rmx:f ')
    let innerEnd = document.createComment(' /rmx:f ')
    document.body.append(outerStart, innerStart, innerContent, outerEnd, innerEnd)

    let scans = countMarkerScans(innerStart, 500)
    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let scheduler = createScheduler(document, errorTarget, styleManager)

    let frame = createFrame([outerStart, outerEnd], {
      src: 'https://example.com/outer',
      errorTarget,
      loadModule: () => () => null,
      resolveFrame: () => '',
      pendingClientEntries: new Map(),
      scheduler,
      styleManager,
      data: { f: { inner: { status: 'resolved', src: 'https://example.com/inner' } } },
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    await frame.ready()
    frame.dispose()

    expect(scans.count).toBeLessThan(500)
  })
})

/**
 * Counts reads of a marker's comment data, throwing once a scan limit is passed
 * so a rescan loop fails the test instead of hanging the run.
 */
function countMarkerScans(marker: Comment, limit: number): { count: number } {
  let data = marker.data
  let scans = { count: 0 }

  Object.defineProperty(marker, 'data', {
    get() {
      scans.count++
      if (scans.count > limit) {
        throw new Error(`Marker read ${limit} times; the frame region scan is looping`)
      }
      return data
    },
    set(next: string) {
      data = next
    },
  })

  return scans
}

function rmxDataScript(label: string): string {
  let data = {
    h: {
      h1: {
        moduleUrl: '/entry.js',
        exportName: 'StreamingEntry',
        props: { label },
      },
    },
  }

  return `<script type="application/json" id="rmx-data">${JSON.stringify(data)}</script>`
}

function htmlStream(chunks: string[]): ReadableStream<Uint8Array> {
  let encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      for (let chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}
