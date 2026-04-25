import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import { importModule } from "./import-module.js";
export async function loadPlaywrightConfig(input) {
    let candidates = input
        ? [path.resolve(process.cwd(), input)]
        : [
            path.join(process.cwd(), 'playwright.config.ts'),
            path.join(process.cwd(), 'playwright.config.js'),
        ];
    for (let configPath of candidates) {
        try {
            await fs.access(configPath);
            let mod = await importModule(configPath, import.meta);
            return mod.default ?? mod;
        }
        catch {
            // not found or failed to load — try next
        }
    }
}
const launchers = {
    chromium,
    firefox,
    webkit,
};
export function getBrowserLauncher(playwrightUseOpts) {
    if (playwrightUseOpts?.browserName) {
        let launcher = launchers[playwrightUseOpts.browserName];
        if (!launcher) {
            let supportedBrowsers = Object.keys(launchers).join(', ');
            throw new Error(`Unsupported browser "${playwrightUseOpts.browserName}". ` +
                `Supported browsers are: ${supportedBrowsers}`);
        }
        return launcher;
    }
    return chromium;
}
export function resolveProjects(config) {
    if (config?.projects?.length) {
        return config.projects.map((p) => ({
            name: p.name,
            playwrightUseOpts: { ...config.use, ...p.use },
        }));
    }
    return [
        {
            name: 'chromium',
            playwrightUseOpts: config?.use,
        },
    ];
}
export function getPlaywrightLaunchOptions(playwrightUseOpts) {
    return {
        headless: playwrightUseOpts?.headless,
        channel: playwrightUseOpts?.channel,
    };
}
export function getPlaywrightPageOptions(playwrightUseOpts) {
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
    };
}
