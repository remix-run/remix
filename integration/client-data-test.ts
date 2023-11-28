import { test, expect } from "@playwright/test";

import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import type { AppFixture } from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

function getFiles({
  childAdditions,
  parentAdditions,
}: {
  childAdditions: string;
  parentAdditions: string;
}) {
  return {
    "app/root.tsx": js`
      import { Outlet, Scripts } from '@remix-run/react'

      export default function Root() {
        return (
          <html>
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
      ${parentAdditions}
      export default function Component() {
        let data = useLoaderData();
        return (
          <>
            <h1 id="parent-heading">Parent Component</h1>
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
      ${childAdditions}
      export default function Component() {
        let data = useLoaderData();
        return (
          <>
            <h2 id="child-heading">Child Component</h2>
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
          files: getFiles({ parentAdditions: "", childAdditions: "" }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Full SSR - normal Remix behavior due to lack of clientLoader
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/child.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Parent Client Loader" };
              }
            `,
            childAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Child Client Loader" };
              }
            `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Full SSR - normal Remix behavior due to lack of HydrationFallback components
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/parent.HydrationFallback/child.clientLoader", async ({
      page,
    }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Parent Client Loader" };
              }
              export function HydrationFallback() {
                return <p>Parent HydrationFallback</p>
              }
            `,
            childAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Child Client Loader" };
              }
            `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls parent clientLoader
      // Does not call child clientLoader due to lack of HydrationFallback
      // TODO: confirm behavior here
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent HydrationFallback");
      expect(html).not.toMatch("Parent Component");
      expect(html).not.toMatch("Parent Server Loader");
      expect(html).not.toMatch("Child HydrationFallback");
      expect(html).not.toMatch("Child Component");
      expect(html).not.toMatch("Child Server Loader");

      await page.waitForSelector("#parent-heading");
      html = await app.getHtml("main");
      expect(html).not.toMatch("Parent HydrationFallback");
      expect(html).not.toMatch("Child HydrationFallback");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Client Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/child.clientLoader/child.HydrationFallback", async ({
      page,
    }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Parent Client Loader" };
              }
            `,
            childAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Child Client Loader" };
              }
              export function HydrationFallback() {
                return <p>Child HydrationFallback</p>
              }
            `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders child fallback on initial render and calls child clientLoader
      // Does not call parent clientLoader due to lack of HydrationFallback
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child HydrationFallback");
      expect(html).not.toMatch("Child Component");
      expect(html).not.toMatch("Child Server Loader");

      await page.waitForSelector("#child-heading");
      html = await app.getHtml("main");
      expect(html).not.toMatch("Child HydrationFallback");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Client Loader");
    });

    test("parent.clientLoader/parent.HydrationFallback/child.clientLoader/child.HydrationFallback", async ({
      page,
    }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Parent Client Loader" };
              }
              export function HydrationFallback() {
                return <p>Parent HydrationFallback</p>
              }
            `,
            childAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Child Client Loader" };
              }
              export function HydrationFallback() {
                return <p>Child HydrationFallback</p>
              }
          `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls both clientLoader's
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent HydrationFallback");
      expect(html).not.toMatch("Parent Component");
      expect(html).not.toMatch("Parent Server Loader");
      expect(html).not.toMatch("Child HydrationFallback");
      expect(html).not.toMatch("Child Component");
      expect(html).not.toMatch("Child Server Loader");

      await page.waitForSelector("#parent-heading");
      html = await app.getHtml("main");
      expect(html).not.toMatch("Parent HydrationFallback");
      expect(html).not.toMatch("Child HydrationFallback");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Client Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Client Loader");
    });

    test("handles synchronous client loaders", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export function clientLoader() {
                return { message: "Parent Client Loader" };
              }
              export function HydrationFallback() {
                return <p>Parent HydrationFallback</p>
              }
            `,
            childAdditions: js`
              export function clientLoader() {
                return { message: "Child Client Loader" };
              }
              export function HydrationFallback() {
                return <p>Child HydrationFallback</p>
              }
          `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls both clientLoader's
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent HydrationFallback");

      await page.waitForSelector("#parent-heading");
      html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Client Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Client Loader");
    });

    test("provides server loader data to client loaders (JSON)", async ({
      page,
    }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader({ serverLoader }) {
                await new Promise(r => setTimeout(r, 100));
                let serverData = await serverLoader();
                return { message: serverData.message + " - mutated by parent client" };
              }
              export function HydrationFallback() {
                return <p>Parent HydrationFallback</p>
              }
            `,
            childAdditions: js`
              export async function clientLoader({ serverLoader }) {
                await new Promise(r => setTimeout(r, 100));
                let serverData = await serverLoader();
                return { message: serverData.message + " - mutated by child client" };
              }
              export function HydrationFallback() {
                return null;
              }
            `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);

      // Renders parent fallback on initial render and calls both clientLoader's
      await app.goto("/parent/child");
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent HydrationFallback");

      await page.waitForSelector("#child-heading");
      html = await app.getHtml("main");
      expect(html).toMatch("Parent Server Loader - mutated by parent client");
      expect(html).toMatch("Child Server Loader - mutated by child client");
    });
  });

  test.describe("SPA Navigations", () => {
    test("no client loaders or fallbacks", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({ parentAdditions: "", childAdditions: "" }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child");
      await page.waitForSelector("#child-heading");

      // Normal Remix behavior due to lack of clientLoader
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Server Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Parent Client Loader" };
              }
            `,
            childAdditions: "",
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child");
      await page.waitForSelector("#child-heading");

      // Parent client loader should run
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Client Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Server Loader");
    });

    test("parent.clientLoader/child.clientLoader", async ({ page }) => {
      appFixture = await createAppFixture(
        await createFixture({
          files: getFiles({
            parentAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Parent Client Loader" };
              }
            `,
            childAdditions: js`
              export async function clientLoader() {
                await new Promise(r => setTimeout(r, 100));
                return { message: "Child Client Loader" };
              }
            `,
          }),
        })
      );
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink("/parent/child");
      await page.waitForSelector("#child-heading");

      // Both clientLoaders should run
      let html = await app.getHtml("main");
      expect(html).toMatch("Parent Component");
      expect(html).toMatch("Parent Client Loader");
      expect(html).toMatch("Child Component");
      expect(html).toMatch("Child Client Loader");
    });
  });
});
