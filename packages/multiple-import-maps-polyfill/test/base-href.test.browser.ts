// This adapts ES Module Shims 2.8.4 test/test-base-href.html to the Remix browser test runner.
const fixtureUrl = new URL('./fixtures/es-modules/', import.meta.url).href

const base = document.createElement('base')
base.href = fixtureUrl
document.head.prepend(base)

const importMap = document.createElement('script')
importMap.type = 'importmap'
importMap.textContent = JSON.stringify({
  imports: {
    'base-href-bare': './base-href-bare.js',
  },
})
document.head.append(importMap)

await import(new URL('./base-href.ts', import.meta.url).href)
