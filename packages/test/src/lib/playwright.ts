import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { chromium, firefox, webkit } from 'playwright'
import type { BrowserContextOptions, LaunchOptions, PlaywrightTestConfig } from 'playwright/test'
import { tsImport } from 'tsx/esm/api'

export type PlaywrightUseOpts = PlaywrightTestConfig['use']

export async function loadPlaywrightConfig(
  input: string | undefined,
): Promise<PlaywrightTestConfig | undefined> {
  let candidates = input
    ? [path.resolve(process.cwd(), input)]
    : [
        path.join(process.cwd(), 'playwright.config.ts'),
        path.join(process.cwd(), 'playwright.config.js'),
      ]

  for (let configPath of candidates) {
    try {
      await fs.access(configPath)
      let mod = await tsImport(configPath, { parentURL: import.meta.url })
      return mod.default ?? mod
    } catch {
      // not found or failed to load — try next
    }
  }
}

const launchers = {
  chromium,
  firefox,
  webkit,
}

export function getBrowserLauncher(playwrightUseOpts?: PlaywrightUseOpts) {
  if (playwrightUseOpts?.browserName) {
    let launcher = launchers[playwrightUseOpts.browserName as keyof typeof launchers]
    if (!launcher) {
      let supportedBrowsers = Object.keys(launchers).join(', ')
      throw new Error(
        `Unsupported browser "${playwrightUseOpts.browserName}". ` +
          `Supported browsers are: ${supportedBrowsers}`,
      )
    }
    return launcher
  }
  return chromium
}

export function resolveProjects(
  config?: PlaywrightTestConfig,
): Array<{ name?: string; playwrightUseOpts: PlaywrightUseOpts }> {
  if (config?.projects?.length) {
    return config.projects.map((p) => ({
      name: p.name,
      playwrightUseOpts: { ...config.use, ...p.use },
    }))
  }
  return [
    {
      name: 'chromium',
      playwrightUseOpts: config?.use,
    },
  ]
}

export function getPlaywrightLaunchOptions(playwrightUseOpts?: PlaywrightUseOpts): LaunchOptions {
  return {
    headless: playwrightUseOpts?.headless,
    channel: playwrightUseOpts?.channel,
  }
}

export function getPlaywrightPageOptions(
  playwrightUseOpts?: PlaywrightUseOpts,
): BrowserContextOptions & { navigationTimeout?: number; actionTimeout?: number } {
  return {
    // Context options passed to browser.newPage()
    bypassCSP: playwrightUseOpts?.bypassCSP,
    colorScheme: playwrightUseOpts?.colorScheme,
    deviceScaleFactor: playwrightUseOpts?.deviceScaleFactor,
    extraHTTPHeaders: playwrightUseOpts?.extraHTTPHeaders,
    geolocation: playwrightUseOpts?.geolocation,
    hasTouch: playwrightUseOpts?.hasTouch,
    httpCredentials: playwrightUseOpts?.httpCredentials,
    ignoreHTTPSErrors: playwrightUseOpts?.ignoreHTTPSErrors,
    isMobile: playwrightUseOpts?.isMobile,
    javaScriptEnabled: playwrightUseOpts?.javaScriptEnabled,
    locale: playwrightUseOpts?.locale,
    offline: playwrightUseOpts?.offline,
    permissions: playwrightUseOpts?.permissions,
    storageState: playwrightUseOpts?.storageState,
    timezoneId: playwrightUseOpts?.timezoneId,
    userAgent: playwrightUseOpts?.userAgent,
    viewport: playwrightUseOpts?.viewport,
    // Additional options set on the page instance
    navigationTimeout: playwrightUseOpts?.navigationTimeout,
    actionTimeout: playwrightUseOpts?.actionTimeout,
  }
}
