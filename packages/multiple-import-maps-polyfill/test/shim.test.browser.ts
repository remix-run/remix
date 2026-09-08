// This adapts the document setup from ES Module Shims 2.8.4 test/test-shim.html to the Remix
// browser test runner. The imported test module retains the upstream test order and structure.
const baseUrl = new URL('./', import.meta.url).href
const fixtureUrl = (path: string) => new URL(`./fixtures/${path}`, import.meta.url).href

const base = document.createElement('base')
base.href = baseUrl
document.head.prepend(base)

const initialImportMap = document.createElement('script')
initialImportMap.type = 'importmap'
initialImportMap.textContent = JSON.stringify({
  imports: {
    test: fixtureUrl('es-modules/es6-file.js'),
    'test/': fixtureUrl(''),
    react: fixtureUrl('es-modules/no-imports.js'),
    global1: fixtureUrl('es-modules/global1.js'),
    'bare-dynamic-import': fixtureUrl('es-modules/bare-dynamic-import.js'),
  },
  scopes: {
    [baseUrl]: {
      'test-dep': fixtureUrl('test-dep.js'),
    },
  },
})
document.head.append(initialImportMap)

await import(new URL('./shim.ts', import.meta.url).href)
