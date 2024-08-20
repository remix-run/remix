import { expect } from "@playwright/test";
import dedent from "dedent";

import type { Files } from "./helpers/vite.js";
import { test, viteConfig } from "./helpers/vite.js";

let files: Files = async ({ port }) => ({
  "vite.config.ts": dedent`
    import { vitePlugin as remix } from "@remix-run/dev";
    
    export default {
      base: "http://localhost:${port}/",
      ${await viteConfig.server({ port })}
      plugins: [remix()],
    }
  `,
  "app/routes/_index.tsx": `
    export default () => <h1 data-title>This should work</h1>;
  `,
});

test.describe("Vite absolute base", () => {
  test("dev", async ({ page, viteDev }) => {
    let { port } = await viteDev(files);

    await page.goto(`http://localhost:${port}/`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("[data-title]")).toHaveText("This should work");
    expect(page.errors).toEqual([]);
  });

  test("build", async ({ page, viteRemixServe }) => {
    let { port } = await viteRemixServe(files);

    await page.goto(`http://localhost:${port}/`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("[data-title]")).toHaveText("This should work");
    expect(page.errors).toEqual([]);
  });
});
