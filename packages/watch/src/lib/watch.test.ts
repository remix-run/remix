import * as assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, afterEach } from 'node:test'

let __dirname = dirname(fileURLToPath(import.meta.url))

// Clean up debug log files before tests start
try {
  await rm('/tmp/sidebar-debug.log', { force: true })
} catch {
  // Ignore if file doesn't exist
}

/**
 * Integration tests for @remix-run/watch
 */

type TestApp = {
  dir: string
  process?: ChildProcess
  output: string[]
}

let apps: TestApp[] = []

afterEach(async () => {
  // Clean up all test apps
  for (let app of apps) {
    if (app.process && app.process.pid) {
      // Kill the supervisor and all its children using tree-kill approach
      try {
        // Use pkill to kill process and all descendants
        let { execSync } = await import('node:child_process')
        try {
          execSync(`pkill -9 -P ${app.process.pid}`, { stdio: 'ignore' })
        } catch {
          // Ignore if no children
        }
        app.process.kill('SIGKILL')
      } catch (err) {
        // Already dead
      }
      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    try {
      await rm(app.dir, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  }
  apps = []

  // Extra cleanup: ensure port 44100 is free
  await new Promise((resolve) => setTimeout(resolve, 500))
})

/**
 * Create a test app in a temporary directory within the watch package
 * (so it has access to workspace dependencies)
 */
async function createTestApp(files: Record<string, string>): Promise<TestApp> {
  // Create temp dir inside watch package's .tmp directory
  let watchPackageDir = join(__dirname, '../..')
  let tmpBaseDir = join(watchPackageDir, '.tmp')
  await mkdir(tmpBaseDir, { recursive: true })

  let dir = await mkdtemp(join(tmpBaseDir, 'test-'))

  // Create node_modules symlink to access workspace packages
  let { symlink } = await import('node:fs/promises')
  let monorepoRoot = join(watchPackageDir, '../..')
  let monorepoNodeModules = join(monorepoRoot, 'node_modules')
  let testNodeModules = join(dir, 'node_modules')

  try {
    await symlink(monorepoNodeModules, testNodeModules, 'dir')
  } catch (err) {
    // Might fail if node_modules doesn't exist, that's ok
  }

  for (let [filePath, content] of Object.entries(files)) {
    let fullPath = join(dir, filePath)
    let dirPath = dirname(fullPath)
    await mkdir(dirPath, { recursive: true })
    await writeFile(fullPath, content)
  }

  let app: TestApp = {
    dir,
    output: [],
  }

  apps.push(app)
  return app
}

/**
 * Start remix-watch for the app
 */
function startWatch(app: TestApp, entryFile: string, cliArgs: string[] = []): void {
  let watchCli = join(__dirname, '../../bin/remix-watch.js')

  app.process = spawn(
    'node',
    ['--disable-warning=ExperimentalWarning', watchCli, entryFile, ...cliArgs],
    {
      cwd: app.dir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  app.process.stdout?.on('data', (data) => {
    app.output.push(data.toString())
  })

  app.process.stderr?.on('data', (data) => {
    app.output.push(data.toString())
  })
}

/**
 * Wait for specific output to appear
 */
async function waitForOutput(app: TestApp, text: string, timeout = 10000): Promise<void> {
  let start = Date.now()

  while (Date.now() - start < timeout) {
    if (app.output.some((line) => line.includes(text))) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Timeout waiting for "${text}". Output:\n${app.output.join('')}`)
}

/**
 * Modify a file
 */
async function modifyFile(app: TestApp, filePath: string, content: string): Promise<void> {
  await writeFile(join(app.dir, filePath), content)
  // Give file watcher time to detect the change
  await new Promise((resolve) => setTimeout(resolve, 200))
}

describe('watch integration', () => {
  it('should start and detect component as HMR boundary', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { Greeting } from './greeting.js'
        
        // Call component to simulate usage
        let greeting = Greeting({ signal: new AbortController().signal })
        let result = greeting()
        console.log('Result:', result)
        console.log('Server ready')
      `,
      'greeting.js': `
        // Component pattern: function taking handle, returning render function
        export function Greeting(handle) {
          return () => 'Hello, World!'
        }
      `,
    })

    startWatch(app, 'server.js')

    // Wait for HMR to be ready
    await waitForOutput(app, '[remix-watch] HMR ready', 15000)

    // Verify component was detected
    let fullOutput = app.output.join('')
    assert.ok(fullOutput.includes('HMR boundary'), 'Component should be detected as HMR boundary')
  })

  it('should trigger HMR when component changes', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Greeting } from './greeting.js'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(createElement(Greeting, { name: 'World' }))
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'greeting.js': `
        export function Greeting() {
          return ({ name }) => 'Hello, ' + name + '!'
        }
      `,
    })

    startWatch(app, 'server.js')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    // Make initial request
    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /Hello, World!/)

    // Modify the component
    await modifyFile(
      app,
      'greeting.js',
      `
        export function Greeting() {
          return ({ name }) => 'Hello, Updated ' + name + '!'
        }
      `,
    )

    // Should see HMR fire emoji
    await waitForOutput(app, '🔥', 5000)

    // Should NOT see restart (HMR should handle it)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Server should not restart for component changes')

    // Make another request - should see updated content
    let response2 = await fetch('http://localhost:44100/')
    let html2 = await response2.text()
    assert.match(html2, /Hello, Updated World!/)
  })

  it('should handle adding a new component dynamically', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Greeting } from './greeting.js'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(createElement(Greeting, { name: 'World' }))
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'greeting.js': `
        export function Greeting() {
          return ({ name }) => 'Hello, ' + name + '!'
        }
      `,
    })

    startWatch(app, 'server.js')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /Hello, World!/)

    // Add a new component file
    await writeFile(
      join(app.dir, 'footer.js'),
      `
        export function Footer() {
          return () => '<footer>Footer content</footer>'
        }
      `,
    )

    // Wait a bit for file system to settle
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Now update server.js to import and use the new component
    app.output = []
    await modifyFile(
      app,
      'server.js',
      `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Greeting } from './greeting.js'
        import { Footer } from './footer.js'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let greeting = await renderToString(createElement(Greeting, { name: 'World' }))
          let footer = await renderToString(createElement(Footer, {}))
          return new Response(greeting + footer, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
    )

    // Should restart (server.js changed)
    await waitForOutput(app, 'Restarting:', 5000)
    await waitForOutput(app, '[remix-watch] HMR ready', 5000)
    await new Promise((resolve) => setTimeout(resolve, 500))

    let response2 = await fetch('http://localhost:44100/')
    let html2 = await response2.text()
    assert.match(html2, /Hello, World!/)
    assert.match(html2, /Footer content/)

    // Now edit the new component - should HMR without restart
    app.output = []
    await modifyFile(
      app,
      'footer.js',
      `
        export function Footer() {
          return () => '<footer>Updated footer</footer>'
        }
      `,
    )

    await waitForOutput(app, '🔥', 5000)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should not restart for component changes')

    let response3 = await fetch('http://localhost:44100/')
    let html3 = await response3.text()
    assert.match(html3, /Updated footer/)
  })

  it('should handle component importing another component', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Page } from './page.js'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(createElement(Page, {}))
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'page.js': `
        export function Page() {
          return () => '<div>Just a page</div>'
        }
      `,
    })

    startWatch(app, 'server.js')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /Just a page/)

    // Create a header component
    await writeFile(
      join(app.dir, 'header.js'),
      `
        export function Header() {
          return () => '<header>My Header</header>'
        }
      `,
    )
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Update page to import header - this should trigger HMR for page
    app.output = []
    await modifyFile(
      app,
      'page.js',
      `
        import { Header } from './header.js'
        
        export function Page() {
          // Importing header to test module graph tracking
          return () => '<header>My Header</header><div>Page with header</div>'
        }
      `,
    )

    // Page is a component, so this should HMR
    await waitForOutput(app, '🔥', 5000)
    await waitForOutput(app, '✅ Hot update applied', 2000)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should not restart when component adds import')

    let response2 = await fetch('http://localhost:44100/')
    let html2 = await response2.text()
    assert.match(html2, /My Header/)
    assert.match(html2, /Page with header/)

    // Now edit the header component - should HMR (header is a component)
    app.output = []
    await modifyFile(
      app,
      'header.js',
      `
        export function Header() {
          return () => '<header>Updated Header</header>'
        }
      `,
    )

    // Should HMR the header component (and potentially Page as an importer)
    await waitForOutput(app, '🔥', 5000)
    await waitForOutput(app, '✅ Hot update applied', 2000)
    hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should not restart for nested component changes')

    // Verify HMR happened by checking output includes the HMR fire message
    let hasHMRFire = app.output.some((line) => line.includes('🔥'))
    assert.strictEqual(hasHMRFire, true, 'HMR should fire for component changes')
  })

  it('should handle removing an import from a component', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Page } from './page.js'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(createElement(Page, {}))
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'page.js': `
        import { Sidebar } from './sidebar.js'
        
        export function Page() {
          // Importing sidebar to test module graph tracking
          return () => '<div><aside>Sidebar</aside><main>Content</main></div>'
        }
      `,
      'sidebar.js': `
        export function Sidebar() {
          return () => '<aside>Sidebar</aside>'
        }
      `,
    })

    startWatch(app, 'server.js')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /Sidebar/)
    assert.match(html1, /Content/)

    // Edit sidebar - should HMR
    app.output = []
    await modifyFile(
      app,
      'sidebar.js',
      `
        export function Sidebar() {
          return () => '<aside>Updated Sidebar</aside>'
        }
      `,
    )

    await waitForOutput(app, '🔥', 5000)
    await waitForOutput(app, '✅ Hot update applied', 2000)

    // Verify HMR happened
    let hasHMRFire = app.output.some((line) => line.includes('🔥'))
    assert.strictEqual(hasHMRFire, true, 'HMR should fire for component changes')

    // Remove the sidebar import from page - should HMR the page
    app.output = []
    await modifyFile(
      app,
      'page.js',
      `
        export function Page() {
          return () => '<div><main>Content without sidebar</main></div>'
        }
      `,
    )

    await waitForOutput(app, '🔥', 5000)
    await waitForOutput(app, '✅ Hot update applied', 2000)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should not restart when removing component import')

    let response3 = await fetch('http://localhost:44100/')
    let html3 = await response3.text()
    assert.match(html3, /Content without sidebar/)
    assert.doesNotMatch(html3, /Sidebar/)

    // Now edit sidebar again - should NOT trigger HMR since it's no longer imported
    app.output = []
    await modifyFile(
      app,
      'sidebar.js',
      `
        export function Sidebar() {
          return () => '<aside>This should not appear</aside>'
        }
      `,
    )

    // Wait a bit to ensure no HMR happens
    await new Promise((resolve) => setTimeout(resolve, 1000))

    let hasHMR = app.output.some((line) => line.includes('🔥'))
    assert.strictEqual(hasHMR, false, 'Should not HMR for unused component')

    // Content should be unchanged
    let response4 = await fetch('http://localhost:44100/')
    let html4 = await response4.text()
    assert.match(html4, /Content without sidebar/)
    assert.doesNotMatch(html4, /This should not appear/)
  })

  it('should handle importing non-component utils', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Greeting } from './greeting.js'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(createElement(Greeting, { name: 'World' }))
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'greeting.js': `
        export function Greeting() {
          return ({ name }) => 'Hello, ' + name + '!'
        }
      `,
    })

    startWatch(app, 'server.js')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    // Create a utils file
    await writeFile(
      join(app.dir, 'utils.js'),
      `
        export function formatName(name) {
          return name.toUpperCase()
        }
      `,
    )
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Update greeting to use the util
    app.output = []
    await modifyFile(
      app,
      'greeting.js',
      `
        import { formatName } from './utils.js'
        
        export function Greeting() {
          return ({ name }) => 'Hello, ' + formatName(name) + '!'
        }
      `,
    )

    // Component changed, should HMR
    await waitForOutput(app, '🔥', 5000)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should not restart when component imports util')

    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /Hello, WORLD!/)

    // Edit the util - should trigger restart (non-component change)
    app.output = []
    await modifyFile(
      app,
      'utils.js',
      `
        export function formatName(name) {
          return '**' + name.toUpperCase() + '**'
        }
      `,
    )

    // Utils are not components, so should restart
    await waitForOutput(app, 'Restarting:', 5000)
    await waitForOutput(app, '[remix-watch] HMR ready', 5000)
    await new Promise((resolve) => setTimeout(resolve, 500))

    let response2 = await fetch('http://localhost:44100/')
    let html2 = await response2.text()
    assert.match(html2, /Hello, \*\*WORLD\*\*!/)
  })

  it('should restart when non-component changes', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        
        let message = 'Original'
        
        let router = createRouter()
        router.get('/', () => new Response(message))
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
    })

    startWatch(app, 'server.js')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    // Make initial request
    let response1 = await fetch('http://localhost:44100/')
    let text1 = await response1.text()
    assert.strictEqual(text1, 'Original')

    // Clear output to make sure we see new messages
    app.output = []

    // Modify server.js (non-component change)
    await modifyFile(
      app,
      'server.js',
      `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        
        let message = 'Updated'
        
        let router = createRouter()
        router.get('/', () => new Response(message))
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
    )

    // Should see restart message
    await waitForOutput(app, 'Restarting:', 5000)

    // Wait for server to be ready again
    // Note: After restart, HMR setup happens again
    await waitForOutput(app, '[remix-watch] HMR ready', 5000)

    // Give the server a moment to fully start listening
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Make another request - should see updated content after restart
    let response2 = await fetch('http://localhost:44100/')
    let text2 = await response2.text()
    assert.strictEqual(text2, 'Updated')
  })

  it('should handle TypeScript files (.ts)', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.ts': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { formatMessage } from './utils.ts'
        
        let router = createRouter()
        router.get('/', () => new Response(formatMessage('TypeScript')))
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'utils.ts': `
        export function formatMessage(lang: string): string {
          return \`Hello from \${lang}!\`
        }
      `,
    })

    startWatch(app, 'server.ts')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let text1 = await response1.text()
    assert.strictEqual(text1, 'Hello from TypeScript!')

    // Modify utils - should restart (non-component)
    app.output = []
    await modifyFile(
      app,
      'utils.ts',
      `
        export function formatMessage(lang: string): string {
          return \`Updated from \${lang}!\`
        }
      `,
    )

    await waitForOutput(app, 'Restarting:', 5000)
    await waitForOutput(app, '[remix-watch] HMR ready', 5000)
    await new Promise((resolve) => setTimeout(resolve, 500))

    let response2 = await fetch('http://localhost:44100/')
    let text2 = await response2.text()
    assert.strictEqual(text2, 'Updated from TypeScript!')
  })

  it('should handle TSX files with JSX syntax', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component',
        },
      }),
      'server.ts': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Card } from './card.tsx'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(createElement(Card, { title: 'TSX Test', content: 'JSX works!' }))
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'card.tsx': `
        type CardProps = {
          title: string
          content: string
        }
        
        export function Card() {
          return ({ title, content }: CardProps) => (
            <div className="card">
              <h2>{title}</h2>
              <p>{content}</p>
            </div>
          )
        }
      `,
    })

    startWatch(app, 'server.ts')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /TSX Test/)
    assert.match(html1, /JSX works!/)

    // Modify the component - should HMR
    app.output = []
    await modifyFile(
      app,
      'card.tsx',
      `
        type CardProps = {
          title: string
          content: string
        }
        
        export function Card() {
          return ({ title, content }: CardProps) => (
            <div className="card updated">
              <h2>{title} (Updated)</h2>
              <p>{content}</p>
            </div>
          )
        }
      `,
    )

    await waitForOutput(app, '🔥', 5000)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should not restart for component changes')

    let response2 = await fetch('http://localhost:44100/')
    let html2 = await response2.text()
    assert.match(html2, /TSX Test \(Updated\)/)
  })

  it('should detect components in TSX files', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component',
        },
      }),
      'server.ts': `
        import { Button } from './button.tsx'
        
        let btn = Button({ signal: new AbortController().signal })
        let result = btn({ label: 'Click me' })
        console.log('Button result:', result)
        console.log('Server ready')
      `,
      'button.tsx': `
        type ButtonProps = {
          label: string
        }
        
        export function Button() {
          return ({ label }: ButtonProps) => <button>{label}</button>
        }
      `,
    })

    startWatch(app, 'server.ts')

    await waitForOutput(app, '[remix-watch] HMR ready', 15000)

    // Verify component was detected in .tsx file
    let fullOutput = app.output.join('')
    assert.ok(
      fullOutput.includes('HMR boundary'),
      'Component in .tsx file should be detected as HMR boundary',
    )
    assert.ok(fullOutput.includes('button.tsx'), 'Should mention button.tsx as HMR boundary')
  })

  it('should handle mixed TypeScript types and JSX in components', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@remix-run/component',
        },
      }),
      'server.ts': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { UserProfile } from './profile.tsx'
        
        let router = createRouter()
        
        router.get('/', async () => {
          let html = await renderToString(
            createElement(UserProfile, { name: 'Alice', age: 30, active: true })
          )
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'profile.tsx': `
        interface User {
          name: string
          age: number
          active: boolean
        }
        
        type ProfileProps = User & {
          className?: string
        }
        
        export function UserProfile() {
          return ({ name, age, active, className = 'profile' }: ProfileProps) => {
            let status: string = active ? 'Active' : 'Inactive'
            return (
              <div className={className}>
                <h1>{name}</h1>
                <p>Age: {age}</p>
                <span className="status">{status}</span>
              </div>
            )
          }
        }
      `,
    })

    startWatch(app, 'server.ts')
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let html1 = await response1.text()
    assert.match(html1, /Alice/)
    assert.match(html1, /Age: 30/)
    assert.match(html1, /Active/)

    // Modify component with type changes - should HMR
    app.output = []
    await modifyFile(
      app,
      'profile.tsx',
      `
        interface User {
          name: string
          age: number
          active: boolean
        }
        
        type ProfileProps = User & {
          className?: string
        }
        
        export function UserProfile() {
          return ({ name, age, active, className = 'profile' }: ProfileProps) => {
            let status: string = active ? '✅ Active' : '❌ Inactive'
            let ageGroup: string = age >= 30 ? 'Senior' : 'Junior'
            return (
              <div className={className}>
                <h1>{name}</h1>
                <p>Age: {age} ({ageGroup})</p>
                <span className="status">{status}</span>
              </div>
            )
          }
        }
      `,
    )

    await waitForOutput(app, '🔥', 5000)
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Should HMR for .tsx component changes')

    let response2 = await fetch('http://localhost:44100/')
    let html2 = await response2.text()
    assert.match(html2, /Alice/)
    assert.match(html2, /Age: 30 \(Senior\)/)
    assert.match(html2, /✅ Active/)
  })

  it('should respect --ignore (ignored files do not trigger restart)', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        import { createElement } from '@remix-run/component'
        import { renderToString } from '@remix-run/component/server'
        import { Greeting } from './greeting.js'
        import { getConfig } from './ignored-config.js'
        
        let router = createRouter()
        router.get('/', async () => {
          let html = await renderToString(createElement(Greeting, { name: 'World' }))
          return new Response(html + ' config=' + getConfig(), { headers: { 'Content-Type': 'text/html' } })
        })
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'greeting.js': `
        export function Greeting() {
          return ({ name }) => 'Hello, ' + name + '!'
        }
      `,
      'ignored-config.js': `
        export function getConfig() {
          return 'v1'
        }
      `,
    })

    startWatch(app, 'server.js', ['--ignore', 'ignored-config'])
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    let response1 = await fetch('http://localhost:44100/')
    let text1 = await response1.text()
    assert.match(text1, /Hello, World!/)
    assert.match(text1, /config=v1/)

    app.output = []
    await modifyFile(
      app,
      'ignored-config.js',
      `
        export function getConfig() {
          return 'v2'
        }
      `,
    )

    await new Promise((resolve) => setTimeout(resolve, 1500))
    let hasRestart = app.output.some((line) => line.includes('Restarting:'))
    assert.strictEqual(hasRestart, false, 'Ignored file change should not trigger restart')

    let response2 = await fetch('http://localhost:44100/')
    let text2 = await response2.text()
    assert.match(
      text2,
      /config=v1/,
      'Server still has old config because ignored file was not reloaded',
    )
  })

  it('should respect --watch (additional files trigger restart)', async () => {
    let app = await createTestApp({
      'package.json': JSON.stringify({ type: 'module' }),
      'server.js': `
        import { createServer } from 'node:http'
        import { createRouter } from '@remix-run/fetch-router'
        
        let router = createRouter()
        router.get('/', () => new Response('ok'))
        
        let server = createServer(async (req, res) => {
          let response = await router.fetch(new URL(req.url, 'http://localhost:44100'))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        })
        
        server.listen(44100, () => {
          console.log('Server ready on http://localhost:44100')
        })
        
        process.on('SIGINT', () => {
          server.close(() => process.exit(0))
        })
      `,
      'config.json': '{"version":1}',
    })

    startWatch(app, 'server.js', ['--watch', 'config.json'])
    await waitForOutput(app, 'Server ready on http://localhost:44100', 15000)

    app.output = []
    await modifyFile(app, 'config.json', '{"version":2}')

    await waitForOutput(app, 'Restarting:', 5000)
    assert.ok(
      app.output.some((line) => line.includes('config.json')),
      'Restart reason should mention config.json',
    )
  })
})
