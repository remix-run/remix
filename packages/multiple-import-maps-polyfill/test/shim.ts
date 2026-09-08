// Adapted from ES Module Shims 2.8.4 test/shim.js.
import type { ImportMap } from '../src/lib/resolve.ts'

import { assert, getLoad, importShim, suite, test } from './test-adapter.ts'

declare global {
  interface Window {
    ordering: string[]
  }

  var ordering: string[]
}

const baseURL = new URL('./', import.meta.url).href
const fixtureURL = (path: string) => new URL(`./fixtures/${path}`, import.meta.url).href

function insertDynamicImportMap(importMap: Partial<ImportMap>) {
  let script = Object.assign(document.createElement('script'), {
    type: 'importmap',
    innerHTML: JSON.stringify(importMap),
  })
  document.head.appendChild(script)
  return () => document.head.removeChild(script)
}

let shimmedImportId = 0
async function importShimmed(url: string) {
  let specifier = `shimmed-import-${shimmedImportId++}`
  insertDynamicImportMap({ imports: { [specifier]: url } })
  return importShim(specifier)
}

suite('Basic loading tests', () => {
  test('Should import a module', async function () {
    let m = await importShim('./fixtures/es-modules/no-imports.js')
    assert(m)
    assert.equal(m.asdf, 'asdf')
  })

  test('Should import a module cached', async function () {
    let m1 = await importShim('./fixtures/es-modules/no-imports.js')
    let m2 = await importShim('./fixtures/es-modules/no-imports.js')
    assert.equal(m1.asdf, 'asdf')
    assert.equal(m1.obj, m2.obj)
  })

  test('should import an es module with its dependencies', async function () {
    let m = await importShim('./fixtures/es-modules/es6-withdep.js')
    assert.equal(m.p, 'p')
  })

  test('should import without bindings', async function () {
    let m = await importShim('./fixtures/es-modules/direct.js')
    assert(!!m)
  })

  test('should support various es syntax', async function () {
    let m = await importShim('./fixtures/es-modules/es6-file.js')

    assert.equal(typeof m.q, 'function')

    let thrown = false
    try {
      new m.q().foo()
    } catch (e) {
      thrown = true
      assert.equal(e, 'g')
    }

    if (!thrown) throw new Error('Supposed to throw')
  })

  test('should resolve various import syntax', async function () {
    let m = await importShim('./fixtures/es-modules/import.js')
    assert.equal(typeof m.a, 'function')
    assert.equal(m.b, 4)
    assert.equal(m.c, 5)
    assert.equal(m.d, 4)
    assert.equal(typeof m.q, 'object')
    assert.equal(typeof m.q.foo, 'function')
  })

  test('should support import.meta.url', async function () {
    let m = await importShim('./fixtures/es-modules/moduleName.js')
    assert.equal(m.name, new URL('./fixtures/es-modules/moduleName.js', baseURL).href)
  })

  test('should support dynamic import', async function () {
    let m = await importShim('./fixtures/es-modules/dynamic-import.js')
    let dynamicModule = await m.doImport()

    assert.equal(m.before, 'before')
    assert.equal(m.after, 'after')
    assert.equal(dynamicModule.default, 'bareDynamicImport')
  })

  test('should support relative dynamic import', async function () {
    let result = await (await importShim('./fixtures/test-rel-dynamic.js')).default
    assert.equal(result.hello, 'world')
  })

  test('should support nested import.meta.url in dynamic import', async function () {
    let result = await (await importShim('./fixtures/test-nested-dynamic.js')).default
    assert.ok(result.default.endsWith('test-nested-dynamic.js'))
  })

  test('Should import a module via a full url, with scheme', async function () {
    let url = new URL('./fixtures/es-modules/no-imports.js', baseURL).href
    assert.equal(url.slice(0, 4), 'http')
    let m = await importShim(url)
    assert(m)
    assert.equal(m.asdf, 'asdf')
  })

  test('Should import a module via a full url, without scheme', async function () {
    let url = new URL('./fixtures/es-modules/no-imports.js', baseURL).href.replace(/^http(s)?:/, '')
    assert.equal(url.slice(0, 2), '//')
    let m = await importShim(url)
    assert(m)
    assert.equal(m.asdf, 'asdf')
  })

  test("Should import a module via a relative path re-mapped with importmap's scopes", async function () {
    let url = fixtureURL('es-modules/import-relative-path.js')
    // The browser runner starts its own module graph before document setup, so this scope cannot be
    // installed by the TypeScript entry as part of the initial document like it is upstream.
    insertDynamicImportMap({
      scopes: {
        [url]: {
          [fixtureURL('es-modules/relative-path')]: fixtureURL('es-modules/es6-dep.js'),
        },
      },
    })
    let m = await importShim(url)
    assert(m)
    assert.equal(m.p, 'p')
    assert.equal(m.a, 'a')
  })

  test('Should import a module via data url', async function () {
    let m = await importShim(
      'data:application/javascript;charset=utf-8;base64,ZXhwb3J0IHZhciBhc2RmID0gJ2FzZGYnOw0KZXhwb3J0IHZhciBvYmogPSB7fTs=',
    )
    assert(m)
    assert.equal(m.asdf, 'asdf')
  })

  test('Should import a module via blob', async function () {
    let code = await (await fetch('./fixtures/es-modules/no-imports.js')).text()
    let blob = new Blob([code], { type: 'application/javascript' })
    let m = await importShim(URL.createObjectURL(blob))
    assert(m)
    assert.equal(m.asdf, 'asdf')
  })

  test('Should import a module with query parameters with path segments', async function () {
    let m = await importShim('./fixtures/es-modules/query-param-a.js?foo=/foo/bar/')
    assert(m)
    assert.equal(m.a, 'ab')
  })
})

suite('Circular dependencies', function () {
  test('Should handle self-import tdzs', async function () {
    let m = await importShim('./fixtures/es-modules/tdz.js')
    assert.equal(m.checkTDZ(), 'tdz')
  })

  test('should resolve circular dependencies', async function () {
    let m = await importShim('./fixtures/test-cycle.js')
    assert.equal(m.default, 'f')
  })

  test('should support shell update import interleaving', async function () {
    let m = await importShim('./fixtures/test-self-import.js')
    assert.equal(m.default.length, 3)
    assert.equal(m.default[0], 5)
    assert.equal(m.default[1], 6)
    assert.equal(m.default[2], 7)
  })
})

suite('Loading order', function () {
  async function assertLoadOrder(module: string, exports: string[]) {
    window.ordering = []
    await importShim(`./fixtures/es-modules/${module}`)
    assert.equal(exports.length, ordering.length)
    exports.forEach(function (name, index) {
      assert.equal(ordering[index], name)
    })
  }

  test('should execute in order', async function () {
    await assertLoadOrder('exec-order.js', ['a', 'b', 'c'])
  })

  test('should load in order (s)', async function () {
    await assertLoadOrder('s.js', ['b', 'a', 'c', 's'])
  })

  test('should load in order (_a)', async function () {
    await assertLoadOrder('_a.js', ['_d', '_c', '_b', '_g', '_a'])
  })

  test('should load in order (_h)', async function () {
    await assertLoadOrder('_h.js', ['_i', '_h'])
  })
})

suite('Export variations', function () {
  test('should resolve different export syntax', async function () {
    let m = await importShim('./fixtures/es-modules/export.js')
    assert.equal(m.p, 5)
    assert.equal(typeof m.foo, 'function')
    assert.equal(typeof m.q, 'object')
    assert.equal(typeof m.default, 'function')
    assert.equal(m.s, 4)
    assert.equal(m.t, 4)
    assert.equal(typeof m.m, 'object')
  })

  test('should resolve "export default"', async function () {
    let m = await importShim('./fixtures/es-modules/export-default.js')
    assert.equal(m.default(), 'test')
  })

  test('should support simple re-exporting', async function () {
    let m = await importShim('./fixtures/es-modules/reexport1.js')
    assert.equal(m.p, 5)
  })

  test('should support re-exporting binding', async function () {
    await importShim('./fixtures/es-modules/reexport-binding.js')
    let m = await importShim('./fixtures/es-modules/rebinding.js')
    assert.equal(m.p, 4)
  })

  test('should support re-exporting with a new name', async function () {
    let m = await importShim('./fixtures/es-modules/reexport2.js')
    assert.equal(m.q, 4)
    assert.equal(m.z, 5)
  })

  test('should support re-exporting', async function () {
    let m = await importShim('./fixtures/es-modules/export-star.js')
    assert.equal(m.foo, 'foo')
    assert.equal(m.bar, 'bar')
  })

  test('should support re-exporting overwriting', async function () {
    let m = await importShim('./fixtures/es-modules/export-star2.js')
    assert.equal(m.bar, 'bar')
    assert.equal(typeof m.foo, 'function')
  })

  test('import meta resolve', async function () {
    let m = await importShimmed(fixtureURL('es-modules/import-meta-resolve.js'))
    assert.equal(m.resolve('./export-star2.js'), new URL('./export-star2.js', m.url).href)
    assert.equal(m.resolve('test'), fixtureURL('es-modules/es6-file.js'))
    assert.equal(m.resolve('test/'), fixtureURL(''))
    assert.equal(m.resolve('test/sub/'), fixtureURL('sub/'))
    assert.equal(m.resolve('test/custom.css'), fixtureURL('custom.css'))
    assert.equal(m.resolve('test-dep'), fixtureURL('test-dep.js'))
    try {
      m.resolve('test-dep', new URL('https://other.com'))
      assert(false)
    } catch (e) {
      assert.equal(e instanceof Error && e.message.indexOf('Unable to resolve'), 0)
    }
  })
})

suite('Errors', function () {
  async function getImportError(module: string): Promise<unknown> {
    try {
      await importShim(module)
    } catch (e) {
      return e
    }
    throw new Error('Test supposed to fail')
  }

  test('should give a plain name error', async function () {
    let err = await getImportError('plain-name')
    assert.equal(
      String(err).indexOf("Error: Unable to resolve specifier 'plain-name' imported from"),
      0,
    )
  })

  test('should throw if on syntax error', async function () {
    let err = await getImportError('./fixtures/es-modules/main.js')
    assert.equal(String(err), 'dep error')
  })

  test('should throw what the script throws', async function () {
    let err = await getImportError('./fixtures/es-modules/deperror.js')
    assert.equal(String(err), 'dep error')
  })

  test('Dynamic import map shim', async function () {
    insertDynamicImportMap({
      imports: {
        'react-dom': fixtureURL('es-modules/es6.js'),
      },
    })
    let [React, ReactDOM] = await Promise.all([importShim('react'), importShim('react-dom')])
    assert.ok(React)
    assert.ok(ReactDOM)
  })

  test('Dynamic import map shim 2', async function () {
    insertDynamicImportMap({
      imports: {
        lodash: fixtureURL('es-modules/export-default.js'),
      },
    })
    let lodash = await importShim('lodash')
    assert.ok(lodash)
  })

  test('Dynamic import map shim with override to the same mapping is allowed', async function () {
    let expectingNoError = new Promise((resolve, reject) => {
      window.addEventListener('error', (event) => {
        reject(event.error)
      })
      // waiting for 1 sec should be enough to make sure the error didn't happen.
      setTimeout(resolve, 1000)
    })

    let removeImportMap = insertDynamicImportMap({
      imports: {
        global1: fixtureURL('es-modules/global1.js'),
      },
    })

    await expectingNoError

    removeImportMap()
  })
})

suite('Source maps', () => {
  test('should include `//# sourceURL=` directive if one is not present in original module', async () => {
    let moduleURL = new URL('./fixtures/es-modules/without-source-url.js', baseURL).href
    await importShimmed(moduleURL)
    let moduleBlobURL = getLoad(moduleURL)!.b
    let blobContent = await fetch(moduleBlobURL).then((r) => r.text())
    assert(blobContent.includes(`//# sourceURL=${moduleURL}`))
  })

  test('should replace relative paths in `//# sourceURL=` directive with absolute URL', async () => {
    let moduleURL = new URL('./fixtures/es-modules/with-relative-source-url.js', baseURL).href
    await importShimmed(moduleURL)
    let moduleBlobURL = getLoad(moduleURL)!.b
    let blobContent = await fetch(moduleBlobURL).then((r) => r.text())
    let sourceURL = new URL('module.ts', moduleURL).href
    assert(blobContent.endsWith(`//# sourceURL=${sourceURL}`))
    // Should not touch any other occurrences of `//# sourceURL=` in the code.
    assert(blobContent.includes('//# sourceURL=i-should-not-be-affected.no'))
  })

  test('should replace relative paths in `//# sourceMappingURL=` directive with absolute URL and add `//# sourceURL=`', async () => {
    let moduleURL = new URL('./fixtures/es-modules/with-relative-source-mapping-url.js', baseURL)
      .href
    await importShimmed(moduleURL)
    let moduleBlobURL = getLoad(moduleURL)!.b
    let blobContent = await fetch(moduleBlobURL).then((r) => r.text())
    let sourceMappingURL = new URL('./with-relative-source-mapping-url.js.map', moduleURL).href
    assert(
      blobContent.endsWith(`//# sourceMappingURL=${sourceMappingURL}\n//# sourceURL=${moduleURL}`),
    )

    // Should not touch any other occurrences of `//# sourceMappingURL=` in the code.
    assert(blobContent.includes('//# sourceMappingURL=i-should-not-be-affected.no'))
  })

  test('should keep original absolute URL in `//# sourceMappingURL=` directive and add `//# sourceURL=`', async () => {
    let moduleURL = new URL('./fixtures/es-modules/with-absolute-source-mapping-url.js', baseURL)
      .href
    await importShimmed(moduleURL)
    let moduleBlobURL = getLoad(moduleURL)!.b
    let blobContent = await fetch(moduleBlobURL).then((r) => r.text())
    assert(
      blobContent.endsWith(
        `//# sourceMappingURL=https://example.com/module.js.map\n//# sourceURL=${moduleURL}`,
      ),
    )

    // Should not touch any other occurrences of `//# sourceMappingURL=` in the code.
    assert(blobContent.includes('//# sourceMappingURL=i-should-not-be-affected.no'))
  })

  test('should preserve existing sourceURL if both sourceURL and sourceMappingURL already exist', async () => {
    let moduleURL = new URL(
      './fixtures/es-modules/with-source-url-and-source-mapping-url.js',
      baseURL,
    ).href
    await importShimmed(moduleURL)
    let moduleBlobURL = getLoad(moduleURL)!.b
    let blobContent = await fetch(moduleBlobURL).then((r) => r.text())
    assert(
      blobContent.endsWith(
        `//# sourceURL=${new URL('/with-source-url-and-source-mapping-url.js', window.location.origin)}\n//# sourceMappingURL=https://example.com/module.js.map`,
      ),
    )

    // Should not touch any other occurrences of `//# sourceURL=` in the code.
    assert(blobContent.includes('//# sourceURL=i-should-not-be-affected.no'))
  })
})
