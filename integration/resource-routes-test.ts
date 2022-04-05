import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { AppFixture } from "./helpers/create-fixture";

test.describe("loader in an app", () => {
  let app: AppFixture;

  test.beforeAll(async () => {
    app = await createAppFixture(
      await createFixture({
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
        },
      })
    );
  });

  test.afterAll(async () => {
    await app.close();
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
      await app.goto(page, "/");
      await page.click("a[href='/redirect']");
      await page.waitForSelector("[data-testid='redirected']");
    });

    test("should handle post to destination", async ({ page }) => {
      await app.goto(page, "/");
      await page.click("button[type='submit']");
      await page.waitForSelector("[data-testid='redirect-destination']");
    });

    test("should handle reloadDocument to resource route", async ({ page }) => {
      await app.goto(page, "/data.json");
      expect(await page.content()).toContain('{"hello":"world"}');
    });
  }
});
