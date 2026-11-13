// This adapts the document setup from ES Module Shims 2.8.4 test/test-polyfill.html to the Remix
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
    once: fixtureUrl('once.js'),
    test: fixtureUrl('es-modules/es6-file.js'),
    'test/': fixtureUrl(''),
    a: fixtureUrl('instance-case-a.js'),
    b: fixtureUrl('instance-case-b.js'),
  },
})
document.head.append(initialImportMap)

const additionalImportMap = document.createElement('script')
additionalImportMap.type = 'importmap'
additionalImportMap.textContent = JSON.stringify({
  imports: {
    global1: fixtureUrl('es-modules/global1.js'),
    'chain-parent': fixtureUrl('chain-parent.js'),
    'chain-child': fixtureUrl('chain-child.js'),
  },
})
document.head.append(additionalImportMap)

await import(fixtureUrl('once.js'))
await import(new URL('./polyfill.ts', import.meta.url).href)
