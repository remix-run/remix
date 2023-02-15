import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    future: { v2_routeConvention: true },
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

      "app/routes/_index.jsx": js`
        export default function () {
          return <h2>Index</h2>;
        }
      `,

      "app/routes/folder/route.jsx": js`
        export default function () {
          return <h2>Folder (Route.jsx)</h2>;
        }
      `,

      "app/routes/folder2/index.jsx": js`
        export default function () {
          return <h2>Folder (Index.jsx)</h2>;
        }
      `,

      "app/routes/flat.file.jsx": js`
        export default function () {
          return <h2>Flat File</h2>;
        }
      `,

      "app/routes/dashboard/route.jsx": js`
        import { Outlet } from "@remix-run/react";

        export default function () {
          return (
            <>
              <h2>Dashboard Layout</h2>
              <Outlet />
            </>
          )
        }
      `,

      "app/routes/dashboard._index/route.jsx": js`
        export default function () {
          return <h3>Dashboard Index</h3>;
        }
      `,
    },
  });

  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  runTests();
});

test.describe("with JavaScript", () => {
  test.use({ javaScriptEnabled: true });
  runTests();
});

function runTests() {
  test("renders matching routes (index)", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    expect(await app.getHtml("#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Index</h2>
</div>`);
  });

  test("renders matching routes (folder route.jsx)", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/folder");
    expect(await app.getHtml("#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Folder (Route.jsx)</h2>
</div>`);
  });

  test("renders matching routes (folder index.jsx)", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/folder2");
    expect(await app.getHtml("#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Folder (Index.jsx)</h2>
</div>`);
  });

  test("renders matching routes (flat file)", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/flat/file");
    expect(await app.getHtml("#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Flat File</h2>
</div>`);
  });

  test("renders matching routes (nested)", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/dashboard");
    expect(await app.getHtml("#content")).toBe(`<div id="content">
  <h1>Root</h1>
  <h2>Dashboard Layout</h2>
  <h3>Dashboard Index</h3>
</div>`);
  });
}
