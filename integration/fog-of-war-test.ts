import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

// TODO: Add a test for dynamically changing the value of data-discover and
//       ensure the mutation observer picks it up.

function getFiles() {
  return {
    "app/root.tsx": js`
      import * as React from "react";
      import { Link, Links, Meta, Outlet, Scripts } from "@remix-run/react";

      export default function Root() {
        let [showLink, setShowLink] = React.useState(false);
        return (
          <html lang="en">
            <head>
              <Meta />
              <Links />
            </head>
            <body>
              <Link to="/">Home</Link><br/>
              <Link to="/a">/a</Link><br/>
              <button onClick={() => setShowLink(true)}>Show Link</button>
              {showLink ? <Link to="/a/b">/a/b</Link> : null}
              <Outlet />
              <Scripts />
            </body>
          </html>
        );
      }
    `,

    "app/routes/_index.tsx": js`
      export default function Index() {
        return <h1>Index</h1>
      }
    `,

    "app/routes/a.tsx": js`
      import { Link, Outlet, useLoaderData } from "@remix-run/react";

      export function loader({ request }) {
        return { message: "A LOADER" };
      }

      export default function Index() {
        let data = useLoaderData();
        return (
          <>
            <h1 id="a">A: {data.message}</h1>
            <Link to="/a/b">/a/b</Link>
            <Outlet/>
          </>
        )
      }
    `,
    "app/routes/a.b.tsx": js`
      import { Outlet, useLoaderData } from "@remix-run/react";

      export function loader({ request }) {
        return { message: "B LOADER" };
      }

      export default function Index() {
        let data = useLoaderData();
        return (
          <>
            <h2 id="b">B: {data.message}</h2>
            <Outlet/>
          </>
        )
      }
    `,
    "app/routes/a.b.c.tsx": js`
      import { Outlet, useLoaderData } from "@remix-run/react";

      export function loader({ request }) {
        return { message: "C LOADER" };
      }

      export default function Index() {
        let data = useLoaderData();
        return <h3 id="c">C: {data.message}</h3>
      }
    `,
  };
}

test.describe("Fog of War", () => {
  let oldConsoleError: typeof console.error;

  test.beforeEach(() => {
    oldConsoleError = console.error;
  });

  test.afterEach(() => {
    console.error = oldConsoleError;
  });

  test("loads minimal manifest on initial load", async ({ page }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: {
        ...getFiles(),
        "app/entry.client.tsx": js`
          import { RemixBrowser } from "@remix-run/react";
          import { startTransition, StrictMode } from "react";
          import { hydrateRoot } from "react-dom/client";

          startTransition(() => {
            hydrateRoot(
              document,
              <StrictMode>
                <RemixBrowser discover={"click"} />
              </StrictMode>
            );
          });
        `,
      },
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);
    let res = await fixture.requestDocument("/");
    let html = await res.text();

    expect(html).toContain('"root": {');
    expect(html).toContain('"routes/_index": {');
    expect(html).not.toContain('"routes/a"');

    await app.goto("/", true);
    await app.clickLink("/a");
    await page.waitForSelector("#a");
    expect(await app.getHtml("#a")).toBe(`<h1 id="a">A: A LOADER</h1>`);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);
  });

  test("prefetches initially rendered links", async ({ page }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: getFiles(),
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);

    await app.goto("/", true);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);

    await app.clickLink("/a");
    await page.waitForSelector("#a");
    expect(await app.getHtml("#a")).toBe(`<h1 id="a">A: A LOADER</h1>`);
  });

  test("prefetches links rendered via navigations", async ({ page }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: getFiles(),
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);

    await app.goto("/", true);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);

    await app.clickLink("/a");
    await page.waitForSelector("#a");

    await page.waitForFunction(
      () => (window as any).__remixManifest.routes["routes/a.b"]
    );

    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a", "routes/a.b"]);
  });

  test("prefetches links rendered via in-page stateful updates", async ({
    page,
  }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: getFiles(),
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);

    await app.goto("/", true);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);

    await app.clickElement("button");
    await page.waitForFunction(
      () => (window as any).__remixManifest.routes["routes/a.b"]
    );

    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a", "routes/a.b"]);
  });

  test('does not prefetch links with discover="click"', async ({ page }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: {
        ...getFiles(),
        "app/routes/a.tsx": js`
          import { Link, Outlet, useLoaderData } from "@remix-run/react";

          export function loader({ request }) {
            return { message: "A LOADER" };
          }

          export default function Index() {
            let data = useLoaderData();
            return (
              <>
                <h1 id="a">A: {data.message}</h1>
                <Link to="/a/b" discover="click">/a/b</Link>
                <Outlet/>
              </>
            )
          }
        `,
      },
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);

    await app.goto("/", true);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);

    await app.clickLink("/a");
    await page.waitForSelector("#a");
    await new Promise((resolve) => setTimeout(resolve, 250));

    // /a/b is not discovered yet even thought it's rendered
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);

    // /a/b gets discovered on click
    await app.clickLink("/a/b");
    await page.waitForSelector("#b");

    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a", "routes/a.b"]);
  });
});
