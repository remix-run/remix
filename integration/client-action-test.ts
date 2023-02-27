import { test } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/passthrough.jsx": js`
        import { Form, useActionData } from "@remix-run/react";

        export function action() {
          return {
            message: "Hello from server",
          };
        }

        export async function clientAction({ serverFetch }) {
          const response = await serverFetch();
          const data = await response.json();
          return {
            ...data,
            client: "yes",
          };
        }

        export default function Passthrough() {
          const data = useActionData() || {};
          return (
            <div>
              <Form method="post">
                <button type="submit">Submit</button>
              </Form>
              <p>{data.message}</p>
              <p>{data.client || "no"}</p>
            </div>
          );
        }      
      `,
      "app/routes/client-only.jsx": js`
        import { Form, useActionData } from "@remix-run/react";

        export async function clientAction() {
          return {
            message: "Hello from client",
            client: "yes",
          };
        }

        export default function ClientOnly() {
          const data = useActionData() || {};
          return (
            <div>
              <Form method="post">
                <button type="submit">Submit</button>
              </Form>
              <p>{data.message}</p>
              <p>{data.client || "no"}</p>
            </div>
          );
        }      
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

test("calls client action passthrough on submission", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/passthrough", true);
  await app.clickSubmitButton("/passthrough");

  await page.waitForSelector("p:has-text('Hello from server')");
  await page.waitForSelector("p:has-text('yes')");
});

test("calls only client action on submission", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/client-only", true);
  await app.clickSubmitButton("/client-only");

  await page.waitForSelector("p:has-text('Hello from client')");
  await page.waitForSelector("p:has-text('yes')");
});
