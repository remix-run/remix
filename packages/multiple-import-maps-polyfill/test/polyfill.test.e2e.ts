import * as assert from '@remix-run/assert'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lexerPath = fileURLToPath(import.meta.resolve('es-module-lexer'))

declare global {
  interface Window {
    continuePreloadTest(): void
  }
}

describe('multiple import map polyfill', () => {
  it('resolves relative paths and scoped imports using the supplied parent URL', async (t) => {
    let requests = new Set<string>()
    let sources: Record<string, string> = {
      '/app/relative.js': 'export let value = "document"',
      '/feature/relative.js': 'export let value = "parent"',
      '/app/shared.js': 'export let value = "app"',
      '/feature/shared.js': 'export let value = "feature"',
      '/feature/late.js': 'export let value = "late"',
    }
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        requests.add(url.pathname)
        if (url.pathname === '/')
          return html(`<!doctype html><html><head>
        <base href="/app/">
        <script type="importmap">${JSON.stringify({
          imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' },
          scopes: {
            '/app/': { shared: '/app/shared.js' },
            '/feature/': { shared: '/feature/shared.js' },
          },
        })}</script></head><body><script type="module">
        import { importModule, detectMultipleImportMapSupport } from '/dist/index.js'
        try {
          let parent = new URL('/feature/entry.js', location.href).href
          let lateMap = document.createElement('script')
          lateMap.type = 'importmap'
          lateMap.textContent = JSON.stringify({ scopes: { '/feature/': { late: '/feature/late.js' } } })
          document.head.append(lateMap)
          let results = await Promise.all([
            importModule('./relative.js'),
            importModule('./relative.js', parent),
            importModule('shared'),
            importModule('shared', parent),
            importModule('late', parent),
          ])
          document.body.textContent = results.map(result => result.value).join(',')
          document.body.dataset.native = String(await detectMultipleImportMapSupport())
        } catch (error) {
          document.body.textContent = String(error)
        }
        document.body.dataset.ready = 'true'
        </script></body></html>`)
        if (url.pathname.startsWith('/dist/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js')
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        return javascript(sources[url.pathname] ?? 'throw new Error("Unexpected module")')
      }),
    )
    await page.goto('/')
    await page.locator('body[data-ready="true"]').waitFor()
    assert.equal(await page.locator('body').textContent(), 'document,parent,app,feature,late')
    if ((await page.locator('body').getAttribute('data-native')) === 'true') {
      assert.equal(requests.has('/dist/lib/core.js'), false)
      assert.equal(requests.has('/vendor/es-module-lexer.js'), false)
    }
  })

  it('preloads only the requested modules and reuses their fetches', async (t) => {
    let requests = new Map<string, number>()
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        requests.set(url.pathname, (requests.get(url.pathname) ?? 0) + 1)

        if (url.pathname === '/') return html(preloadDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        return javascript(modules[url.pathname] ?? 'throw new Error("Module not found")', {
          status: url.pathname in modules ? 200 : 404,
        })
      }),
    )

    await page.goto('/')
    await page.locator('#preloaded').waitFor({ state: 'attached' })

    assert.equal(requests.get('/preload-parent.hash.js'), 1)
    assert.equal(requests.get('/preload-child.hash.js') ?? 0, 0)

    await page.evaluate(() => window.continuePreloadTest())
    await page.locator('#preload-result').waitFor({ state: 'attached' })

    assert.equal(await page.locator('#preload-result').textContent(), 'parent:child')
    assert.equal(requests.get('/preload-parent.hash.js'), 1)
    assert.equal(requests.get('/preload-child.hash.js'), 1)
  })

  it('ignores preload failures and reports them when importing', async (t) => {
    let requests = new Map<string, number>()
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        requests.set(url.pathname, (requests.get(url.pathname) ?? 0) + 1)

        if (url.pathname === '/') return html(preloadFailureDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await page.goto('/')
    await page.locator('#preload-failure-result').waitFor({ state: 'attached' })

    assert.equal(
      await page.locator('#preload-failure-result').textContent(),
      'false:true:false:true',
    )
    assert.equal(requests.get('/missing.js'), 1)
  })

  it('loads JavaScript graphs and preloads modules through import maps appended at runtime', async (t) => {
    let requests = new Map<string, number>()
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        requests.set(url.pathname, (requests.get(url.pathname) ?? 0) + 1)

        if (url.pathname === '/') return html(testDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        return javascript(modules[url.pathname] ?? 'throw new Error("Module not found")', {
          status: url.pathname in modules ? 200 : 404,
        })
      }),
    )
    await page.goto('/')
    await page.locator('#result').waitFor({ state: 'attached' })
    assert.equal(
      await page.locator('#result').textContent(),
      'late:shared:1:nested:dynamic:true:a:b:a',
    )
    assert.equal(await page.locator('#latest').textContent(), 'latest')
    assert.equal(await page.locator('#meta').textContent(), '/feature.hash.js')
    assert.equal(await page.locator('#global').textContent(), 'undefined')
    assert.equal(await page.locator('script[noshim]').count(), 0)

    assert.equal(requests.get('/feature.hash.js'), 1)
    assert.equal(requests.get('/late.hash.js'), 1)
    assert.equal(requests.get('/cycle-a.hash.js'), 1)
    assert.equal(requests.get('/cycle-b.hash.js'), 1)
  })

  it('uses native loading when supported and the polyfill for late maps otherwise', async (t) => {
    let requests = new Map<string, number>()
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        requests.set(url.pathname, (requests.get(url.pathname) ?? 0) + 1)

        if (url.pathname === '/') return html(helperDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        return javascript(modules[url.pathname] ?? 'throw new Error("Module not found")', {
          status: url.pathname in modules ? 200 : 404,
        })
      }),
    )

    await page.goto('/')
    await page.locator('#helper-result').waitFor({ state: 'attached' })

    let browserName = page.context().browser()?.browserType().name()
    let supportsMultiple = browserName !== 'firefox'
    assert.equal(await page.locator('#support').textContent(), String(supportsMultiple))
    assert.equal(await page.locator('#helper-result').textContent(), 'helper')
    assert.equal(
      await page.locator('#native-preloads').textContent(),
      supportsMultiple ? '/helper.js' : '',
    )
    assert.equal(requests.get('/helper.hash.js'), 1)
    assert.equal(requests.get('/dist/lib/core.js') ?? 0, supportsMultiple ? 0 : 1)
    assert.equal(requests.get('/vendor/es-module-lexer.js') ?? 0, supportsMultiple ? 0 : 1)
  })

  it('starts loading the polyfill when support detection returns false', async (t) => {
    let requests = new Map<string, number>()
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        requests.set(url.pathname, (requests.get(url.pathname) ?? 0) + 1)

        if (url.pathname === '/') return html(detectionDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    let browserName = page.context().browser()?.browserType().name()
    let supportsMultiple = browserName !== 'firefox'
    let runtimeResponse = supportsMultiple
      ? undefined
      : page.waitForResponse((response) => response.url().endsWith('/dist/lib/core.js'))

    await page.goto('/')
    await page.locator('#support').waitFor({ state: 'attached' })
    await runtimeResponse

    assert.equal(await page.locator('#support').textContent(), String(supportsMultiple))
    assert.equal(requests.get('/dist/lib/core.js') ?? 0, supportsMultiple ? 0 : 1)
  })

  it('detects support when Trusted Types enforcement allows its policy', async (t) => {
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        if (url.pathname === '/') {
          return html(trustedTypesDocument, {
            headers: {
              'Content-Security-Policy':
                "script-src 'self' 'nonce-n0nce' blob: 'wasm-unsafe-eval'; connect-src 'self' blob:; require-trusted-types-for 'script'; trusted-types remix/multiple-import-maps-polyfill",
            },
          })
        }
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        if (url.pathname === '/csp-module.js') {
          return javascript("export let value = 'csp'")
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await page.goto('/')
    await page.locator('#support, #error').waitFor({ state: 'attached' })

    let browserName = page.context().browser()?.browserType().name()
    assert.equal(
      await page.locator('#support, #error').textContent(),
      `${String(browserName !== 'firefox')}:csp`,
    )
  })

  it('rejects non-JavaScript module responses', async (t) => {
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        if (url.pathname === '/') return html(nonJavaScriptDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        if (url.pathname === '/data.json') {
          return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await page.goto('/')
    await page.locator('#error').waitFor({ state: 'attached' })
    assert.match(
      (await page.locator('#error').textContent()) ?? '',
      /Only JavaScript modules are supported/,
    )
  })

  it('resolves native module types through import maps appended at runtime', async (t) => {
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        if (url.pathname === '/') return html(nativeModuleTypesDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        if (url.pathname === '/native-module-types.js') {
          return javascript(`
            import staticData from 'static-data' with { type: 'json' }
            export let staticValue = staticData.value
            export let dynamicValue = (await import('dynamic-data', { with: { type: 'json' } })).default.value
          `)
        }
        if (url.pathname === '/static-data.json') {
          return new Response('{"value":"static"}', {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.pathname === '/dynamic-data.json') {
          return new Response('{"value":"dynamic"}', {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await page.goto('/')
    await page.locator('#result, #error').waitFor({ state: 'attached' })
    assert.equal(await page.locator('#result, #error').textContent(), 'static:dynamic')
  })

  it('rewrites static Wasm source imports through import maps appended at runtime', async (t) => {
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        if (url.pathname === '/') return html(wasmSourceDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        if (url.pathname === '/wasm-source.js') {
          return javascript("import source adder from 'static-wasm'; export { adder }")
        }
        if (url.pathname === '/static.hash.wasm') {
          return new Response(wasmBytes, {
            headers: { 'Content-Type': 'application/wasm' },
          })
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await page.goto('/')
    await page.locator('#result').waitFor({ state: 'attached' })
    assert.equal(await page.locator('#result').textContent(), 'true')
  })

  it('applies integrity metadata from late import maps', async (t) => {
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        if (url.pathname === '/') return html(integrityDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        if (url.pathname === '/integrity.js') {
          return javascript("export const value = 'integrity'")
        }
        if (url.pathname === '/invalid-integrity.js') {
          return javascript("export const value = 'invalid-integrity'")
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await page.goto('/')
    await page.locator('#integrity').waitFor({ state: 'attached' })
    assert.equal(await page.locator('#integrity').textContent(), 'integrity:true')
  })

  it('does not process declarative module scripts appended after initialization', async (t) => {
    let page = await t.serve(
      await createTestServer(async (request) => {
        let url = new URL(request.url)
        if (url.pathname === '/') return html(declarativeDocument)
        if (url.pathname === '/dist/index.js') return file('dist/index.js')
        if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
        if (url.pathname === '/vendor/es-module-lexer.js') {
          return javascript(await fs.readFile(lexerPath, 'utf8'))
        }
        return javascript('globalThis.declarativeModuleExecuted = true')
      }),
    )

    await page.goto('/')
    await page.locator('#ready').waitFor({ state: 'attached' })
    assert.equal(await page.locator('#global').textContent(), 'undefined')
    assert.equal(await page.locator('script[noshim]').count(), 0)
  })
})

const initialImportMap = {
  imports: {
    'es-module-lexer': '/vendor/es-module-lexer.js',
    '/shared.js': '/shared.hash.js',
  },
  scopes: {
    '/feature.hash.js': {
      initial: '/initial.hash.js',
    },
  },
}

const preloadDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify(initialImportMap)}</script>
</head>
<body>
  <script type="module">
    import { importShim, preloadShim } from '/dist/index.js'

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(
      JSON.stringify({
        imports: {
          '/preload-parent.js': '/preload-parent.hash.js',
          '/preload-child.js': '/preload-child.hash.js',
        },
      }),
    )}
    document.head.append(map)

    await preloadShim(['/preload-parent.js', '/preload-parent.js'])
    document.body.insertAdjacentHTML('beforeend', '<div id="preloaded"></div>')
    await new Promise((resolve) => (window.continuePreloadTest = resolve))

    let module = await importShim('/preload-parent.js')
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="preload-result">' + module.value + '</div>',
    )
  </script>
</body>
</html>
`

const preloadFailureDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { importShim, preloadShim } from '/dist/index.js'

    let preloadRejected = false
    try {
      await preloadShim('unmapped')
    } catch {
      preloadRejected = true
    }

    let importRejected = false
    try {
      await importShim('unmapped')
    } catch {
      importRejected = true
    }

    let failedFetchPreloadRejected = false
    try {
      await preloadShim('/missing.js')
    } catch {
      failedFetchPreloadRejected = true
    }

    let failedFetchImportRejected = false
    try {
      await importShim('/missing.js')
    } catch {
      failedFetchImportRejected = true
    }

    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="preload-failure-result">' +
        [
          preloadRejected,
          importRejected,
          failedFetchPreloadRejected,
          failedFetchImportRejected,
        ].join(':') +
      '</div>',
    )
  </script>
</body>
</html>
`

const lateImportMap = {
  imports: {
    '/nested.js': '/nested.hash.js',
    '/cycle-a.js': '/cycle-a.hash.js',
    '/cycle-b.js': '/cycle-b.hash.js',
    'dynamic-late': '/dynamic-late.hash.js',
  },
  scopes: {
    '/feature.hash.js': {
      late: '/late.hash.js',
    },
  },
}

const testDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify(initialImportMap)}</script>
  <script type="module">
    import '/shared.js'
  </script>
</head>
<body>
  <script type="module">
    import { importModule, importShim, preloadShim } from '/dist/index.js'
    globalThis.originalImportModule = importModule

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(JSON.stringify(lateImportMap))}
    document.head.append(map)

    await Promise.all([
      preloadShim(['/feature.hash.js', '/cycle-a.js']),
    ])
    let [feature, dynamicParent, wrapperConsumer, cycle] = await Promise.all([
      importShim('/feature.hash.js'),
      importShim('/dynamic-parent.js'),
      importShim('/wrapper-consumer.js'),
      importShim('/cycle-a.js'),
    ])
    let nested = await feature.loadNested()
    let dynamic = await dynamicParent.load()

    let latestMap = document.createElement('script')
    latestMap.type = 'importmap'
    latestMap.textContent = JSON.stringify({ imports: { latest: '/latest.hash.js' } })
    document.head.append(latestMap)
    let latest = await importShim('latest')

    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="result">' + [feature.value, nested.value, dynamic.value, wrapperConsumer.sameRuntime, cycle.a, cycle.readB(), cycle.readA()].join(':') + '</div>' +
      '<div id="latest">' + latest.value + '</div>' +
      '<div id="meta">' + new URL(feature.moduleUrl).pathname + '</div>' +
      '<div id="global">' + typeof globalThis.importShim + '</div>',
    )
  </script>
</body>
</html>
`

const declarativeDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify(initialImportMap)}</script>
</head>
<body>
  <script type="module">
    import { preloadShim } from '/dist/index.js'
    await preloadShim('/declarative.js')
    let script = document.createElement('script')
    script.type = 'module'
    script.src = '/declarative.js'
    document.head.append(script)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="ready"></div><div id="global">' + typeof globalThis.importShim + '</div>',
    )
  </script>
</body>
</html>
`

const helperDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import {
      importModule,
      preloadShim,
      detectMultipleImportMapSupport,
    } from '/dist/index.js'

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(JSON.stringify({ imports: { '/helper.js': '/helper.hash.js' } }))}
    document.head.append(map)

    let supportsMultiple = await detectMultipleImportMapSupport()
    let nativePreloads = ['/helper.js']
    if (!supportsMultiple) {
      void preloadShim(nativePreloads)
      nativePreloads = []
    }
    let helper = await importModule('/helper.js')
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="support">' + supportsMultiple + '</div>' +
      '<div id="native-preloads">' + nativePreloads.join(',') + '</div>' +
      '<div id="helper-result">' + helper.value + '</div>',
    )
  </script>
</body>
</html>
`

const detectionDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { detectMultipleImportMapSupport } from '/dist/index.js'

    let supported = await detectMultipleImportMapSupport()
    document.body.insertAdjacentHTML('beforeend', '<div id="support">' + supported + '</div>')
  </script>
</body>
</html>
`

const trustedTypesDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap" nonce="n0nce">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
  <script type="importmap" nonce="n0nce">${JSON.stringify({ imports: { 'csp-module': '/csp-module.js' } })}</script>
</head>
<body>
  <script type="module" nonce="n0nce">
    import { detectMultipleImportMapSupport, importShim } from '/dist/index.js'

    try {
      let result = document.createElement('div')
      result.id = 'support'
      let module = await importShim('csp-module')
      result.textContent = String(await detectMultipleImportMapSupport()) + ':' + module.value
      document.body.append(result)
    } catch (error) {
      let result = document.createElement('div')
      result.id = 'error'
      result.textContent = String(error)
      document.body.append(result)
    }
  </script>
</body>
</html>
`

const nonJavaScriptDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { importShim } from '/dist/index.js'

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(JSON.stringify({ imports: { data: '/data.json' } }))}
    document.head.append(map)

    try {
      await importShim('data')
    } catch (error) {
      document.body.insertAdjacentHTML('beforeend', '<div id="error">' + error.message + '</div>')
    }
  </script>
</body>
</html>
`

const nativeModuleTypesDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { importShim } from '/dist/index.js'

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(
      JSON.stringify({
        imports: {
          'native-module-types': '/native-module-types.js',
          'static-data': '/static-data.json',
          'dynamic-data': '/dynamic-data.json',
        },
      }),
    )}
    document.head.append(map)

    try {
      let module = await importShim('native-module-types')
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="result">' + module.staticValue + ':' + module.dynamicValue + '</div>',
      )
    } catch (error) {
      document.body.insertAdjacentHTML('beforeend', '<div id="error">' + error + '</div>')
    }
  </script>
</body>
</html>
`

const wasmSourceDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { detectMultipleImportMapSupport, importShim } from '/dist/index.js'

    let moduleSources = []
    let createObjectURL = URL.createObjectURL
    URL.createObjectURL = function (blob) {
      if (blob.type === 'text/javascript') moduleSources.push(blob.text())
      return createObjectURL.call(this, blob)
    }

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(
      JSON.stringify({
        imports: {
          'wasm-source': '/wasm-source.js',
          'static-wasm': '/static.hash.wasm',
        },
      }),
    )}
    document.head.append(map)

    try {
      await importShim('wasm-source')
    } catch {}

    let supportsMultipleImportMaps = await detectMultipleImportMapSupport()
    let mappedUrl = location.origin + '/static.hash.wasm'
    let rewritten = (await Promise.all(moduleSources)).some((source) =>
      source.includes("/*'static-wasm'*/'" + mappedUrl + "'"),
    )
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="result">' + (supportsMultipleImportMaps || rewritten) + '</div>',
    )
  </script>
</body>
</html>
`

const integrityDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { importShim } from '/dist/index.js'

    let map = document.createElement('script')
    map.type = 'importmap'
    map.textContent = ${JSON.stringify(
      JSON.stringify({
        imports: {
          integrity: '/integrity.js',
          'invalid-integrity': '/invalid-integrity.js',
        },
        integrity: {
          '/integrity.js': 'sha256-LdI0LKsMCRha+K1IRRbUJo6MvgTz/Jx91TwhM4g930M=',
          '/invalid-integrity.js': 'sha256-LdI0LKsMCRha+K1IRRbUJo6MvgTz/Jx91TwhM4g930M=',
        },
      }),
    )}
    document.head.append(map)

    let valid = await importShim('integrity')
    let rejected = false
    try {
      await importShim('invalid-integrity')
    } catch {
      rejected = true
    }
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="integrity">' + valid.value + ':' + rejected + '</div>',
    )
  </script>
</body>
</html>
`

const modules: Record<string, string> = {
  '/shared.hash.js': `
    globalThis.sharedExecutions = (globalThis.sharedExecutions ?? 0) + 1
    export const value = 'shared'
  `,
  '/initial.hash.js': `export const value = 'initial'`,
  '/late.hash.js': `export const value = 'late'`,
  '/latest.hash.js': `export const value = 'latest'`,
  '/nested.hash.js': `export const value = 'nested'`,
  '/dynamic-late.hash.js': `export const value = 'dynamic'`,
  '/dynamic-parent.js': `export function load() { return import('dynamic-late') }`,
  '/wrapper-consumer.js': `
    import { importModule } from '/dist/index.js'
    export const sameRuntime = importModule === globalThis.originalImportModule
  `,
  '/feature.hash.js': `
    import { value as late } from 'late'
    import { value as shared } from '/shared.js'
    export const value = late + ':' + shared + ':' + globalThis.sharedExecutions
    export const moduleUrl = import.meta.url
    export function loadNested() { return import('/nested.js') }
  `,
  '/cycle-a.hash.js': `
    import { b, readA } from '/cycle-b.js'
    export const a = 'a'
    export { readA }
    export function readB() { return b }
  `,
  '/cycle-b.hash.js': `
    import { a } from '/cycle-a.js'
    export const b = 'b'
    export function readA() { return a }
  `,
  '/preload-parent.hash.js': `
    import { value as child } from '/preload-child.js'
    export const value = 'parent:' + child
  `,
  '/preload-child.hash.js': `export const value = 'child'`,
  '/declarative.js': `globalThis.declarativeModuleExecuted = true`,
  '/helper.hash.js': `export const value = 'helper'`,
}

const wasmBytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01,
  0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x0a, 0x01, 0x06, 0x61, 0x64, 0x64, 0x54, 0x77, 0x6f, 0x00,
  0x00, 0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b, 0x00, 0x0a, 0x04, 0x6e,
  0x61, 0x6d, 0x65, 0x02, 0x03, 0x01, 0x00, 0x00,
])

async function file(relativePath: string): Promise<Response> {
  return javascript(await fs.readFile(path.join(packageDirectory, relativePath), 'utf8'))
}

function html(source: string, init?: ResponseInit): Response {
  let headers = new Headers(init?.headers)
  headers.set('Content-Type', 'text/html')
  return new Response(source, { ...init, headers })
}

function javascript(source: string, init?: ResponseInit): Response {
  let headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/javascript')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(source, { ...init, headers })
}
