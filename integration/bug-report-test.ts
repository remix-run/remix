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
    config: {
      future: { v2_routeConvention: true, v2_errorBoundary: true },
    },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/customError.js": js`
      export class CustomError extends Error {
        // Implementation here doesn't matter for the test, however if looking
        // for a use case, imagine a class that only shows the error message
        // if in dev mode, or a class that links a tag to an error message
        // which allows for a glossary of errors.
        constructor(message) {
          super(message);
        }
      }`,

      "app/routes/_index.jsx": js`
        import { useRouteError } from "@remix-run/react";
        import { CustomError } from "../customError.js"

        export function loader() {
          throw new CustomError("this should be a custom error");
        }

        export default function Index() {
          return null
        }

        export function ErrorBoundary() {
          let error = useRouteError();
          return (
            <>
              <h1>Index Error</h1>
              <p>{"IS_SERVER:" + (typeof document === "undefined" ? "true" : "false")}</p>
              <p>{"IS_INSTANCE_OF_ERROR:" + (error instanceof Error ? "true" : "false")}</p>
              <p>{"IS_INSTANCE_OF_CUSTOM_ERROR:" + (error instanceof CustomError ? "true" : "false")}</p>
            </>
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

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("keeps custom error instances", async ({ page }) => {
  // NOTE: test methodology highly inspired by error-sanitization-test.ts
  let app = new PlaywrightFixture(appFixture, page);
  let response = await fixture.requestDocument("/");
  let html = await response.text();
  expect(html).toMatch("<p>IS_SERVER:true");
  expect(html).toMatch("<p>IS_INSTANCE_OF_ERROR:true");
  expect(html).toMatch("<p>IS_INSTANCE_OF_CUSTOM_ERROR:true");

  // hydrate
  await app.goto("/");
  html = await app.getHtml();
  expect(html).toMatch("<p>IS_SERVER:false");
  expect(html).toMatch("<p>IS_INSTANCE_OF_ERROR:true");
  expect(html).toMatch("<p>IS_INSTANCE_OF_CUSTOM_ERROR:true");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
