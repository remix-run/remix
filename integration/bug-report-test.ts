import { test, expect } from "@playwright/test";

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
    future: { v2_routeConvention: true },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/_index/route.jsx": js`
        export default function Index() {
          return <span>Index</span>
        }
      `,

      "app/routes/feature/route.jsx": js`
        export default function FeatureRoute() {
          return <span>FeatureRoute</span>;
        }
      `,

      "app/routes/feature/SomeComponent.js": js`
        export default function SomeComponent() {
          return <span>SomeComponent</span>;
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

test("index folder with router path should result in 200", async () => {
  let response = await fixture.requestDocument("/");
  expect(await response.status).toBe(200);
});

test("folder with route.tsx should result in 200", async () => {
  let response = await fixture.requestDocument("/feature");
  expect(await response.status).toBe(200);
});

test("path without matching files should result in a 404", async () => {
  let response = await fixture.requestDocument("/feature/NotExisting");
  expect(await response.status).toBe(404);
});

test("random files in a route folder should result in a 404 as they are not routes", async () => {
  let response = await fixture.requestDocument("/feature/SomeComponent");
  expect(await response.status).toBe(404);
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
