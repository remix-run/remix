// This adapts the document setup from ES Module Shims 2.8.4 test/test-revoke-blob-urls.html to
// the Remix browser test runner.
const baseUrl = new URL('./', import.meta.url).href
const base = document.createElement('base')
base.href = baseUrl
document.head.prepend(base)

const initialImportMap = document.createElement('script')
initialImportMap.type = 'importmap'
initialImportMap.textContent = JSON.stringify({ imports: {} })
document.head.append(initialImportMap)

await import(new URL('./revoke-blob-urls.ts', import.meta.url).href)
