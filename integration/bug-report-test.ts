import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { Form } from '@remix-run/react';

        export default function Index() {
          return (
            <div>
              <form method="post" action="/action">
                <button type="submit" id="native">Native Form</button>
              </form>
        
              <Form method="post" action="/action">
                <button type="submit" id="remix">Remix Form</button>
              </Form>
            </div>
          );
        }
      `,

      "app/routes/action.jsx": js`
        import { redirect } from '@remix-run/node';

        export function action() {
          throw redirect('/success');
        }
      `,

      "app/routes/success.jsx": js`
        export default function Success() {
          return <p>Success</p>;
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => appFixture.close());

test("redirect on native form post", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickElement("#native");
  expect(await app.getHtml("p")).toMatch("Success");
});

test("redirect on Remix Form post", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickElement("#remix");
  expect(await app.getHtml("p")).toMatch("Success");
});
