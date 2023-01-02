import { test, expect } from "@playwright/test";
import { ServerMode } from "@remix-run/server-runtime/mode";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { AppFixture, Fixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("loader in an app", async () => {
  let appFixture: AppFixture;
  let fixture: Fixture;

  let SVG_CONTENTS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#000" stroke-width="4" aria-label="Chicken"><path d="M48.1 34C22.1 32 1.4 51 2.5 67.2c1.2 16.1 19.8 17 29 17.8H89c15.7-6.6 6.3-18.9.3-20.5A28 28 0 0073 41.7c-.5-7.2 3.4-11.6 6.9-15.3 8.5 2.6 8-8 .8-7.2.6-6.5-12.3-5.9-6.7 2.7l-3.7 5c-6.9 5.4-10.9 5.1-22.2 7zM48.1 34c-38 31.9 29.8 58.4 25 7.7M70.3 26.9l5.4 4.2"/></svg>`;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/routes/index.jsx": js`
          import { Form, Link } from "@remix-run/react";

          export default () => (
            <>
              <Link to="/redirect">Redirect</Link>
              <Form action="/redirect-to" method="post">
                <input name="destination" defaultValue="/redirect-destination" />
                <button type="submit">Redirect</button>
              </Form>
            </>
          )
        `,
        "app/routes/redirected.jsx": js`
          export default () => <div data-testid="redirected">You were redirected</div>;
        `,
        "app/routes/redirect.jsx": js`
          import { redirect } from "@remix-run/node";

          export let loader = () => redirect("/redirected");
        `,
        "app/routes/redirect-to.jsx": js`
          import { redirect } from "@remix-run/node";

          export let action = async ({ request }) => {
            let formData = await request.formData();
            return redirect(formData.get('destination'));
          }
        `,
        "app/routes/redirect-destination.jsx": js`
          export default () => <div data-testid="redirect-destination">You made it!</div>
        `,
        "app/routes/data[.]json.jsx": js`
          import { json } from "@remix-run/node";
          export let loader = () => json({hello: "world"});
        `,
        "app/assets/icon.svg": SVG_CONTENTS,
        "app/routes/[manifest.webmanifest].js": js`
          import { json } from "@remix-run/node";
          import iconUrl from "~/assets/icon.svg";
          export  function loader() {
            return json(
              {
                icons: [
                  {
                    src: iconUrl,
                    sizes: '48x48 72x72 96x96 128x128 192x192 256x256 512x512',
                    type: 'image/svg+xml',
                  },
                ],
              },
            );
          }
        `,
        "app/routes/throw-error.jsx": js`
          export let loader = () => {
            throw new Error('Oh noes!')
          }
        `,
        "app/routes/return-response.jsx": js`
          export let loader = () => {
            return new Response('Partial', { status: 207 });
          }
        `,
        "app/routes/throw-response.jsx": js`
          export let loader = () => {
            throw new Response('Partial', { status: 207 });
          }
        `,
        "app/routes/return-object.jsx": js`
          export let loader = () => {
            return { hello: 'world' };
          }
        `,
        "app/routes/throw-object.jsx": js`
          export let loader = () => {
            throw { but: 'why' };
          }
        `,
      },
    });
    appFixture = await createAppFixture(fixture, ServerMode.Test);
  });

  test.afterAll(() => {
    appFixture.close();
  });

  test.describe("with JavaScript", () => {
    runTests();
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    runTests();
  });

  function runTests() {
    test("should redirect to redirected", async ({ page }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await page.click("a[href='/redirect']");
      await page.waitForSelector("[data-testid='redirected']");
    });

    test("should handle post to destination", async ({ page }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await page.click("button[type='submit']");
      await page.waitForSelector("[data-testid='redirect-destination']");
    });

    test("should handle reloadDocument to resource route", async ({ page }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/data.json");
      expect(await page.content()).toContain('{"hello":"world"}');
    });

    test("writes imported asset to `assetDirectory`", async ({ page }) => {
      new PlaywrightFixture(appFixture, page);
      let data = await fixture.getBrowserAsset(
        "build/_assets/icon-W7PJN5PS.svg"
      );
      expect(data).toBe(SVG_CONTENTS);
    });

    test("should handle errors thrown from resource routes", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      let res = await app.goto("/throw-error");
      expect(res.status()).toBe(500);
      expect(await res.text()).toEqual(
        "Unexpected Server Error\n\nError: Oh noes!"
      );
    });
  }

  test("should handle responses returned from resource routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    let res = await app.goto("/return-response");
    expect(res.status()).toBe(207);
    expect(await res.text()).toEqual("Partial");
  });

  test("should handle responses thrown from resource routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    let res = await app.goto("/throw-response");
    expect(res.status()).toBe(207);
    expect(await res.text()).toEqual("Partial");
  });

  test("should handle objects returned from resource routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    let res = await app.goto("/return-object");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
  });

  test("should handle objects thrown from resource routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    let res = await app.goto("/throw-object");
    expect(res.status()).toBe(500);
    expect(await res.text()).toEqual(
      "Unexpected Server Error\n\n[object Object]"
    );
  });
});
