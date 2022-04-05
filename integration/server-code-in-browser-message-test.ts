import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;
let app: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "node_modules/has-side-effects/package.json": `{
        "name": "has-side-effects",
        "version": "1.0.0",
        "main": "index.js"
      }`,
      "node_modules/has-side-effects/index.js": js`
        let message;
        (() => { message = process.env.___SOMETHING___ || "hello, world"; })();
        module.exports = () => message;
      `,
      "app/routes/index.jsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";
        import sideEffectModules from "has-side-effects";

        export let loader = () => json(sideEffectModules());

        export default function Index() {
          let data = useLoaderData();

          return (
            <div>
              {data}
              <Link to="/burgers">Other Route</Link>
            </div>
          )
        }
      `,
    },
  });

  app = await createAppFixture(fixture);
});

test.afterAll(() => app.close());

test("should log relevant error message", async ({ page }) => {
  await app.goto(page, "/");
  expect(await app.getHtml(page)).toMatch(
    "https://remix.run/pages/gotchas#server-code-in-client-bundles"
  );
});
