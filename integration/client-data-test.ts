import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import type { AppFixture } from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

function getFiles({
  parentClientLoader,
  parentClientLoaderHydrate,
  parentAdditions,
  childClientLoader,
  childClientLoaderHydrate,
  childAdditions,
}: {
  parentClientLoader: boolean;
  parentClientLoaderHydrate: boolean;
  parentAdditions?: string;
  childClientLoader: boolean;
  childClientLoaderHydrate: boolean;
  childAdditions?: string;
}) {
  return {
    "app/root.tsx": js`
      import { Outlet, Scripts } from '@remix-run/react'

      export default function Root() {
        return (
          <html>
            <head></head>
            <body>
              <main>
                <Outlet />
              </main>
              <Scripts />
            </body>
          </html>
        );
      }
    `,
    "app/routes/_index.tsx": js`
      import { Link } from '@remix-run/react'
      export default function Component() {
        return <Link to="/parent/child">Go to /parent/child</Link>
      }
    `,
    "app/routes/parent.tsx": js`
      import { json } from '@remix-run/node'
      import { Outlet, useLoaderData } from '@remix-run/react'
      export function loader() {
        return json({ message: 'Parent Server Loader'});
      }
      ${
        parentClientLoader
          ? js`
              export async function clientLoader({ serverLoader }) {
                // Need a small delay to ensure we capture the server-rendered
                // fallbacks for assertions
                await new Promise(r => setTimeout(r, 100))
                let data = await serverLoader();
                return { message: data.message + " (mutated by client)" };
              }
            `
          : ""
      }
      ${
        parentClientLoaderHydrate
          ? js`
              clientLoader.hydrate = true;
              export function HydrateFallback() {
                return <p>Parent Fallback</p>
              }
            `
          : ""
      }
      ${parentAdditions || ""}
      export default function Component() {
        let data = useLoaderData();
        return (
          <>
            <p id="parent-data">{data.message}</p>
            <Outlet/>
          </>
        );
      }
    `,
    "app/routes/parent.child.tsx": js`
      import { json } from '@remix-run/node'
      import { Outlet, useLoaderData } from '@remix-run/react'
      export function loader() {
        return json({ message: 'Child Server Loader'});
      }
      ${
        childClientLoader
          ? js`
              export async function clientLoader({ serverLoader }) {
                // Need a small delay to ensure we capture the server-rendered
                // fallbacks for assertions
                await new Promise(r => setTimeout(r, 100))
                let data = await serverLoader();
                return { message: data.message + " (mutated by client)" };
              }
            `
          : ""
      }
      ${
        childClientLoaderHydrate
          ? js`
              clientLoader.hydrate = true;
              export function HydrateFallback() {
                return <p>Child Fallback</p>
              }
            `
          : ""
      }
      ${childAdditions || ""}
      export default function Component() {
        let data = useLoaderData();
        return (
          <>
            <p id="child-data">{data.message}</p>
            <Outlet/>
          </>
        );
      }
    `,
  };
}

test.describe("Client Data", () => {
  let appFixture: AppFixture;

  test.afterAll(() => {
    appFixture.close();
  });

  test.describe("Initial Hydration", () => {
    test("no client loaders or fallbacks", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: false,
            parentClientLoaderHydrate: false,
            childClientLoader: false,
            childClientLoaderHydrate: false,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Full SSR - normal Remix behavior due to lack of clientLoader
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/child.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: true,
            parentClientLoaderHydrate: false,
            childClientLoader: true,
            childClientLoaderHydrate: false,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Full SSR - normal Remix behavior due to lack of HydrateFallback components
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader.hydrate/child.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: true,
            parentClientLoaderHydrate: true,
            childClientLoader: true,
            childClientLoaderHydrate: false,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls parent clientLoader
      // Does not call child clientLoader
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Fallback");
      expect(html).not.toMatch("Parent Server Loader");
      expect(html).not.toMatch("Child Server Loader");

      await page.waitForSelector("#child-data");
      html = await app.getHtml("main");
      expect(html).not.toMatch("Parent Fallback");
      expect(html).toMatch("Parent Server Loader (mutated by client)");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/child.clientLoader.hydrate", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: true,
            parentClientLoaderHydrate: false,
            childClientLoader: true,
            childClientLoaderHydrate: true,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders child fallback on initial render and calls child clientLoader
      // Does not call parent clientLoader due to lack of HydrateFallback
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Fallback");
      expect(html).not.toMatch("Child Server Loader");

      await page.waitForSelector("#child-data");
      html = await app.getHtml("main");
      expect(html).not.toMatch("Child Fallback");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Server Loader (mutated by client)");
    });

    test("parent.clientLoader.hydrate/child.clientLoader.hydrate", async ({
      page,
    }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: true,
            parentClientLoaderHydrate: true,
            childClientLoader: true,
            childClientLoaderHydrate: true,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls both clientLoader's
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Fallback");
      expect(html).not.toMatch("Parent Server Loader");
      expect(html).not.toMatch("Child Fallback");
      expect(html).not.toMatch("Child Server Loader");

      await page.waitForSelector("#child-data");
      html = await app.getHtml("main");
      expect(html).not.toMatch("Parent Fallback");
      expect(html).not.toMatch("Child Fallback");
      expect(html).toMatch("Parent Server Loader (mutated by client)");
      expect(html).toMatch("Child Server Loader (mutated by client)");
    });

    test("handles synchronous client loaders", async ({ page }) => {
      let fixture = await createFixture({
        files: getFiles({
          parentClientLoader: false,
          parentClientLoaderHydrate: false,
          childClientLoader: false,
          childClientLoaderHydrate: false,
          parentAdditions: js`
            export function clientLoader() {
              return { message: "Parent Client Loader" };
            }
            clientLoader.hydrate=true
            export function HydrateFallback() {
              return <p>Parent Fallback</p>
            }
          `,
          childAdditions: js`
            export function clientLoader() {
              return { message: "Child Client Loader" };
            }
            clientLoader.hydrate=true
        `,
        }),
      });

      // Ensure we SSR the fallbacks
      let doc = await fixture.requestDocument("/parent/child");
      let html = await doc.text();
      expect(html).toMatch("Parent Fallback");

      appFixture = await createAppFixture(fixture);
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls both clientLoader's
      await app.goto("/parent/child");
      await page.waitForSelector("#child-data");
      html = await app.getHtml("main");
      expect(html).toMatch("Parent Client Loader");
      expect(html).toMatch("Child Client Loader");
    });

    test("handles deferred data through client loaders", async ({ page }) => {
      let fixture = await createFixture({
        files: {
          ...getFiles({
            parentClientLoader: false,
            parentClientLoaderHydrate: false,
            childClientLoader: false,
            childClientLoaderHydrate: false,
          }),
          // Blow away parent.child.tsx with our own deferred version
          "app/routes/parent.child.tsx": js`
            import * as React from 'react';
            import { defer, json } from '@remix-run/node'
            import { Await, Outlet, useLoaderData } from '@remix-run/react'
            export function loader() {
              return defer({
                message: 'Child Server Loader',
                lazy: new Promise(r => setTimeout(() => r("Child Deferred Data"), 1000)),
              });
            }
            export async function clientLoader({ serverLoader }) {
              let data = await serverLoader();
              return {
                ...data,
                message: data.message + " (mutated by client)",
              };
            }
            clientLoader.hydrate = true;
            export function HydrateFallback() {
              return <p>Child Fallback</p>
            }
            export default function Component() {
              let data = useLoaderData();
              console.log('rendering component', data.lazy, data.lazy._tracked, data.lazy._value)
              return (
                <>
                  <p id="child-data">{data.message}</p>
                  <React.Suspense fallback={<p>Loading Deferred Data...</p>}>
                    <Await resolve={data.lazy}>
                      {(value) => <p id="child-deferred-data">{value}</p>}
                    </Await>
                  </React.Suspense>
                </>
              );
            }
          `,
        },
      });

      // Ensure initial document request contains the child fallback _and_ the
      // subsequent streamed/resolved deferred data
      let doc = await fixture.requestDocument("/parent/child");
      let html = await doc.text();
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Fallback");
      expect(html).toMatch("Child Deferred Data");

      appFixture = await createAppFixture(fixture);
      let app = new PlaywrightFixture(appFixture, page);

      await app.goto("/parent/child");
      html = await app.getHtml("main");
      await page.waitForSelector("#child-deferred-data");
      expect(html).toMatch("Parent Server Loader");
      // app.goto() doesn't resolve until the document finishes loading so by
      // then the HTML has updated via the streamed suspense updates
      expect(html).toMatch("Child Server Loader (mutated by client)");
      expect(html).toMatch("Child Deferred Data");
    });
  });

  test.describe("SPA Navigations", () => {
    test("no client loaders or fallbacks", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: false,
            parentClientLoaderHydrate: false,
            childClientLoader: false,
            childClientLoaderHydrate: false,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child");
      await page.waitForSelector("#child-data");

      // Normal Remix behavior due to lack of clientLoader
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: true,
            parentClientLoaderHydrate: false,
            childClientLoader: false,
            childClientLoaderHydrate: false,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child");
      await page.waitForSelector("#child-data");

      // Parent client loader should run
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader (mutated by client)");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/child.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentClientLoader: true,
            parentClientLoaderHydrate: false,
            childClientLoader: true,
            childClientLoaderHydrate: false,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child");
      await page.waitForSelector("#child-data");

      // Both clientLoaders should run
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader (mutated by client)");
      expect(html).toMatch("Child Server Loader (mutated by client");
    });
  });
});
