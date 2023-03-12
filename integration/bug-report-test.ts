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
    future: { v2_routeConvention: true },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/_index.jsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return json("pizza");
        }

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

      "app/routes/burgers.jsx": js`
        export default function Index() {
          return <div>cheeseburger</div>;
        }
      `,

      "app/entry.server.tsx": js`
        import { renderToString } from "react-dom/server";
        import type {
          EntryContext,
          HandleDataRequestFunction,
        } from "@remix-run/node"; // or cloudflare/deno
        import { RemixServer } from "@remix-run/react";
        export default function handleRequest(
          request: Request,
          responseStatusCode: number,
          responseHeaders: Headers,
          remixContext: EntryContext
        ) {
          const markup = renderToString(
            <RemixServer context={remixContext} url={request.url} />
          );
          responseHeaders.set("Content-Type", "text/html");
          return new Response("<!DOCTYPE html>" + markup, {
            status: responseStatusCode,
            headers: responseHeaders,
          });
        }

        export const handleDataRequest: HandleDataRequestFunction =
          (
            response: Response,
            // same args that get passed to the action or loader that was called
            { request, params, context }
          ) => {
            response.headers.set("x-custom", "yay!");
            return response;
          };   
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

test("[remix will throw TypeError for non existing route with any _data]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  await app.goto("/does-not-exist?_data=does-not-exist");
  expect(await app.getHtml()).toContain("TypeError: Cannot read properties of null (reading 'find')");
});

test("[remix will throw TypeError for non existing data route]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  await app.goto("/?_data=does-not-exist");
  expect(await app.getHtml()).toContain("TypeError: Cannot read properties of undefined (reading 'params')");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
