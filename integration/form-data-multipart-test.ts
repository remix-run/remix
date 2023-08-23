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

test.beforeEach(async ({ context }) => {
  await context.route(/_data/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    route.continue();
  });
});

test.beforeAll(async () => {
  fixture = await createFixture({
    config: {
      future: { v2_routeConvention: true },
    },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/upload.jsx": js`
        import { json, ActionArgs, unstable_parseMultipartFormData } from '@remix-run/node';

        export async function action({ request }) {
          try {
            const rsp = await unstable_parseMultipartFormData(request, async ({ data, filename, contentType }) => {
              return filename;
            });
            return json(Object.fromEntries(rsp.entries()));
          } catch (e) {
            return json({ error: e.message });
          }
        }
      `,
    },
  });

  // This creates an interactive app using playwright.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("fail upload if boundary is set with hyphens", async ({ page }) => {
  let res = await fetch(appFixture.serverUrl + "/upload", {
    method: "POST",
    headers: {
      "Content-Type":
        'multipart/form-data; boundary="--------------------------890934293568639326555573"',
    },
    body:
      "----------------------------890934293568639326555573\r\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
      "Content-Type: text/plain\r\n" +
      "\r\n" +
      "test\r\n" +
      "----------------------------890934293568639326555573--\r\n",
  }).then((res) => res.json());

  expect(res).toEqual({ file: "test.txt" });
});

test("success upload if boundary is set without hyphens", async ({ page }) => {
  let res = await fetch(appFixture.serverUrl + "/upload", {
    method: "POST",
    headers: {
      "Content-Type":
        "multipart/form-data; boundary=--------------------------890934293568639326555573",
    },
    body:
      "----------------------------890934293568639326555573\r\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
      "Content-Type: text/plain\r\n" +
      "\r\n" +
      "test\r\n" +
      "----------------------------890934293568639326555573--\r\n",
  }).then((res) => res.json());

  expect(res).toEqual({ file: "test.txt" });
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
