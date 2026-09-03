import { expect } from '@remix-run/assert'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it } from '@remix-run/test'
import { build } from 'esbuild'
import { createElement } from '../runtime/create-element.ts'
import { renderToString } from '../server/stream.ts'

const lineCount = 20000
const largeText = Array.from({ length: lineCount }, (_, index) => `row-${index}`).join('\n')

async function createClientBundle(): Promise<string> {
  let result = await build({
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    stdin: {
      contents: `
        import { createElement, createRoot } from '../index.ts'

        let lineCount = ${lineCount}
        let largeText = Array.from({ length: lineCount }, (_, index) => \`row-\${index}\`).join('\\n')
        let container = document.querySelector('#root')
        if (!(container instanceof HTMLDivElement)) throw new Error('Expected root container')
        let existingPre = container.querySelector('pre')
        if (!(existingPre instanceof HTMLPreElement)) throw new Error('Expected server pre')
        let firstTextNode = existingPre.firstChild

        container.dataset.parserTextNodes = String(existingPre.childNodes.length)

        let root = createRoot(container)
        root.render(createElement('pre', undefined, largeText))
        root.flush()

        let hydratedPre = container.querySelector('pre')
        if (!(hydratedPre instanceof HTMLPreElement)) throw new Error('Expected hydrated pre')
        container.dataset.retainedPre = String(hydratedPre === existingPre)
        container.dataset.retainedFirstTextNode = String(hydratedPre.firstChild === firstTextNode)
        container.dataset.hydrated = 'true'
      `,
      loader: 'ts',
      resolveDir: import.meta.dirname,
      sourcefile: 'large-text-hydration-client.ts',
    },
  })

  let outputFile = result.outputFiles?.[0]
  if (!outputFile) throw new Error('Expected esbuild to produce a client bundle')
  return outputFile.text
}

describe('text hydration', () => {
  it('consolidates text nodes split by the HTML parser', async (t) => {
    let [serverMarkup, clientBundle] = await Promise.all([
      renderToString(createElement('pre', undefined, largeText)),
      createClientBundle(),
    ])

    let handler = (request: Request) => {
      let url = new URL(request.url)
      if (url.pathname === '/client.js') {
        return new Response(clientBundle, {
          headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
        })
      }
      if (url.pathname !== '/') return new Response('Not found', { status: 404 })

      return new Response(
        `<!doctype html><html><body><div id="root">${serverMarkup}</div><script type="module" src="/client.js"></script></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    }

    let page = await t.serve(await createTestServer(handler))
    await page.goto('/')
    await page.locator('#root[data-hydrated="true"]').waitFor()

    let container = page.locator('#root')
    let parserTextNodes = Number(await container.getAttribute('data-parser-text-nodes'))
    expect(parserTextNodes).toBeGreaterThan(1)
    expect(await container.getAttribute('data-retained-pre')).toBe('true')
    expect(await container.getAttribute('data-retained-first-text-node')).toBe('true')

    let hydratedPre = container.locator('pre')
    expect(await hydratedPre.evaluate((pre) => pre.childNodes.length)).toBe(1)
    let hydratedText = await hydratedPre.textContent()
    expect(hydratedText).toBe(largeText)
    expect(hydratedText?.split('\n').length).toBe(lineCount)
  })
})
