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
//    jest integration/bug-report-test.ts
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    jest integration/bug-report-test.ts --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/test.jsx": js`
        import { Form, redirect, useFetcher, useTransition} from "remix";
        
        export const action = async ({ request }) => {
          return redirect("/test");
        };

        export const loader = async ({ request }) => {
          return {};
        };
        export default function Testd() {
          const fetcher = useFetcher();

          return (
            <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
              <span>{fetcher.state}</span>
              <fetcher.Form method="post" action="/test">
                <input type="hidden" name="source" value="fetcher" />
                <button type="submit" name="_action" value="add">
                  Submit
                </button>
              </fetcher.Form>
            </div>
          );
        }
      `
    }
  });

  // This creates an interactive app using puppeteer.
  app = await createAppFixture(fixture);
});

afterAll(async () => app.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

it("useFetcher state should return to the idle when redirect from an action", async () => {
  await app.goto("/test");
  expect(await app.getHtml("span")).toMatch("idle");

  await app.clickSubmitButton("/test");
  expect(await app.getHtml("span")).toMatch("idle");
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
