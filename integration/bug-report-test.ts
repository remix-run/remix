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
        import { redirect } from "@remix-run/node";
        import { Form } from "@remix-run/react";

        export function action({request}) {
          if (request.method === 'DELETE') {
            return redirect('/success');
          }
          throw new Response('Not delete');
        }

        export default function Index() {
          return (
            <Form method="delete">
              <button>Delete</button>
            </Form>
          )
        }
      `,

      "app/routes/success.jsx": js`
        export default function Index() {
          return <div>success</div>;
        }
      `,
    },
  });

  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => appFixture.close());

test("should send a DELETE request", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickElement("button");
  expect(await app.getHtml()).toMatch("success");
});
