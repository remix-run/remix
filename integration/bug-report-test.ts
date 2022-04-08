import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;
let app: AppFixture;

////////////////////////////////////////////////////////////////////////////////
// 💿 👋 Hola! It's me, Dora the Remix Disc, I'm here to help you write a great
// bug report pull request. You don't need to fix the bug, this is just to
// report one.
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

beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/index.jsx": js`
        import { json } from "@remix-run/node";
        import { Form } from "@remix-run/react";

        export async function action() {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return json({});
        }

        export default function Index() {
          return (
            <div>
              <Form action="/" method="post"><button type="submit">Submit</button></Form>
            </div>
          )
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  app = await createAppFixture(fixture);
});

afterAll(async () => app.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

it("should not modify the browser URL while submitting a Form", async () => {
  // If you need to test interactivity use the `app`
  await app.goto("/?query=test");

  let urlBeforeSubmit = new URL(app.page.url());
  expect(urlBeforeSubmit.searchParams.get("query")).toBe("test");

  await app.clickSubmitButton("/");

  let urlImmediatelyAfterSubmit = new URL(app.page.url());
  expect(urlImmediatelyAfterSubmit.searchParams.get("query")).toBe("test");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
