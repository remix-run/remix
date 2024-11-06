import fs from "node:fs/promises";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";

import {
  type Files,
  createProject,
  viteBuild,
  test,
  viteConfig,
  createEditor,
} from "./helpers/vite.js";

const js = String.raw;

// This is a workaround for caching issues in WebKit
async function reloadPage({
  browserName,
  page,
  context,
}: {
  browserName: string;
  page: Page;
  context: BrowserContext;
}): Promise<Page> {
  if (browserName === "webkit") {
    let newPage = await context.newPage();
    let url = page.url();
    await page.close();
    await newPage.goto(url, { waitUntil: "networkidle" });
    return newPage;
  }

  await page.reload();
  return page;
}

test.describe("route config", () => {
  test("fails the build if route config is missing", async () => {
    let cwd = await createProject({
      "vite.config.js": `
        import { vitePlugin as remix } from "@remix-run/dev";

        export default {
          plugins: [remix({
            future: { unstable_routeConfig: true },
          })]
        }
      `,
    });
    // Ensure file is missing in case it's ever added to test fixture
    await fs.rm(path.join(cwd, "app/routes.ts"), { force: true });
    let buildResult = viteBuild({ cwd });
    expect(buildResult.status).toBe(1);
    expect(buildResult.stderr.toString()).toContain(
      'Route config file not found at "app/routes.ts"'
    );
  });

  test("fails the build if routes option is used", async () => {
    let cwd = await createProject({
      "vite.config.js": `
        import { vitePlugin as remix } from "@remix-run/dev";

        export default {
          plugins: [remix({
            future: { unstable_routeConfig: true },
            routes: () => {},
          })]
        }
      `,
      "app/routes.ts": `export const routes = [];`,
    });
    let buildResult = viteBuild({ cwd });
    expect(buildResult.status).toBe(1);
    expect(buildResult.stderr.toString()).toContain(
      'The "routes" config option is not supported when a "routes.ts" file is present. You should migrate these routes into "routes.ts".'
    );
  });

  test("fails the dev process if routes option is used", async ({
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": `
        import { vitePlugin as remix } from "@remix-run/dev";

        export default {
          ${await viteConfig.server({ port })}
          plugins: [remix({
            future: { unstable_routeConfig: true },
            routes: () => {},
          })]
        }
      `,
      "app/routes.ts": `export const routes = [];`,
    });
    let devError: Error | undefined;
    try {
      await viteDev(files);
    } catch (error: any) {
      devError = error;
    }
    expect(devError?.toString()).toContain(
      'The "routes" config option is not supported when a "routes.ts" file is present. You should migrate these routes into "routes.ts".'
    );
  });

  test("fails the build if route config is invalid", async () => {
    let cwd = await createProject({
      "vite.config.js": `
        import { vitePlugin as remix } from "@remix-run/dev";

        export default {
          plugins: [remix({
            future: { unstable_routeConfig: true },
          })]
        }
      `,
      "app/routes.ts": `export default INVALID(`,
    });
    let buildResult = viteBuild({ cwd });
    expect(buildResult.status).toBe(1);
    expect(buildResult.stderr.toString()).toContain(
      'Route config in "routes.ts" is invalid.'
    );
  });

  test("fails the dev process if route config is initially invalid", async ({
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({
        routeConfig: true,
        port,
      }),
      "app/routes.ts": `export default INVALID(`,
    });
    let devError: Error | undefined;
    try {
      await viteDev(files);
    } catch (error: any) {
      devError = error;
    }
    expect(devError?.toString()).toContain(
      'Route config in "routes.ts" is invalid.'
    );
  });

  test("supports correcting an invalid route config", async ({
    browserName,
    page,
    context,
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({
        routeConfig: true,
        port,
      }),
      "app/routes.ts": js`
        import { type RouteConfig, index } from "@remix-run/route-config";

        export const routes: RouteConfig = [
          index("test-route-1.tsx"),
        ];
      `,
      "app/test-route-1.tsx": `
        export default function TestRoute1() {
          return <div data-test-route>Test route 1</div>
        }
      `,
      "app/test-route-2.tsx": `
        export default function TestRoute2() {
          return <div data-test-route>Test route 2</div>
        }
      `,
    });
    let { cwd, port } = await viteDev(files);

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-test-route]")).toHaveText("Test route 1");

    let edit = createEditor(cwd);

    // Make config invalid
    await edit("app/routes.ts", (contents) => contents + "INVALID");

    // Ensure dev server is still running with old config + HMR
    await edit("app/test-route-1.tsx", (contents) =>
      contents.replace("Test route 1", "Test route 1 updated")
    );
    await expect(page.locator("[data-test-route]")).toHaveText(
      "Test route 1 updated"
    );

    // Fix config with new route
    await edit("app/routes.ts", (contents) =>
      contents.replace("INVALID", "").replace("test-route-1", "test-route-2")
    );

    await expect(async () => {
      // Reload to pick up new route for current path
      page = await reloadPage({ browserName, page, context });
      await expect(page.locator("[data-test-route]")).toHaveText(
        "Test route 2"
      );
    }).toPass();
  });

  test("supports correcting an invalid route config module graph", async ({
    page,
    context,
    browserName,
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({
        routeConfig: true,
        port,
      }),
      "app/routes.ts": js`
        export { routes } from "./actual-routes";
      `,
      "app/actual-routes.ts": js`
        import { type RouteConfig, index } from "@remix-run/route-config";

        export const routes: RouteConfig = [
          index("test-route-1.tsx"),
        ];
      `,
      "app/test-route-1.tsx": `
        export default function TestRoute1() {
          return <div data-test-route>Test route 1</div>
        }
      `,
      "app/test-route-2.tsx": `
        export default function TestRoute2() {
          return <div data-test-route>Test route 2</div>
        }
      `,
    });
    let { cwd, port } = await viteDev(files);

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-test-route]")).toHaveText("Test route 1");

    let edit = createEditor(cwd);

    // Make config invalid
    await edit("app/actual-routes.ts", (contents) => contents + "INVALID");

    // Ensure dev server is still running with old config + HMR
    await edit("app/test-route-1.tsx", (contents) =>
      contents.replace("Test route 1", "Test route 1 updated")
    );
    await expect(page.locator("[data-test-route]")).toHaveText(
      "Test route 1 updated"
    );

    // Fix config with new route
    await edit("app/actual-routes.ts", (contents) =>
      contents.replace("INVALID", "").replace("test-route-1", "test-route-2")
    );

    await expect(async () => {
      // Reload to pick up new route for current path
      page = await reloadPage({ browserName, page, context });
      await expect(page.locator("[data-test-route]")).toHaveText(
        "Test route 2"
      );
    }).toPass();
  });

  test("supports correcting a missing route config", async ({
    browserName,
    page,
    context,
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({
        routeConfig: true,
        port,
      }),
      "app/routes.ts": js`
        import { type RouteConfig, index } from "@remix-run/route-config";

        export const routes: RouteConfig = [
          index("test-route-1.tsx"),
        ];
      `,
      "app/test-route-1.tsx": `
        export default function TestRoute1() {
          return <div data-test-route>Test route 1</div>
        }
      `,
      "app/test-route-2.tsx": `
        export default function TestRoute2() {
          return <div data-test-route>Test route 2</div>
        }
      `,
    });
    let { cwd, port } = await viteDev(files);

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-test-route]")).toHaveText("Test route 1");

    let edit = createEditor(cwd);

    let INVALID_FILENAME = "app/routes.ts.oops";

    // Rename config to make it missing
    await fs.rename(
      path.join(cwd, "app/routes.ts"),
      path.join(cwd, INVALID_FILENAME)
    );

    // Ensure dev server is still running with old config + HMR
    await edit("app/test-route-1.tsx", (contents) =>
      contents.replace("Test route 1", "Test route 1 updated")
    );
    await expect(page.locator("[data-test-route]")).toHaveText(
      "Test route 1 updated"
    );

    // Add new route
    await edit(INVALID_FILENAME, (contents) =>
      contents.replace("test-route-1", "test-route-2")
    );

    // Rename config to bring it back
    await fs.rename(
      path.join(cwd, INVALID_FILENAME),
      path.join(cwd, "app/routes.ts")
    );

    await expect(async () => {
      // Reload to pick up new route for current path
      page = await reloadPage({ browserName, page, context });
      await expect(page.locator("[data-test-route]")).toHaveText(
        "Test route 2"
      );
    }).toPass();
  });

  test("supports absolute route file paths", async ({ page, viteDev }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({
        routeConfig: true,
        port,
      }),
      "app/routes.ts": js`
        import path from "node:path";
        import { type RouteConfig, index } from "@remix-run/route-config";

        export const routes: RouteConfig = [
          index(path.resolve(import.meta.dirname, "test-route.tsx")),
        ];
      `,
      "app/test-route.tsx": `
        export default function TestRoute() {
          return <div data-test-route>Test route</div>
        }
      `,
    });
    let { port } = await viteDev(files);

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-test-route]")).toHaveText("Test route");
  });
});
