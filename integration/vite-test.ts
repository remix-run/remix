import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import { PlaywrightFixture, selectHtml } from "./helpers/playwright-fixture.js";

test.describe("Vite", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      env: {
        REMIX_EXPERIMENTAL_VITE: "1",
      },
      files: {
        "remix.config.js": js`
          throw new Error("Remix should not access remix.config.js when using Vite");
          export default {};
        `,
        "vite.config.mjs": js`
          import { defineConfig } from "vite";
          import { experimental_remix } from "@remix-run/dev/vite";

          export default defineConfig({
            plugins: [experimental_remix()],
          });
        `,
        "app/root.tsx": js`
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <div id="content">
                    <h1>Root</h1>
                    <Outlet />
                  </div>
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/_index.tsx": js`
          export default function() {
            return <h2>Index</h2>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test("server renders matching routes", async () => {
    let res = await fixture.requestDocument("/");
    expect(res.status).toBe(200);
    expect(selectHtml(await res.text(), "#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Index</h2>
</div>`);
  });

  test("hydrates", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    expect(await app.getHtml("#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Index</h2>
</div>`);
  });
});
