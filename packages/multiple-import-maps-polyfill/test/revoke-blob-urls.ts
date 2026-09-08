// Adapted from ES Module Shims 2.8.4 test/revoke-blob-urls.js.
import { assert, fail, getLoad, importShim, test } from './test-adapter.ts'

test('should revoke blob URLs if `esmsInitOptions.revokeBlobURLs` is set to `true`', async () => {
  let originalModuleDepURL = new URL('./fixtures/es-modules/es6-dep.js', document.baseURI).href
  let moduleDepURL = `${originalModuleDepURL}?blob-revocation`
  let importMap = document.createElement('script')
  importMap.type = 'importmap'
  importMap.innerHTML = JSON.stringify({
    imports: {
      'es-modules/': new URL('./fixtures/es-modules/', import.meta.url).href,
      [originalModuleDepURL]: moduleDepURL,
    },
  })
  document.head.append(importMap)

  await importShim('es-modules/es6-withdep.js')

  let moduleURL = new URL('./fixtures/es-modules/es6-withdep.js', document.baseURI).href

  // must be on an old browser to test!
  if (!getLoad(moduleDepURL)) return

  let moduleBlobURL = getLoad(moduleURL)!.b
  let moduleDepBlobURL = getLoad(moduleDepURL)!.b
  let blobURLs = [moduleBlobURL, moduleDepBlobURL].filter((url) => url.startsWith('blob:http'))

  // Native multiple import map support does not create blob URLs.
  if (blobURLs.length === 0) return

  await Promise.all(blobURLs.map((url) => fetch(url))).catch(() =>
    fail('blob URLs should be revoked in a non-blocking way, AFTER the import is resolved'),
  )

  // Give the scheduled cleanup a chance to be completed.
  await new Promise((resolve) => setTimeout(resolve, 500))

  await Promise.all(blobURLs.map((url) => fetch(url))).then(
    () => {
      fail('blob URLs should already be revoked')
    },
    (err) => {
      assert(!!err)
    },
  )
})
