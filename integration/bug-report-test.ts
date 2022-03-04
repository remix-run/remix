import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

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

describe('failing test', () => {
  let fixture: Fixture;
  let app: AppFixture;

  beforeAll(async () => {
    fixture = await createFixture({
      ////////////////////////////////////////////////////////////////////////////
      // 💿 Next, add files to this object, just like files in a real app,
      // `createFixture` will make an app and run your tests against it.
      ////////////////////////////////////////////////////////////////////////////
      files: {
        "app/routes/form-method.jsx": js`
            import { useActionData, Form, json } from "remix";
  
            export function action({ request }) {
              return json(request.method)
            }
  
            export default function() {
              let actionData = useActionData();
              return (
                <>
                  <Form action="." method="post">
                    <button type="submit">Post</button>
                  </Form>
  
                  <pre>{actionData}</pre>
                </>
              )
            }
          `,

      "app/routes/button-form-method.jsx": js`
          import { useActionData, Form, json } from "remix";

          export function action({ request }) {
            return json(request.method)
          }

          export default function() {
            let actionData = useActionData();
            return (
              <>
                <Form action=".">
                  <button type="submit" formMethod="post">Post</button>
                </Form>

                <pre>{actionData}</pre>
              </>
            )
          }
        `,
      },
    });
  
    // This creates an interactive app using puppeteer.
    app = await createAppFixture(fixture);
    
  });

  afterAll(async () => {
    await app.close();
  });

  test('should use "post" method when clicking a submit button inside a form with attribute method="post"', async () => {
    await app.goto("/form-method");
    await app.clickElement("button");
    expect(await app.getHtml("pre")).toMatch("POST");
  });

  test('should make a "post" request when clicking a submit button with formMethod="post" inside a form with attribute method not set', async () => {
    await app.goto("/button-form-method");
    await app.clickElement("button");
    expect(await app.getHtml("pre")).toMatch("POST");
  });

});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
