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
