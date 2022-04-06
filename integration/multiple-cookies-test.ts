import { test, expect } from "@playwright/test";
import type { Response } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { AppFixture } from "./helpers/create-fixture";

test.describe("pathless layout routes", () => {
  let app: AppFixture;

  test.beforeAll(async () => {
    app = await createAppFixture(
      await createFixture({
        files: {
          "app/routes/index.jsx": js`
            import { redirect, json } from "@remix-run/node";
            import { Form, useActionData } from "@remix-run/react";

            export let loader = async () => {
              let headers = new Headers();
              headers.append("Set-Cookie", "foo=bar");
              headers.append("Set-Cookie", "bar=baz");
              return json({}, { headers });
            };

            export let action = async () => {
              let headers = new Headers();
              headers.append("Set-Cookie", "another=one");
              headers.append("Set-Cookie", "how-about=two");
              return json({success: true}, { headers });
            };

            export default function MultipleSetCookiesPage() {
              let actionData = useActionData();
              return (
                <>
                  <p>👋</p>
                  <Form method="post">
                    <button type="submit">Add cookies</button>
                  </Form>
                  {actionData?.success && <p data-testid="action-success">Success!</p>}
                </>
              );
            };
          `,
        },
      })
    );
  });

  test.afterAll(async () => {
    await app.close();
  });

  test("should get multiple cookies from the loader", async ({ page }) => {
    let responses = app.collectResponses(page, (url) => url.pathname === "/");
    await app.goto(page, "/");
    let setCookies = await responses[0].headerValues("set-cookie");
    expect(setCookies).toEqual(["foo=bar", "bar=baz"]);
    expect(responses).toHaveLength(1);
  });

  test("should get multiple cookies from the action", async ({ page }) => {
    await app.goto(page, "/");
    // do this after the first request so that it doesnt appear in our next assertions
    let responses = app.collectResponses(page, (url) => url.pathname === "/");
    await page.click("button[type=submit]");
    await page.waitForSelector(`[data-testid="action-success"]`);
    let setCookies = await responses[0].headerValues("set-cookie");
    expect(setCookies).toEqual(["another=one", "how-about=two"]);
    // one for the POST and one for the GET
    expect(responses).toHaveLength(2);
  });
});
