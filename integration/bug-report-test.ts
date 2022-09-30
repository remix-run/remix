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
      // XXX Remove .server from file for missing polyfill method error
      "app/api/client.server.js": js`
        import { AccountInfo } from '@azure/msal-node';
        
        export function getAccount() {
          return { name: 'Dora' }
        }
      `,
      "app/routes/index.jsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";
        import { getAccount } from "~/api/client.server";
        import { STATUS_CODES } from "http";

        export function loader() {
          return json(
            { name: getAccount().name }, 
            { status: 200, statusText: STATUS_CODES[200] }
          );
        }

        export default function Index() {
          let { name } = useLoaderData();
          
          return (
            <div>
              <span>{name}</span>
            </div>
          )
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => appFixture.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("[description of what you expect it to do]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("Dora");

  // XXX You can see here a lot of the http polyfill code has been included in the browser bundle
  let routeModule = await fixture.getBrowserAsset(
    fixture.build.assets.routes["routes/index"].module
  );
  expect(routeModule).not.toMatch('The buffer module from node.js');
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
