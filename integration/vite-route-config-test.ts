import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";

import {
  type Files,
  createProject,
  viteBuild,
  test,
  viteConfig,
  createEditor,
} from "./helpers/vite.js";

const js = String.raw;

test.describe("route config", () => {
  test("fails the build if routes option is used", async () => {
    let cwd = await createProject({
      "vite.config.js": `
        import { vitePlugin as remix } from "@remix-run/dev";

        export default {
          plugins: [remix({
            routes: () => {},
          })]
        }
      `,
      "app/routes.ts": `export default INVALID(`,
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
            routes: () => {},
          })]
        }
      `,
      "app/routes.ts": `export default INVALID(`,
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
      "vite.config.js": await viteConfig.basic({ port }),
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
    page,
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({ port }),
      "app/routes.ts": js`
        import { type RouteConfig } from "@react-router/dev/routes";

        export const routes: RouteConfig = [
          {
            file: "test-route-1.tsx",
            index: true,
          },
        ];
      `,
      "app/test-route-1.tsx": `
        export default () => <div data-test-route>Test route 1</div>
      `,
      "app/test-route-2.tsx": `
        export default () => <div data-test-route>Test route 2</div>
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
      await page.reload();
      await expect(page.locator("[data-test-route]")).toHaveText(
        "Test route 2"
      );
    }).toPass();
  });

  test("supports correcting an invalid route config module graph", async ({
    page,
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({ port }),
      "app/routes.ts": js`
        export { routes } from "./actual-routes";
      `,
      "app/actual-routes.ts": js`
        import { type RouteConfig } from "@react-router/dev/routes";

        export const routes: RouteConfig = [
          {
            file: "test-route-1.tsx",
            index: true,
          },
        ];
      `,
      "app/test-route-1.tsx": `
        export default () => <div data-test-route>Test route 1</div>
      `,
      "app/test-route-2.tsx": `
        export default () => <div data-test-route>Test route 2</div>
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
      await page.reload();
      await expect(page.locator("[data-test-route]")).toHaveText(
        "Test route 2"
      );
    }).toPass();
  });

  test("supports correcting a missing route config", async ({
    page,
    viteDev,
  }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({ port }),
      "app/routes.ts": js`
        import { type RouteConfig } from "@react-router/dev/routes";

        export const routes: RouteConfig = [
          {
            file: "test-route-1.tsx",
            index: true,
          },
        ];
      `,
      "app/test-route-1.tsx": `
        export default () => <div data-test-route>Test route 1</div>
      `,
      "app/test-route-2.tsx": `
        export default () => <div data-test-route>Test route 2</div>
      `,
      "app/routes/_index.tsx": `
        export default () => <div data-test-route>FS route</div>
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

    await expect(async () => {
      // Reload to pick up classic FS routes
      await page.reload();
      await expect(page.locator("[data-test-route]")).toHaveText("FS route");
    }).toPass();

    // Ensure dev server falls back to FS routes + HMR
    await edit("app/routes/_index.tsx", (contents) =>
      contents.replace("FS route", "FS route updated")
    );
    await expect(page.locator("[data-test-route]")).toHaveText(
      "FS route updated"
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
      await page.reload();
      await expect(page.locator("[data-test-route]")).toHaveText(
        "Test route 2"
      );
    }).toPass();
  });

  test("supports absolute route file paths", async ({ page, viteDev }) => {
    let files: Files = async ({ port }) => ({
      "vite.config.js": await viteConfig.basic({ port }),
      "app/routes.ts": js`
        import path from "node:path";
        import { type RouteConfig } from "@react-router/dev/routes";

        export const routes: RouteConfig = [
          {
            file: path.resolve(import.meta.dirname, "test-route.tsx"),
            index: true,
          },
        ];
      `,
      "app/test-route.tsx": `
        export default () => <div data-test-route>Test route</div>
      `,
    });
    let { port } = await viteDev(files);

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-test-route]")).toHaveText("Test route");
  });
});
