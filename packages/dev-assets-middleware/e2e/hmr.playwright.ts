/**
 * E2E tests for HMR middleware.
 *
 * These tests verify real HMR behavior by:
 * 1. Modifying files on disk
 * 2. Waiting for HMR updates via SSE
 * 3. Verifying the browser state
 */

import * as assert from 'node:assert/strict'
import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter, type Middleware } from '@remix-run/fetch-router'
import { devAssets } from '../src/lib/assets.ts'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let sourceFixturesDir = path.join(__dirname, 'fixtures')
let tmpBaseDir = path.join(__dirname, '.tmp')
let packageDir = path.join(__dirname, '..')

let browser: Browser
let page: Page

// Each test gets its own isolated temp directory, server, and port
let testContext: {
  tmpDir: string
  fixturesDir: string
  appDir: string
  publicDir: string
  server: http.Server
  assetsMiddleware: Middleware & { dispose?: () => Promise<void> }
  baseUrl: string
} | null = null

/**
 * Recursively copy directory contents
 *
 * @param src Source directory
 * @param dest Destination directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, { recursive: true })
  let entries = await fsp.readdir(src, { withFileTypes: true })

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name)
    let destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fsp.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Create isolated test context with fresh temp directory and server
 *
 * @returns Test context with temp directory, paths, server, and middleware
 */
async function createTestContext() {
  // Create temp directory within the e2e folder (stays in monorepo for module resolution)
  await fsp.mkdir(tmpBaseDir, { recursive: true })
  let tmpDir = await fsp.mkdtemp(path.join(tmpBaseDir, 'hmr-test-'))
  let fixturesDir = tmpDir
  let appDir = path.join(fixturesDir, 'app')
  let publicDir = path.join(fixturesDir, 'public')

  // Copy fixture files to temp directory
  await copyDir(path.join(sourceFixturesDir, 'app'), appDir)
  await copyDir(path.join(sourceFixturesDir, 'public'), publicDir)
  await fsp.copyFile(
    path.join(sourceFixturesDir, 'tsconfig.json'),
    path.join(fixturesDir, 'tsconfig.json'),
  )

  // Middleware to serve index.html for root path
  let serveIndex: Middleware = async (context, next) => {
    if (context.url.pathname === '/') {
      let html = await fsp.readFile(path.join(publicDir, 'index.html'), 'utf-8')
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    return next()
  }

  let assetsMiddleware: Middleware & { dispose?: () => Promise<void> } = devAssets({
    root: fixturesDir,
    allow: ['app/**'],
    hmr: true,
    workspace: {
      root: path.join(packageDir, '../..'), // monorepo root
      allow: ['**/node_modules/**', 'packages/**'],
    },
  })

  let router = createRouter({
    middleware: [assetsMiddleware, serveIndex],
  })

  let listener = createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error('[test-server] Error handling request:', error)
      return new Response('Internal Server Error: ' + (error as Error).message, { status: 500 })
    }
  })

  let httpServer = http.createServer(listener)

  let server = await new Promise<http.Server>((resolve, reject) => {
    httpServer.on('error', (error) => {
      console.error('[test-server] Server error:', error)
      reject(error)
    })

    // Use port 0 to let OS assign a random available port
    httpServer.listen(0, () => resolve(httpServer))
  })

  // Get the actual port assigned by the OS
  let address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server port')
  }
  let port = address.port
  let baseUrl = `http://localhost:${port}`

  return {
    tmpDir,
    fixturesDir,
    appDir,
    publicDir,
    server,
    assetsMiddleware,
    baseUrl,
  }
}

/**
 * Clean up test context
 *
 * @param context Test context to clean up
 */
async function cleanupTestContext(
  context: Awaited<ReturnType<typeof createTestContext>>,
): Promise<void> {
  // Clean up middleware resources (HMR watcher)
  if (context.assetsMiddleware?.dispose) {
    await context.assetsMiddleware.dispose()
  }

  // Close server
  if (context.server) {
    await new Promise<void>((resolve) => context.server.close(() => resolve()))
  }

  // Clean up temp directory
  if (context.tmpDir) {
    await fsp.rm(context.tmpDir, { recursive: true, force: true })
  }
}

/**
 * Get the number of tracked handles for a component from the browser
 *
 * @param page The Playwright page instance
 * @param moduleUrl The module URL (e.g., '/app/ConditionalChild.tsx')
 * @param componentName The component name (e.g., 'ConditionalChild')
 * @returns The number of tracked handles for the component
 */
async function getTrackedHandleCount(
  page: Page,
  moduleUrl: string,
  componentName: string,
): Promise<number> {
  return page.evaluate(
    async ({ moduleUrl, componentName }) => {
      // @ts-expect-error - Runtime module not typed in test context
      let { __hmr_get_tracked_handle_count } = await import('/__@remix/hmr-runtime.ts')
      return __hmr_get_tracked_handle_count(moduleUrl, componentName)
    },
    { moduleUrl, componentName },
  )
}

/**
 * Wait for HMR SSE connection to be established.
 * This ensures the browser is ready to receive HMR updates before modifying files.
 *
 * @param page The Playwright page instance
 */
async function waitForHmrConnection(page: Page) {
  await page.waitForFunction(
    async () => {
      // @ts-expect-error - Runtime module not typed in test context
      let { __hmr_get_connection_status } = await import('/__@remix/hmr-runtime.ts')
      return __hmr_get_connection_status()
    },
    { timeout: 5000 },
  )
}

describe('HMR E2E', () => {
  before(async () => {
    // Launch browser once for all tests
    browser = await chromium.launch({ headless: true })
  })

  beforeEach(async () => {
    // Create fresh test context (temp dir + server) for each test
    testContext = await createTestContext()

    // Create new page for each test
    page = await browser.newPage()

    // Capture browser console logs for debugging
    page.on('console', (msg) => {
      console.log(`[browser:${msg.type()}]`, msg.text())
    })
  })

  afterEach(async () => {
    // Close page after each test
    await page?.close()

    // Clean up test context (server + temp dir)
    if (testContext) {
      await cleanupTestContext(testContext)
      testContext = null
    }
  })

  after(async () => {
    await browser?.close()
  })

  describe('Basic HMR', () => {
    it('renders the counter initially', async () => {
      await page.goto(testContext!.baseUrl, { timeout: 10000 })

      // Wait for app to load
      await page.waitForSelector('[data-testid="app"]', { timeout: 10000 })
      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 0')
    })

    it('preserves state when render body changes', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })
      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 0')

      // Click to increment count
      await page.click('[data-testid="increment"]')
      await page.click('[data-testid="increment"]')
      await page.click('[data-testid="increment"]')

      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 3')

      // Modify the render body (not the setup)
      let counterPath = path.join(testContext!.appDir, 'Counter.tsx')
      let content = await fsp.readFile(counterPath, 'utf-8')
      let modified = content.replace('Increment', 'Increment (HMR)')
      await fsp.writeFile(counterPath, modified)

      // Wait for HMR update
      await page.waitForSelector('button:has-text("Increment (HMR)")', {
        timeout: 5000,
      })

      // Count should be preserved!
      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 3')
    })

    it('remounts when setup scope changes', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })

      // Click to increment count
      await page.click('[data-testid="increment"]')
      await page.click('[data-testid="increment"]')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 2')

      // Modify the setup scope (initial count value)
      let counterPath = path.join(testContext!.appDir, 'Counter.tsx')
      let content = await fsp.readFile(counterPath, 'utf-8')
      let modified = content.replace('let count = 0', 'let count = 100')
      await fsp.writeFile(counterPath, modified)

      // Wait for HMR update - count should reset to 100 (setup changed)
      await page.waitForFunction(
        () => {
          let el = document.querySelector('[data-testid="count"]')
          return el?.textContent === 'Count: 100'
        },
        { timeout: 5000 },
      )

      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 100')
    })

    it('propagates changes from imported modules', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })

      // Click to increment count
      await page.click('[data-testid="increment"]')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 1')

      // Modify utils.ts (imported by Counter)
      let utilsPath = path.join(testContext!.appDir, 'utils.ts')
      let content = await fsp.readFile(utilsPath, 'utf-8')
      let modified = content.replace('Count:', 'Total:')
      await fsp.writeFile(utilsPath, modified)

      // Wait for HMR update - format should change but count preserved
      await page.waitForFunction(
        () => {
          let el = document.querySelector('[data-testid="count"]')
          return el?.textContent === 'Total: 1'
        },
        { timeout: 5000 },
      )

      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Total: 1')
    })

    it('handles multiple rapid changes', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })

      // Click to increment count
      await page.click('[data-testid="increment"]')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 1')

      // Make multiple rapid changes to utils.ts
      let utilsPath = path.join(testContext!.appDir, 'utils.ts')
      let content = await fsp.readFile(utilsPath, 'utf-8')

      // First change
      await fsp.writeFile(utilsPath, content.replace('Count:', 'A:'))
      await new Promise((r) => setTimeout(r, 100))

      // Second change
      await fsp.writeFile(utilsPath, content.replace('Count:', 'B:'))
      await new Promise((r) => setTimeout(r, 100))

      // Third change (final)
      await fsp.writeFile(utilsPath, content.replace('Count:', 'Final:'))

      // Wait for final state
      await page.waitForFunction(
        () => {
          let el = document.querySelector('[data-testid="count"]')
          return el?.textContent === 'Final: 1'
        },
        { timeout: 5000 },
      )

      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Final: 1')
    })
  })

  describe('Conditional Rendering Cleanup', () => {
    it('cleans up HMR registry when components unmount', async () => {
      // Update the middleware to serve conditional HTML for root path
      let originalPublicDir = testContext!.publicDir

      // Temporarily copy conditional HTML as index.html
      let conditionalHtml = await fsp.readFile(
        path.join(originalPublicDir, 'index-conditional.html'),
        'utf-8',
      )
      let originalHtml = await fsp.readFile(path.join(originalPublicDir, 'index.html'), 'utf-8')
      await fsp.writeFile(path.join(originalPublicDir, 'index.html'), conditionalHtml)

      try {
        await page.goto(testContext!.baseUrl)
        await waitForHmrConnection(page)

        // Wait for app to load
        await page.waitForSelector('[data-testid="toggle-button"]', { timeout: 5000 })

        // Verify child is visible
        let childVisible = await page.isVisible('[data-testid="conditional-child"]')
        assert.equal(childVisible, true, 'Child should initially be visible')

        // Check HMR is tracking the component
        let trackedHandlesBefore = await getTrackedHandleCount(
          page,
          '/app/ConditionalChild.tsx',
          'ConditionalChild',
        )
        assert.equal(trackedHandlesBefore, 1, 'HMR should track 1 handle initially')

        // Hide the child component
        await page.click('[data-testid="toggle-button"]')

        // Wait for child to be removed from DOM
        await page.waitForSelector('[data-testid="conditional-child"]', {
          state: 'detached',
          timeout: 5000,
        })

        // Verify child is no longer in DOM
        childVisible = await page.isVisible('[data-testid="conditional-child"]')
        assert.equal(childVisible, false, 'Child should be hidden after toggle')

        // Check HMR registry state after unmount
        let trackedHandlesAfter = await getTrackedHandleCount(
          page,
          '/app/ConditionalChild.tsx',
          'ConditionalChild',
        )

        // THIS IS THE KEY ASSERTION
        // Without cleanup: trackedHandlesAfter = 1 (FAILS ❌)
        // With cleanup: trackedHandlesAfter = 0 (PASSES ✅)
        assert.equal(
          trackedHandlesAfter,
          0,
          'HMR should not track handles after component is unmounted',
        )
      } finally {
        // Restore original HTML
        await fsp.writeFile(path.join(originalPublicDir, 'index.html'), originalHtml)
      }
    })
  })

  describe('Multi-Component Modules', () => {
    it('renders both components from the same module', async () => {
      await page.goto(testContext!.baseUrl)

      // Wait for all components to load
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      let year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')
    })

    it('updates Header without affecting Footer state', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Verify initial state
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      let year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 0')

      // Increment counter to establish some state
      await page.click('[data-testid="increment"]')
      await page.click('[data-testid="increment"]')

      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 2')

      // Modify only the Header's render body in components.tsx
      let componentsPath = path.join(testContext!.appDir, 'components.tsx')
      let content = await fsp.readFile(componentsPath, 'utf-8')
      let modified = content.replace('Test App', 'Updated Header')
      await fsp.writeFile(componentsPath, modified)

      // Header should update
      await page.waitForFunction(
        () => {
          let el = document.querySelector('[data-testid="header-title"]')
          return el?.textContent === 'Updated Header'
        },
        { timeout: 5000 },
      )

      title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Updated Header')

      // Footer should be unchanged
      year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')

      // Counter state should be preserved (different module)
      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 2')
    })

    it('updates Footer without affecting Header state', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Verify initial state
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      let year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')

      // Modify only the Footer's render body in components.tsx
      let componentsPath = path.join(testContext!.appDir, 'components.tsx')
      let content = await fsp.readFile(componentsPath, 'utf-8')
      let modified = content.replace('© {year}', '© {year} All rights reserved')
      await fsp.writeFile(componentsPath, modified)

      // Footer should update
      await page.waitForFunction(
        () => {
          let el = document.querySelector('[data-testid="footer-year"]')
          return el?.textContent === '© 2024 All rights reserved'
        },
        { timeout: 5000 },
      )

      year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024 All rights reserved')

      // Header should be unchanged
      title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')
    })

    it('remounts Header when its setup scope changes', async () => {
      await page.goto(testContext!.baseUrl)
      await waitForHmrConnection(page)

      // Verify initial state
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      // Modify the Header's setup scope (title initialization)
      let componentsPath = path.join(testContext!.appDir, 'components.tsx')
      let content = await fsp.readFile(componentsPath, 'utf-8')
      let modified = content.replace("let title = 'Test App'", "let title = 'New Title'")
      await fsp.writeFile(componentsPath, modified)

      // Header should remount with new title
      await page.waitForFunction(
        () => {
          let el = document.querySelector('[data-testid="header-title"]')
          return el?.textContent === 'New Title'
        },
        { timeout: 5000 },
      )

      title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'New Title')

      // Footer should be unchanged
      let year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')
    })
  })

  describe('HMR Remount Cleanup', () => {
    it('triggers cleanup listeners when setup scope changes during remount', async () => {
      // Update the middleware to serve timer HTML for root path
      let originalPublicDir = testContext!.publicDir

      // Temporarily copy timer HTML as index.html
      let timerHtml = await fsp.readFile(path.join(originalPublicDir, 'index-timer.html'), 'utf-8')
      let originalHtml = await fsp.readFile(path.join(originalPublicDir, 'index.html'), 'utf-8')
      await fsp.writeFile(path.join(originalPublicDir, 'index.html'), timerHtml)

      try {
        await page.goto(testContext!.baseUrl)
        await waitForHmrConnection(page)

        // Wait for timer to load
        await page.waitForSelector('[data-testid="timer"]', { timeout: 5000 })

        // Initialize cleanup counter
        await page.evaluate(() => {
          ;(globalThis as any).__timer_cleanup_count = 0
        })

        // Verify cleanup hasn't been called yet
        let cleanupCountBefore = await page.evaluate(() => {
          return (globalThis as any).__timer_cleanup_count || 0
        })
        assert.equal(cleanupCountBefore, 0, 'Cleanup should not have been called yet')

        // Modify the setup scope to trigger remount
        let timerPath = path.join(testContext!.appDir, 'Timer.tsx')
        let content = await fsp.readFile(timerPath, 'utf-8')
        // Change the variable name to trigger setup hash change
        let modified = content
          .replace('let interval =', 'let timer =')
          .replace('clearInterval(interval)', 'clearInterval(timer)')
        await fsp.writeFile(timerPath, modified)

        // Wait a bit for HMR to process the change
        await new Promise((r) => setTimeout(r, 1000))

        // Verify cleanup was called during remount
        let cleanupCountAfter = await page.evaluate(() => {
          return (globalThis as any).__timer_cleanup_count || 0
        })

        // THIS IS THE KEY ASSERTION
        // Without the fix: cleanupCountAfter = 0 (FAILS ❌)
        // With the fix: cleanupCountAfter = 1 (PASSES ✅)
        assert.equal(
          cleanupCountAfter,
          1,
          'Cleanup listener should have been called once during remount',
        )
      } finally {
        // Restore original HTML
        await fsp.writeFile(path.join(originalPublicDir, 'index.html'), originalHtml)
      }
    })
  })
})
