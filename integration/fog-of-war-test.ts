import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

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
        return <h1 id="index">Index</h1>
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
                <RemixBrowser discover={"none"} />
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

    // Linking to A loads A and succeeds
    await app.goto("/", true);
    await app.clickLink("/a");
    await page.waitForSelector("#a");
    expect(await app.getHtml("#a")).toBe(`<h1 id="a">A: A LOADER</h1>`);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toContain("routes/a");
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

  test("prefetches links who opt-into [data-discover] via an in-page stateful update", async ({
    page,
  }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: {
        "app/root.tsx": js`
          import { Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head> </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,
        "app/routes/_index.tsx": js`
          import * as React from 'react';
          import { Link, Outlet, useLoaderData } from "@remix-run/react";

          export default function Index() {
            let [discover, setDiscover] = React.useState(false)
            return (
              <>
                <Link to="/a" discover={discover ? "render" : "none"}>/a</Link>
                <button onClick={() => setDiscover(true)}>Toggle</button>
              </>
            )
          }
        `,
        "app/routes/a.tsx": js`
          export default function Index() {
            return <h1 id="a">A</h1>
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
    ).toEqual(["root", "routes/_index"]);

    await app.clickElement("button");
    await page.waitForFunction(
      () => (window as any).__remixManifest.routes["routes/a"]
    );

    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/a"]);
  });

  test('does not prefetch links with discover="none"', async ({ page }) => {
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
                <Link to="/a/b" discover="none">/a/b</Link>
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

  test("prefetches root index child when SSR-ing a deep route", async ({
    page,
  }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: {
        "app/root.tsx": js`
          import { Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head></head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/_index.tsx": js`
          export default function Index() {
            return <h1 id="index">Index</h1>
          }
        `,
        "app/routes/deep.tsx": js`
          import { Link } from "@remix-run/react";

          export default function Component() {
            return (
              <>
                <h1>Deep</h1>
                <Link to="/" discover="none">Home</Link>
              </>
            )
          }
        `,
      },
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);

    let manifestRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/__manifest")) {
        manifestRequests.push(req.url());
      }
    });

    await app.goto("/deep", true);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual(["root", "routes/_index", "routes/deep"]);

    // Without pre-loading the index, we'd "match" `/` to just the root route
    // client side and never fetch the `routes/_index` route
    await app.clickLink("/");
    await page.waitForSelector("#index");
    expect(await app.getHtml("#index")).toMatch(`Index`);

    expect(manifestRequests.length).toBe(0);
  });

  test("prefetches ancestor index children when SSR-ing a deep route", async ({
    page,
  }) => {
    let fixture = await createFixture({
      config: {
        future: {
          unstable_fogOfWar: true,
        },
      },
      files: {
        "app/root.tsx": js`
          import { Link, Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head></head>
                <body >
                  <nav>
                    <Link to="/parent" discover="none">Parent Index</Link>
                    <Link to="/parent/child" discover="none">Child Index</Link>
                  </nav>
                  <Outlet />
                  <Scripts />
                  </body>
              </html>
            );
          }
        `,

        "app/routes/_index.tsx": js`
          export default function Index() {
            return <h1 id="index">Index</h1>
          }
        `,
        "app/routes/parent.tsx": js`
          import { Outlet } from "@remix-run/react";
          export default function Component() {
            return (
              <>
                <h1 id="parent">Parent</h1>
                <Outlet />
              </>
            )
          }
        `,
        "app/routes/parent._index.tsx": js`
          export default function Component() {
            return <h2 id="parent-index">Parent Index</h2>;
          }
        `,
        "app/routes/parent.child.tsx": js`
          import { Outlet } from "@remix-run/react";
          export default function Component() {
            return (
              <>
                <h2 id="child">Child</h2>
                <Outlet />
              </>
            )
          }
        `,
        "app/routes/parent.child._index.tsx": js`
          export default function Component() {
            return <h3 id="child-index">Child Index</h3>;
          }
        `,
        "app/routes/parent.child.grandchild.tsx": js`
          export default function Component() {
            return <h3 id="grandchild">Grandchild</h3>;
          }
        `,
      },
    });
    let appFixture = await createAppFixture(fixture);
    let app = new PlaywrightFixture(appFixture, page);

    let manifestRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/__manifest")) {
        manifestRequests.push(req.url());
      }
    });

    await app.goto("/parent/child/grandchild", true);
    expect(
      await page.evaluate(() =>
        Object.keys((window as any).__remixManifest.routes)
      )
    ).toEqual([
      "root",
      "routes/_index",
      "routes/parent",
      "routes/parent._index",
      "routes/parent.child",
      "routes/parent.child._index",
      "routes/parent.child.grandchild",
    ]);

    // Without pre-loading the index, we'd "match" `/parent/child` to just the
    // parent and child routes client side and never fetch the
    // `routes/parent.child._index` route
    await app.clickLink("/parent/child");
    await page.waitForSelector("#child-index");
    expect(await app.getHtml("#parent")).toMatch("Parent");
    expect(await app.getHtml("#child")).toMatch("Child");
    expect(await app.getHtml("#child-index")).toMatch(`Child Index`);

    await app.clickLink("/parent");
    await page.waitForSelector("#parent-index");
    expect(await app.getHtml("#parent")).toMatch(`Parent`);
    expect(await app.getHtml("#parent-index")).toMatch(`Parent Index`);

    expect(manifestRequests.length).toBe(0);
  });
});
