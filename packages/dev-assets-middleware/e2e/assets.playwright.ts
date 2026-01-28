import * as assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as http from 'node:http'
import { chromium, type Browser, type Page } from 'playwright'

import { createRouter, type Middleware } from '@remix-run/fetch-router'
import { createRequestListener } from '@remix-run/node-fetch-server'

import { devAssets } from '../src/lib/assets.ts'

let browser: Browser
let page: Page
let server: http.Server
let tmpDir: string
let baseUrl: string

// Test fixture files - plain JS/TS without external dependencies
let fixtureFiles = {
  'index.html': `<!DOCTYPE html>
<html>
<head><title>Test App</title></head>
<body>
  <div id="app"></div>
  <script type="module" src="/entry.ts"></script>
</body>
</html>`,

  'app/entry.ts': `import { greet } from './utils/greet.ts'
import { Counter } from './components/Counter.ts'

let app = document.getElementById('app')!
app.innerHTML = \`<h1>\${greet('World')}</h1>\`
app.appendChild(Counter())
`,

  'app/components/Counter.ts': `export function Counter(): HTMLElement {
  let count = 0
  
  let container = document.createElement('div')
  let countEl = document.createElement('p')
  countEl.id = 'count'
  countEl.textContent = \`Count: \${count}\`
  
  let button = document.createElement('button')
  button.id = 'increment'
  button.textContent = 'Increment'
  button.addEventListener('click', () => {
    count++
    countEl.textContent = \`Count: \${count}\`
  })
  
  container.appendChild(countEl)
  container.appendChild(button)
  return container
}
`,

  'app/utils/greet.ts': `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
}

async function createFixture(dir: string) {
  for (let [filePath, content] of Object.entries(fixtureFiles)) {
    let fullPath = path.join(dir, filePath)
    await fsp.mkdir(path.dirname(fullPath), { recursive: true })
    await fsp.writeFile(fullPath, content)
  }
}

async function startServer(
  appDir: string,
  publicDir: string,
  projectRoot: string,
): Promise<http.Server> {
  // Create middleware that serves index.html for the root path
  let serveIndex: Middleware = async (context, next) => {
    if (context.url.pathname === '/') {
      let html = await fsp.readFile(path.join(publicDir, 'index.html'), 'utf-8')
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      })
    }
    return next()
  }

  let router = createRouter({
    middleware: [
      serveIndex,
      devAssets({
        root: appDir,
        allow: [/.*/], // Allow all files in app dir for tests
        workspace: {
          root: projectRoot,
          allow: [/node_modules/, /^packages\//],
        },
      }),
    ],
  })

  let listener = createRequestListener((request) => router.fetch(request))
  let server = http.createServer(listener)

  return new Promise((resolve) => {
    // Use port 0 to let OS assign a random available port
    server.listen(0, () => resolve(server))
  })
}

describe('assets middleware e2e', () => {
  before(async () => {
    // Create temp directory with fixture
    tmpDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'assets-test-'))
    await createFixture(tmpDir)

    // Start server (projectRoot is the tmpDir, appDir is tmpDir/app)
    server = await startServer(path.join(tmpDir, 'app'), tmpDir, tmpDir)

    // Get the actual port assigned by the OS
    let address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server port')
    }
    baseUrl = `http://localhost:${address.port}`

    // Launch browser
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
  })

  after(async () => {
    await page?.close()
    await browser?.close()

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }

    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('loads the app without console errors', async () => {
    let consoleMessages: string[] = []
    let networkRequests: string[] = []

    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
    })

    page.on('requestfailed', (request) => {
      networkRequests.push(`FAILED: ${request.url()} - ${request.failure()?.errorText}`)
    })

    page.on('response', (response) => {
      if (!response.ok()) {
        networkRequests.push(`${response.status()}: ${response.url()}`)
      }
    })

    let response = await page.goto(baseUrl)
    assert.ok(response?.ok(), `Expected OK response, got ${response?.status()}`)

    // Wait for app to render (with shorter timeout for faster failure)
    try {
      await page.waitForSelector('h1', { timeout: 5000 })
    } catch {
      // Log what we got to help debug
      let html = await page.content()
      assert.fail(
        `Page didn't render h1.\n` +
          `Network failures: ${networkRequests.join('; ')}\n` +
          `Console: ${consoleMessages.join('; ')}\n` +
          `HTML: ${html.slice(0, 500)}`,
      )
    }

    let title = await page.textContent('h1')
    assert.ok(title?.includes('Hello'), `Expected greeting, got "${title}"`)

    let errors = consoleMessages.filter((m) => m.startsWith('[error]'))
    assert.deepEqual(errors, [], `Unexpected console errors: ${errors.join(', ')}`)
  })

  it('counter increments when clicked', async () => {
    await page.goto(baseUrl)
    await page.waitForSelector('#count')

    let initialCount = await page.textContent('#count')
    assert.equal(initialCount, 'Count: 0')

    await page.click('#increment')

    await page.waitForFunction(() => {
      return document.querySelector('#count')?.textContent === 'Count: 1'
    })

    let newCount = await page.textContent('#count')
    assert.equal(newCount, 'Count: 1')
  })

  it('serves transformed TypeScript', async () => {
    let response = await page.goto(`${baseUrl}/entry.ts`)
    assert.ok(response?.ok())

    let contentType = response?.headers()['content-type']
    assert.ok(contentType?.includes('application/javascript'))

    let body = await response?.text()
    // TypeScript type annotation should be stripped
    assert.ok(!body?.includes(': string'), 'Expected TypeScript to be transformed')
    // Imports should be resolved to absolute URLs
    assert.ok(body?.includes('/utils/greet.ts'), 'Expected import paths to be resolved')
  })

  it('returns 404 for non-existent files', async () => {
    let response = await page.goto(`${baseUrl}/does-not-exist.tsx`)
    assert.equal(response?.status(), 404)
  })
})
