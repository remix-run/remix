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
      "app/routes/index.jsx": js`
        import {
          json,
          unstable_parseMultipartFormData,
          unstable_createMemoryUploadHandler,
        } from "@remix-run/node";
        import { Form, useActionData } from "@remix-run/react";

        export async function action({ request }) {
          const formData = await unstable_parseMultipartFormData(
            request,
            unstable_createMemoryUploadHandler({
              filter(args) {
                return args.contentType === "text/csv";
              },
            })
          );

          return json({
            spongebob: formData.get("spongebob"),
          });
        }

        export default function Index() {
          let data = useActionData();
          return (
            <div>
              <p data-test-id="result">{data?.spongebob}</p>
              <Form method="post" encType="multipart/form-data">
                <input type="text" name="spongebob" defaultValue="squarepants" />
                <input type="file" name="uploadFile" />
                <button type="submit">Submit</button>
              </Form>
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

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("[description of what you expect it to do]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickElement("text=Submit");
  const result = await app.getElement("[data-test-id=result]");

  expect(result.html()).toBe("squarepants");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
