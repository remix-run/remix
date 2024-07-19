import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture.js";
import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";

let fixture: Fixture;
let appFixture: AppFixture;

////////////////////////////////////////////////////////////////////////////////
// 💿 👋 Hola! It's me, Dora the Remix Disc, I'm here to help you write a great
// bug report pull request.
//
// You don't need to fix the bug, this is just to report one.
//
// The pull request you are submitting is supposed to fail when created, to let
// the team see the erroneous behavior, and understand what's going wrong.
//
// If you happen to have a fix as well, it will have to be applied in a subsequent
// commit to this pull request, and your now-succeeding test will have to be moved
// to the appropriate file.
//
// First, make sure to install dependencies and build Remix. From the root of
// the project, run this:
//
//    ```
//    pnpm install && pnpm build
//    ```
//
// Now try running this test:
//
//    ```
//    pnpm bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    pnpm bug-report-test --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

test.beforeEach(async ({ context }) => {
  await context.route(/_data/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    route.continue();
  });
});

test.beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/html-form.tsx": js`
        import { json, useActionData } from "@remix-run/react";

        export async function action({ request }) {
          return json("pizza");
        }

        export default function Route() {
          const data = useActionData();

          return (
            <form method="post">
              <div>
                <label>
                  <input type="checkbox" name="checkbox" defaultChecked /> Checkbox
                </label>
              </div>
              <div>
                <button type="submit">Submit</button>
              </div>
              {data != null && <pre>{data}</pre>}
            </form>
          );
        }
      `,
      "app/routes/html-multipart-form.tsx": js`
        import { json, useActionData } from "@remix-run/react";

        export async function action({ request }) {
          return json("pizza");
        }

        export default function Route() {
          const data = useActionData();

          return (
            <form method="post" encType="multipart/form-data">
              <div>
                <label>
                  <input type="checkbox" name="checkbox" defaultChecked /> Checkbox
                </label>
              </div>
              <div>
                <button type="submit">Submit</button>
              </div>
              {data != null && <pre>{data}</pre>}
            </form>
          );
        }
      `,
      "app/routes/remix-form.tsx": js`
        import { Form, json, useActionData } from "@remix-run/react";

        export async function action({ request }) {
          return json("pizza");
        }

        export default function Route() {
          const data = useActionData();

          return (
            <Form method="post">
              <div>
                <label>
                  <input type="checkbox" name="checkbox" defaultChecked /> Checkbox
                </label>
              </div>
              <div>
                <button type="submit">Submit</button>
              </div>
              {data != null && <pre>{data}</pre>}
            </Form>
          );
        }
      `,
      "app/routes/remix-multipart-form.tsx": js`
        import { Form, json, useActionData } from "@remix-run/react";

        export async function action({ request }) {
          return json("pizza");
        }

        export default function Route() {
          const data = useActionData();

          return (
            <Form method="post" encType="multipart/form-data">
              <div>
                <label>
                  <input type="checkbox" name="checkbox" defaultChecked /> Checkbox
                </label>
              </div>
              <div>
                <button type="submit">Submit</button>
              </div>
              {data != null && <pre>{data}</pre>}
            </Form>
          );
        }
      `,
    },
  });

  // This creates an interactive app using playwright.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test.describe("HTML <form> action", () => {
  test("form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/html-form");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });

  test("empty form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/html-form");
    await app.clickElement("[type=checkbox]");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });
  
  test("multipart form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/html-multipart-form");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });

  test("empty multipart form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/html-multipart-form");
    await app.clickElement("[type=checkbox]");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });
});

test.describe("Remix <Form> action", () => {
  test("form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/remix-form");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });

  test("empty form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/remix-form");
    await app.clickElement("[type=checkbox]");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });
  
  test("multipart form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/remix-multipart-form");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });

  test("empty multipart form body does not crash app", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/remix-multipart-form");
    await app.clickElement("[type=checkbox]");
    await app.clickElement("[type=submit]");
    await page.waitForSelector("pre");
    expect(await app.getHtml("pre")).toBe(`<pre>pizza</pre>`);
  });
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
