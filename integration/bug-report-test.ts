import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

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
//    yarn && yarn build
//    ```
//
// Now try running this test:
//
//    ```
//    yarn bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    yarn bug-report-test --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

test.beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/defer.jsx": js`
        import { defer } from "@remix-run/node";

        export function loader() {
          return defer({}, { headers: { "x-custom-header": "value from loader" } });
        }

        export function headers({ loaderHeaders }) {
            return {
                "x-custom-header": loaderHeaders.get("x-custom-header")
            }
        }

        export default function WithDefer() {
          return (
            <div>Header not available with defer?</div>
          )
        }
      `,
      "app/routes/json.jsx": js`
        import { json } from "@remix-run/node";

        export function loader() {
          return json({}, { headers: { "x-custom-header": "value from loader" } });
        }

        export function headers({ loaderHeaders }) {
            return {
                "x-custom-header": loaderHeaders.get("x-custom-header")
            }
        }

        export default function WithJson() {
          return (
            <div>Header available with json</div>
          )
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

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("headers set from `loader` are available in `headers` when using `defer`", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  let response = await fixture.requestDocument("/defer");
  expect(response.headers.get("x-custom-header")).toEqual("value from loader");
});

test("headers set from `loader` are available in `headers` when using `json`", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  let response = await fixture.requestDocument("/json");
  expect(response.headers.get("x-custom-header")).toEqual("value from loader");
});
