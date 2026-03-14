#!/usr/bin/env node

import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseArgs } from 'node:util'

import { chromium } from 'playwright'

const PORT = 44100
const BASE_URL = `http://127.0.0.1:${PORT}`
const DEMO_DIR = import.meta.dirname ? path.dirname(import.meta.dirname) : process.cwd()
const ARTIFACTS_DIR = path.join(DEMO_DIR, '.artifacts')
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, 'screenshots')
const LATEST_SCREENSHOT = path.join(SCREENSHOTS_DIR, 'latest.png')
const LAST_RUN_FILE = path.join(ARTIFACTS_DIR, 'last-screenshot.json')

async function main() {
  let { values } = parseArgs({
    options: {
      name: { type: 'string' },
      width: { type: 'string', default: '1440' },
      height: { type: 'string', default: '1400' },
      selector: { type: 'string' },
      'full-page': { type: 'boolean', default: true },
      headless: { type: 'boolean', default: true },
    },
  })

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  let selector = values.selector
  let width = parseDimension(values.width, 'width')
  let height = parseDimension(values.height, 'height')
  let screenshotName = values.name ?? `theme-rmx-01-${createTimestamp()}`
  let screenshotPath = path.join(SCREENSHOTS_DIR, `${screenshotName}.png`)

  let ownedServer = false
  let serverProcess: ChildProcess | null = null

  try {
    if (!(await isServerAvailable())) {
      ownedServer = true
      serverProcess = startServer()
      await waitForServer()
    }

    let browser = await chromium.launch({ headless: values.headless })

    try {
      let page = await browser.newPage({
        viewport: {
          width,
          height,
        },
        deviceScaleFactor: 2,
      })

      await page.goto(BASE_URL, {
        waitUntil: 'networkidle',
      })

      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
      await page.evaluate(async () => {
        if ('fonts' in document) {
          await document.fonts.ready
        }
      })

      if (selector) {
        await page.locator(selector).first().screenshot({
          path: screenshotPath,
        })
      } else {
        await page.screenshot({
          path: screenshotPath,
          fullPage: values['full-page'],
        })
      }

      fs.copyFileSync(screenshotPath, LATEST_SCREENSHOT)
      fs.writeFileSync(
        LAST_RUN_FILE,
        JSON.stringify(
          {
            url: BASE_URL,
            selector: selector ?? null,
            latest: LATEST_SCREENSHOT,
            saved: screenshotPath,
            timestamp: new Date().toISOString(),
            viewport: { width, height },
          },
          null,
          2,
        ),
      )

      console.log(`Saved screenshot: ${screenshotPath}`)
      console.log(`Updated latest screenshot: ${LATEST_SCREENSHOT}`)
    } finally {
      await browser.close()
    }
  } finally {
    if (ownedServer && serverProcess) {
      await stopServer(serverProcess)
    }
  }
}

function parseDimension(value: string | undefined, name: string) {
  let parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`Expected ${name} to be a positive number`)
  }
  return parsed
}

function createTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function isServerAvailable() {
  let controller = new AbortController()
  let timeout = setTimeout(() => controller.abort(), 500)

  try {
    let response = await fetch(BASE_URL, {
      signal: controller.signal,
    })

    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function startServer() {
  let serverProcess = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: DEMO_DIR,
    stdio: 'pipe',
  })

  serverProcess.stdout?.on('data', chunk => {
    process.stdout.write(String(chunk))
  })

  serverProcess.stderr?.on('data', chunk => {
    process.stderr.write(String(chunk))
  })

  return serverProcess
}

async function waitForServer() {
  let start = Date.now()

  while (Date.now() - start < 15_000) {
    if (await isServerAvailable()) {
      return
    }

    await new Promise(resolve => setTimeout(resolve, 150))
  }

  throw new Error(`Timed out waiting for ${BASE_URL}`)
}

async function stopServer(serverProcess: ChildProcess) {
  if (serverProcess.killed) {
    return
  }

  serverProcess.kill('SIGTERM')

  await new Promise(resolve => {
    serverProcess.once('exit', resolve)
    setTimeout(resolve, 5_000)
  })
}

await main()
