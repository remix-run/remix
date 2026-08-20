import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import type { Handle } from '../runtime/component.ts'
import {
  consumeFrameTemplate,
  createFrame,
  publishFrameTemplate,
  reloadFrameForNavigation,
  type LoadModule,
  type ResolveFrameOptions,
} from '../runtime/frame.ts'
import { jsx } from '../runtime/jsx.ts'
import { createScheduler } from '../runtime/scheduler.ts'
import { appendFlushMarker } from '../runtime/stream-protocol.ts'
import { getDocumentModulePreloader } from '../runtime/module-preloader.ts'
import { createStyleManager } from '../style/index.ts'
import { withResolvers } from './utils.ts'

const managedModulePreloadSelector = 'link[data-rmx-module-preload][rel="modulepreload"]'

describe('frames', () => {
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
    let data = {}

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
      data,
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    try {
      await frame.ready()
      expect(data).toEqual({})
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

  it('releases pending hydration metadata when its frame is disposed', async () => {
    document.body.innerHTML = [
      '<!-- rmx:h:h1 -->',
      '<section data-entry="">initial</section>',
      '<!-- /rmx:h -->',
      rmxDataScript('initial'),
    ].join('')

    let [modulePromise, resolveModule] = withResolvers<Function>()
    let data = {}
    let frame = createFrame(document, {
      src: 'https://example.com/initial',
      errorTarget: new EventTarget(),
      loadModule: () => modulePromise,
      resolveFrame: () => '',
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, new EventTarget(), createStyleManager()),
      data,
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(data).not.toEqual({})

    frame.dispose()
    await frame.ready()

    expect(data).toEqual({})

    resolveModule(() => () => jsx('section', { children: 'late' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('[data-entry]')?.textContent).toBe('initial')
  })

  it('does not render a pending template after its frame is disposed', async () => {
    let markerId = 'disposed-pending-frame'
    let start = document.createComment(` rmx:f:${markerId} `)
    let fallback = document.createElement('p')
    fallback.textContent = 'Fallback'
    let end = document.createComment(' /rmx:f ')
    document.body.append(start, fallback, end)

    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let frame = createFrame([start, end], {
      src: '/child',
      marker: { id: markerId, src: '/child', status: 'pending' },
      errorTarget,
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame: () => '',
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, errorTarget, styleManager),
      styleManager,
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    frame.dispose()
    start.remove()
    fallback.remove()
    end.remove()
    await Promise.resolve()
    await Promise.resolve()

    let fragment = document.createDocumentFragment()
    let late = document.createElement('p')
    late.id = 'late-frame-content'
    fragment.append(late)
    publishFrameTemplate(markerId, fragment)
    await new Promise((resolve) => setTimeout(resolve, 0))

    consumeFrameTemplate(markerId)
    expect(document.getElementById('late-frame-content')).toBeNull()
    await frame.ready()
  })

  it('renders a redirected response without changing the frame source', async () => {
    let redirectedUrl = 'https://example.com/settings/overview'
    let frameSrc = 'https://example.com/settings'
    let response = new Response('<main id="result">Settings overview</main>')
    Object.defineProperties(response, {
      redirected: { value: true },
      url: { value: redirectedUrl },
    })
    let root = document.createElement('div')
    root.innerHTML = '<p>Initial</p>'
    document.body.append(root)
    let frame = createFrame(root, {
      src: frameSrc,
      errorTarget: new EventTarget(),
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame() {
        return response
      },
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, new EventTarget(), createStyleManager()),
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    try {
      await frame.ready()
      let result = await reloadFrameForNavigation(frame.handle)

      expect(document.getElementById('result')?.textContent).toBe('Settings overview')
      expect(frame.handle.src).toBe(frameSrc)
      expect(result.redirectedTo).toBe(redirectedUrl)
    } finally {
      frame.dispose()
    }
  })

  it('renders 4xx response bodies from custom resolvers', async () => {
    let root = document.createElement('div')
    root.innerHTML = '<p id="initial">Initial</p>'
    document.body.append(root)
    let errorTarget = new EventTarget()
    let frame = createFrame(root, {
      src: 'https://example.com/account',
      errorTarget,
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame() {
        return new Response('<main id="not-found">Account not found</main>', {
          status: 404,
          statusText: 'Not Found',
        })
      },
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, errorTarget, createStyleManager()),
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    try {
      await frame.ready()
      await frame.handle.reload()

      expect(document.getElementById('initial')).toBeNull()
      expect(document.getElementById('not-found')?.textContent).toBe('Account not found')
    } finally {
      frame.dispose()
    }
  })

  it('renders 5xx response bodies from custom resolvers', async () => {
    let root = document.createElement('div')
    root.innerHTML = '<p id="initial">Initial</p>'
    document.body.append(root)
    let errorTarget = new EventTarget()
    let frame = createFrame(root, {
      src: 'https://example.com/account',
      errorTarget,
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame() {
        return new Response('<main id="error">Account unavailable</main>', {
          status: 503,
          statusText: 'Service Unavailable',
        })
      },
      pendingClientEntries: new Map(),
      scheduler: createScheduler(document, errorTarget, createStyleManager()),
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    try {
      await frame.ready()
      await frame.handle.reload()

      expect(document.getElementById('initial')).toBeNull()
      expect(document.getElementById('error')?.textContent).toBe('Account unavailable')
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
      await reloadFrameForNavigation(frame.handle, {
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
      let reload = reloadFrameForNavigation(frame.handle, { signal: controller.signal })
      controller.abort()
      let result = await reload

      expect(result.signal.aborted).toBe(true)
      expect(resolverSignal?.aborted).toBe(true)
      expect(document.getElementById('initial')?.textContent).toBe('Initial')
    } finally {
      frame.dispose()
    }
  })

  it('stops reading the active response stream when the reload signal is aborted', async () => {
    let root = document.createElement('div')
    root.innerHTML = '<p id="initial">Initial</p>'
    document.body.append(root)
    let [streamRead, markStreamRead] = withResolvers<void>()
    let frame = createFrame(root, {
      src: 'https://example.com/account',
      errorTarget: new EventTarget(),
      loadModule() {
        throw new Error('Unexpected client entry')
      },
      resolveFrame() {
        return new ReadableStream<Uint8Array>({
          pull() {
            markStreamRead()
          },
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
      let reload = reloadFrameForNavigation(frame.handle, { signal: controller.signal })
      await streamRead
      controller.abort()
      let result = await reload

      expect(result.signal.aborted).toBe(true)
      expect(document.getElementById('initial')?.textContent).toBe('Initial')
    } finally {
      frame.dispose()
    }
  })

  it('does not loop when a nested frame range escapes its region', async () => {
    let outerStart = document.createComment(' rmx:f:outer ')
    let innerStart = document.createComment(' rmx:f:inner ')
    let innerEnd = document.createComment(' /rmx:f ')
    let outerEnd = document.createComment(' /rmx:f ')
    document.body.append(outerStart, innerStart, innerEnd, outerEnd)

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
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    })

    await frame.ready()

    // Simulate the outer region being truncated during a DOM update.
    outerEnd.after(innerEnd)
    let scans = countMarkerScans(innerStart, 100)
    frame.dispose()

    expect(scans.count).toBeLessThan(100)
  })

  it('starts preloads from a document reload before hydrating its client entries', async () => {
    document.documentElement.innerHTML = '<head><title>Initial</title></head><body></body>'

    function StreamingEntry(handle: Handle<{ label: string }>) {
      return () => jsx('section', { children: handle.props.label })
    }

    let preloadWasPresent = false
    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let scheduler = createScheduler(document, errorTarget, styleManager)
    let frame = createFrame(document, {
      src: 'https://example.com/initial',
      errorTarget,
      loadModule() {
        let preload = Array.from(
          document.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]'),
        ).find((link) => new URL(link.href).pathname === '/entry.js')
        preloadWasPresent = preload !== undefined
        preload?.dispatchEvent(new Event('load'))
        return StreamingEntry
      },
      resolveFrame() {
        return appendFlushMarker(
          [
            '<!doctype html><html><head><title>Next</title>',
            '<link data-rmx-module-preload rel="modulepreload" href="/entry.js" />',
            '</head><body><!-- rmx:h:h1 --><section>next</section><!-- /rmx:h -->',
            rmxDataScript('next'),
            '</body></html>',
          ].join(''),
          'document',
        )
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
      await frame.handle.reload()
      expect(preloadWasPresent).toBe(true)
      expect(document.querySelector(managedModulePreloadSelector)).toBeNull()
    } finally {
      frame.dispose()
    }
  })

  it('starts preloads from a nested frame reload before hydrating its client entries', async () => {
    let start = document.createComment(' rmx:f:frame ')
    let end = document.createComment(' /rmx:f ')
    document.body.append(start, end)

    function FragmentEntry() {
      return () => jsx('section', { children: 'fragment' })
    }

    let preloadWasPresent = false
    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let scheduler = createScheduler(document, errorTarget, styleManager)
    let frame = createFrame([start, end], {
      src: 'https://example.com/frame',
      errorTarget,
      loadModule() {
        let preload = Array.from(
          document.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]'),
        ).find((link) => new URL(link.href).pathname === '/fragment-entry.js')
        preloadWasPresent = preload !== undefined
        preload?.dispatchEvent(new Event('load'))
        return FragmentEntry
      },
      resolveFrame() {
        return [
          '<head><link data-rmx-module-preload rel="modulepreload" href="/fragment-entry.js" /></head>',
          '<!-- rmx:h:h1 --><section>fragment</section><!-- /rmx:h -->',
          rmxDataScript('fragment', '/fragment-entry.js', 'FragmentEntry'),
        ].join('')
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
      await frame.handle.reload()
      expect(preloadWasPresent).toBe(true)
      expect(document.querySelector(managedModulePreloadSelector)).toBeNull()
    } finally {
      frame.dispose()
    }
  })

  it('keeps active initial preloads connected across a document reload', async () => {
    document.documentElement.innerHTML = [
      '<head><title>Initial</title>',
      '<link data-rmx-module-preload rel="modulepreload" href="/entry.js" />',
      '</head><body></body>',
    ].join('')

    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let scheduler = createScheduler(document, errorTarget, styleManager)
    let frame = createFrame(document, {
      src: 'https://example.com/initial',
      errorTarget,
      loadModule: () => () => null,
      resolveFrame() {
        return appendFlushMarker(
          '<!doctype html><html><head><title>Next</title></head><body></body></html>',
          'document',
        )
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
      let activePreloads = Array.from(
        document.head.querySelectorAll<HTMLLinkElement>(managedModulePreloadSelector),
      )
      expect(activePreloads).toHaveLength(2)

      await frame.handle.reload()

      expect(document.title).toBe('Next')
      expect(activePreloads[0]?.isConnected).toBe(true)
      expect(activePreloads[1]?.isConnected).toBe(true)
      expect(document.head.querySelectorAll(managedModulePreloadSelector)).toHaveLength(2)

      activePreloads[1]?.dispatchEvent(new Event('load'))
      expect(document.head.querySelector(managedModulePreloadSelector)).toBeNull()
    } finally {
      frame.dispose()
    }
  })

  it('keeps active frame preloads connected across a document reload', async () => {
    document.documentElement.innerHTML = '<head><title>Initial</title></head><body></body>'

    let errorTarget = new EventTarget()
    let styleManager = createStyleManager()
    let scheduler = createScheduler(document, errorTarget, styleManager)
    let frame = createFrame(document, {
      src: 'https://example.com/initial',
      errorTarget,
      loadModule: () => () => null,
      resolveFrame() {
        return appendFlushMarker(
          '<!doctype html><html><head><title>Next</title></head><body></body></html>',
          'document',
        )
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
      let response = document.createElement('template')
      response.innerHTML =
        '<link data-rmx-module-preload rel="modulepreload" href="/frame-entry.js" />'
      getDocumentModulePreloader(document).consumePreloadLinks(response.content)
      let activePreload = document.head.querySelector<HTMLLinkElement>(managedModulePreloadSelector)
      expect(activePreload).not.toBeNull()

      await frame.handle.reload()

      expect(document.title).toBe('Next')
      expect(activePreload?.isConnected).toBe(true)
      expect(document.head.querySelector(managedModulePreloadSelector)).toBe(activePreload)

      activePreload?.dispatchEvent(new Event('load'))
      expect(document.head.querySelector(managedModulePreloadSelector)).toBeNull()
    } finally {
      frame.dispose()
    }
  })
})

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

function rmxDataScript(
  label: string,
  moduleUrl = '/entry.js',
  exportName = 'StreamingEntry',
): string {
  let data = {
    h: {
      h1: {
        moduleUrl,
        exportName,
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
