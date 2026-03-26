import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { chromium, firefox, webkit } from 'playwright'
import type { PlaywrightTestConfig } from 'playwright/test'
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
      name: p.name as string | undefined,
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

export function getPlaywrightLaunchOptions(playwrightUseOpts?: PlaywrightUseOpts) {
  return {
    headless: playwrightUseOpts?.headless,
    channel: playwrightUseOpts?.channel,
  }
}

export function getPlaywrightPageOptions(playwrightUseOpts?: PlaywrightUseOpts) {
  return {
    viewport: playwrightUseOpts?.viewport,
    userAgent: playwrightUseOpts?.userAgent,
    locale: playwrightUseOpts?.locale,
    timezoneId: playwrightUseOpts?.timezoneId,
    geolocation: playwrightUseOpts?.geolocation,
    permissions: playwrightUseOpts?.permissions,
    extraHTTPHeaders: playwrightUseOpts?.extraHTTPHeaders,
    colorScheme: playwrightUseOpts?.colorScheme,
    isMobile: playwrightUseOpts?.isMobile,
    hasTouch: playwrightUseOpts?.hasTouch,
    deviceScaleFactor: playwrightUseOpts?.deviceScaleFactor,
    ignoreHTTPSErrors: playwrightUseOpts?.ignoreHTTPSErrors,
    httpCredentials: playwrightUseOpts?.httpCredentials,
    storageState: playwrightUseOpts?.storageState,
    bypassCSP: playwrightUseOpts?.bypassCSP,
    offline: playwrightUseOpts?.offline,
    javaScriptEnabled: playwrightUseOpts?.javaScriptEnabled,
  }
}
