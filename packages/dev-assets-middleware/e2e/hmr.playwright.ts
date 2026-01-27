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
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let fixturesDir = path.join(__dirname, 'fixtures')
let appDir = path.join(fixturesDir, 'app')

let PORT = 44200
let BASE_URL = `http://localhost:${PORT}`

let browser: Browser
let page: Page

// Original file contents for restoration
let originalCounter: string
let originalUtils: string
let originalComponents: string

/**
 * Wait for HMR SSE connection to be established.
 * This ensures the browser is ready to receive HMR updates before modifying files.
 */
async function waitForHmrConnection(page: Page) {
  await page.waitForFunction(() => (window as any).__hmr_connected === true, {
    timeout: 5000,
  })
}

describe('HMR E2E', () => {
  before(async () => {
    // Save original files
    originalCounter = await fs.readFile(path.join(appDir, 'Counter.tsx'), 'utf-8')
    originalUtils = await fs.readFile(path.join(appDir, 'utils.ts'), 'utf-8')
    originalComponents = await fs.readFile(path.join(appDir, 'components.tsx'), 'utf-8')

    // Launch browser
    browser = await chromium.launch({ headless: true })
  })

  beforeEach(async () => {
    // Create new page for each test
    page = await browser.newPage()
  })

  afterEach(async () => {
    // Close page after each test
    await page?.close()

    // Restore original files after each test
    await fs.writeFile(path.join(appDir, 'Counter.tsx'), originalCounter)
    await fs.writeFile(path.join(appDir, 'utils.ts'), originalUtils)
    await fs.writeFile(path.join(appDir, 'components.tsx'), originalComponents)
    // Small delay for esbuild to rebuild before next test
    await new Promise((r) => setTimeout(r, 100))
  })

  after(async () => {
    await browser?.close()
  })

  describe('Basic HMR', () => {
    it('renders the counter initially', async () => {
      await page.goto(BASE_URL)

      // Wait for app to load
      await page.waitForSelector('[data-testid="app"]', { timeout: 5000 })
      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 0')
    })

    it('preserves state when render body changes', async () => {
      await page.goto(BASE_URL)
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
      let counterPath = path.join(appDir, 'Counter.tsx')
      let content = await fs.readFile(counterPath, 'utf-8')
      let modified = content.replace('Increment', 'Increment (HMR)')
      await fs.writeFile(counterPath, modified)

      // Wait for HMR update
      await page.waitForSelector('button:has-text("Increment (HMR)")', {
        timeout: 5000,
      })

      // Count should be preserved!
      count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 3')
    })

    it('remounts when setup scope changes', async () => {
      await page.goto(BASE_URL)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })

      // Click to increment count
      await page.click('[data-testid="increment"]')
      await page.click('[data-testid="increment"]')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 2')

      // Modify the setup scope (initial count value)
      let counterPath = path.join(appDir, 'Counter.tsx')
      let content = await fs.readFile(counterPath, 'utf-8')
      let modified = content.replace('let count = 0', 'let count = 100')
      await fs.writeFile(counterPath, modified)

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
      await page.goto(BASE_URL)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })

      // Click to increment count
      await page.click('[data-testid="increment"]')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 1')

      // Modify utils.ts (imported by Counter)
      let utilsPath = path.join(appDir, 'utils.ts')
      let content = await fs.readFile(utilsPath, 'utf-8')
      let modified = content.replace('Count:', 'Total:')
      await fs.writeFile(utilsPath, modified)

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
      await page.goto(BASE_URL)
      await waitForHmrConnection(page)

      // Wait for app to load
      await page.waitForSelector('[data-testid="count"]', { timeout: 5000 })

      // Click to increment count
      await page.click('[data-testid="increment"]')

      let count = await page.textContent('[data-testid="count"]')
      assert.equal(count, 'Count: 1')

      // Make multiple rapid changes to utils.ts
      let utilsPath = path.join(appDir, 'utils.ts')
      let content = await fs.readFile(utilsPath, 'utf-8')

      // First change
      await fs.writeFile(utilsPath, content.replace('Count:', 'A:'))
      await new Promise((r) => setTimeout(r, 100))

      // Second change
      await fs.writeFile(utilsPath, content.replace('Count:', 'B:'))
      await new Promise((r) => setTimeout(r, 100))

      // Third change (final)
      await fs.writeFile(utilsPath, content.replace('Count:', 'Final:'))

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

  describe('Multi-Component Modules', () => {
    it('renders both components from the same module', async () => {
      await page.goto(BASE_URL)

      // Wait for all components to load
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      let year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')
    })

    it('updates Header without affecting Footer state', async () => {
      await page.goto(BASE_URL)
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
      let componentsPath = path.join(appDir, 'components.tsx')
      let content = await fs.readFile(componentsPath, 'utf-8')
      let modified = content.replace('Test App', 'Updated Header')
      await fs.writeFile(componentsPath, modified)

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
      await page.goto(BASE_URL)
      await waitForHmrConnection(page)

      // Verify initial state
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      let year = await page.textContent('[data-testid="footer-year"]')
      assert.equal(year, '© 2024')

      // Modify only the Footer's render body in components.tsx
      let componentsPath = path.join(appDir, 'components.tsx')
      let content = await fs.readFile(componentsPath, 'utf-8')
      let modified = content.replace('© {year}', '© {year} All rights reserved')
      await fs.writeFile(componentsPath, modified)

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
      await page.goto(BASE_URL)
      await waitForHmrConnection(page)

      // Verify initial state
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 5000 })
      let title = await page.textContent('[data-testid="header-title"]')
      assert.equal(title, 'Test App')

      // Modify the Header's setup scope (title initialization)
      let componentsPath = path.join(appDir, 'components.tsx')
      let content = await fs.readFile(componentsPath, 'utf-8')
      let modified = content.replace("let title = 'Test App'", "let title = 'New Title'")
      await fs.writeFile(componentsPath, modified)

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
})
