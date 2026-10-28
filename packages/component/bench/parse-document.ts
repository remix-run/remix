// Run with: node --disable-warning=ExperimentalWarning packages/component/bench/parse-document.ts
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { stripTypeScriptTypes } from 'node:module'

import { chromium, firefox, webkit } from 'playwright'

const server = createServer(async (request, response) => {
  let name = request.url?.slice(1)
  if (name === 'parse-document.ts' || name === 'invariant.ts') {
    let source = await readFile(new URL(`../src/runtime/${name}`, import.meta.url), 'utf8')
    response.writeHead(200, { 'Content-Type': 'text/javascript' })
    response.end(stripTypeScriptTypes(source))
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('<!doctype html><html><head></head><body></body></html>')
  }
})

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
let address = server.address()
if (!address || typeof address === 'string') throw new Error('Missing benchmark address')

try {
  for (let launcher of [chromium, firefox, webkit]) {
    let browser = await launcher.launch()
    try {
      let page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${address.port}`)
      let results = await page.evaluate(async () => {
        let moduleUrl = new URL('/parse-document.ts', location.href).href
        let { parseDocument }: typeof import('../src/runtime/parse-document.ts') = await import(
          moduleUrl
        )
        let section = '<section><h2>Book</h2><p>A description of the book.</p></section>'
        let shell = (body: string) =>
          '<!doctype html><html lang="en" data-label="A > B"><head><title>Books</title>' +
          '<style nonce="response-nonce">section { color: #123456 }</style></head>' +
          `<body>${body}</body></html>`
        let inputs = [
          { name: 'small document', html: shell(section.repeat(10)) },
          { name: '30 KB document', html: shell(section.repeat(500)) },
          { name: '300 KB document', html: shell(section.repeat(5000)) },
          {
            name: '100 KB leading comment',
            html: `<!--${'x'.repeat(100_000)}-->${shell(section)}`,
          },
        ]
        let results = []
        for (let { name, html } of inputs) {
          let methods = [
            { name: 'DOMParser', parse: () => new DOMParser().parseFromString(html, 'text/html') },
            { name: 'detached', parse: () => parseDocument(document, html) },
          ]
          for (let method of methods) {
            for (let i = 0; i < 20; i++) method.parse()
          }
          let samples = new Map<string, number[]>(methods.map(({ name }) => [name, []]))
          for (let batch = 0; batch < 10; batch++) {
            for (let method of batch % 2 ? methods.toReversed() : methods) {
              let start = performance.now()
              for (let i = 0; i < 50; i++) method.parse()
              samples.get(method.name)?.push((performance.now() - start) / 50)
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 0))
          }
          for (let [method, times] of samples) {
            times.sort((a, b) => a - b)
            results.push({
              name,
              bytes: html.length,
              method,
              medianMs: Number(((times[4] + times[5]) / 2).toFixed(3)),
            })
          }
        }
        return results
      })
      console.log(JSON.stringify({ browser: launcher.name(), results }))
    } finally {
      await browser.close()
    }
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
