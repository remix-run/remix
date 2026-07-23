import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import type { Handle } from '../runtime/component.ts'
import { createFrame, type LoadModule, type ResolveFrameOptions } from '../runtime/frame.ts'
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

  it('passes form submission options to a streaming frame resolver', async () => {
    let resolvedOptions: ResolveFrameOptions | undefined
    let root = document.createElement('div')
    root.innerHTML = '<p>Initial</p>'
    document.body.append(root)
    let frame = createFrame(root, {
      src: 'https://example.com/account',
      errorTarget: new EventTarget(),
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame(_src, options) {
        resolvedOptions = options
        return htmlStream(['<main id="result">Saved</main>'])
      },
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, new EventTarget(), createStyleManager()),
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })
    let formData = new FormData()
    formData.set('displayName', 'Ada')

    try {
      await frame.ready()
      await frame.handle.reload({
        formData,
        method: 'post',
        encType: 'multipart/form-data',
      })

      expect(resolvedOptions?.formData).toBe(formData)
      expect(resolvedOptions?.method).toBe('post')
      expect(resolvedOptions?.encType).toBe('multipart/form-data')
      expect(resolvedOptions?.signal).toBeInstanceOf(AbortSignal)
      expect(document.getElementById('result')?.textContent).toBe('Saved')
    } finally {
      frame.dispose()
    }
  })

  it('aborts the active resolver when the reload signal is aborted', async () => {
    let root = document.createElement('div')
    root.innerHTML = '<p id="initial">Initial</p>'
    document.body.append(root)
    let resolverSignal: AbortSignal | undefined
    let frame = createFrame(root, {
      src: 'https://example.com/account',
      errorTarget: new EventTarget(),
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame(_src, options) {
        resolverSignal = options?.signal
        return new Promise<string>((resolve) => {
          options?.signal?.addEventListener('abort', () => resolve('<p>Aborted</p>'), {
            once: true,
          })
        })
      },
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, new EventTarget(), createStyleManager()),
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })
    let controller = new AbortController()

    try {
      await frame.ready()
      let reload = frame.handle.reload({ signal: controller.signal })
      controller.abort()
      let signal = await reload

      expect(signal.aborted).toBe(true)
      expect(resolverSignal?.aborted).toBe(true)
      expect(document.getElementById('initial')?.textContent).toBe('Initial')
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
