import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
  selectHtml,
} from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

test.describe("rendering", () => {
  let fixture: Fixture;
  let app: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
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

        "app/routes/index.jsx": js`
          export default function() {
            return <h2>Index</h2>;
          }
        `,
      },
    });

    app = await createAppFixture(fixture);
  });

  test.afterAll(async () => app.close());

  test("server renders matching routes", async () => {
    let res = await fixture.requestDocument("/");
    expect(res.status).toBe(200);
    expect(selectHtml(await res.text(), "#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Index</h2>
</div>`);
  });

  test("hydrates", async ({ page }) => {
    await app.goto(page, "/");
    expect(await app.getHtml(page, "#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Index</h2>
</div>`);
  });
});
