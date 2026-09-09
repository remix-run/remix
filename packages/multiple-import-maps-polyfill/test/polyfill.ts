// Adapted from ES Module Shims 2.8.4 test/polyfill.js.
import { assert, importShim, suite, test } from './test-adapter.ts'

declare global {
  interface Window {
    chainChildCnt: number
    chainParentCnt: number
    cnt: number
    done: () => void
    dynamic: boolean | undefined
    dynamicUrlMap: boolean
  }
}

const fixtureURL = (path: string) => new URL(`./fixtures/${path}`, import.meta.url).href

suite('Polyfill tests', () => {
  test('should support dynamic import with an import map', async function () {
    let p = new Promise<void>((resolve) => (window.done = resolve))
    await importShim('./fixtures/es-modules/importer1.js')
    await p
  })

  test('should support multiple import maps', async function () {
    await importShim('global1')
  })

  test('URL mappings do not cause double execution', async function () {
    // The browser runner starts its own module graph before document setup, so this map cannot be
    // installed by the TypeScript entry as part of the initial document like it is upstream.
    let importMap = document.createElement('script')
    importMap.type = 'importmap'
    importMap.innerHTML = JSON.stringify({
      imports: {
        [fixtureURL('es-modules/dynamic.js')]: fixtureURL('es-modules/dynamic-url-map.js'),
      },
    })
    document.head.append(importMap)

    await importShim('./fixtures/es-modules/dynamic-parent.js')
    assert.equal(window.dynamicUrlMap, true)
    assert.equal(window.dynamic, undefined)
  })

  test('import maps passthrough polyfill mode', async function () {
    await importShim('test')
  })

  test('Shared instances', async function () {
    let { check } = await importShim('./fixtures/instance-case.js')
    let result = await check()
    assert.equal(result, true)
  })

  test('Polyfill engagement', async function () {
    if (window.cnt > 1) throw new Error(`Polyfill engaged despite native implementation`)
    assert.equal(window.cnt, 1)
  })

  test('Polyfill engagement with bare specifier dependency chain from second import map', async function () {
    await importShim('chain-parent')
    if (window.chainParentCnt > 1 || window.chainChildCnt > 1)
      throw new Error(`Polyfill engaged despite native multiple import maps support`)
    assert.equal(window.chainParentCnt, 1)
    assert.equal(window.chainChildCnt, 1)
  })
})
