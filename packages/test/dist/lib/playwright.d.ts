import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import type { PlaywrightTestConfig } from 'playwright/test';
export type PlaywrightUseOpts = PlaywrightTestConfig['use'];
export declare function loadPlaywrightConfig(input: string | undefined, cwd?: string): Promise<PlaywrightTestConfig | undefined>;
export declare function getBrowserLauncher(playwrightUseOpts?: PlaywrightUseOpts): import("playwright").BrowserType<{}>;
export declare function resolveProjects(config?: PlaywrightTestConfig): Array<{
    name?: string;
    playwrightUseOpts: PlaywrightUseOpts;
}>;
export declare function getPlaywrightLaunchOptions(playwrightUseOpts?: PlaywrightUseOpts): LaunchOptions;
export declare function getPlaywrightPageOptions(playwrightUseOpts?: PlaywrightUseOpts): BrowserContextOptions & {
    navigationTimeout?: number;
    actionTimeout?: number;
};
//# sourceMappingURL=playwright.d.ts.map