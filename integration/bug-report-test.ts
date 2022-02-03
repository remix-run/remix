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
      "app/routes/start.jsx": js`
        import { json, useLoaderData, Link, Form, redirect } from "remix";

        export function loader() {
          return json("pizza");
        }
        export async function action({ request }) {
          let formData = await request.formData();
          return redirect(formData.get('_action')?.toString() ?? '/no-value');
        }

        export default function Index() {
          return (
            <div>
              <form method="post">
                <button type="submit" name="_action" value="/value-from-normal-button"><span id="span-button-normal">Normal Button</span></button>
                <button type="submit" name="_action" value="/value-from-svg">
                  <svg height="100" width="100">
                    <circle id="svg-button-normal" cx="50" cy="50" r="40" stroke="black" strokeWidth="3" fill="red" />
                  </svg> 
                </button>
              </form>
              <Form method="post">
                <button type="submit" name="_action" value="/value-from-normal-button"><span id="span-button-enhanced">Normal Button</span></button>
                <button type="submit" name="_action" value="/value-from-svg">
                  <svg height="100" width="100">
                    <circle id="svg-button-enhanced" cx="50" cy="50" r="40" stroke="black" strokeWidth="3" fill="red" />
                  </svg> 
                </button>
              </Form>
            </div>
          )
        }
      `,

      "app/routes/no-value.jsx": js`
        export default function Index() {
          return <div id="result">No value</div>;
        }
      `,

      "app/routes/value-from-svg.jsx": js`
        export default function Index() {
          return <div id="result">Value from SVG button</div>;
        }
      `,

      "app/routes/value-from-normal-button.jsx": js`
        export default function Index() {
          return <div id="result">Value from normal button</div>;
        }
      `
    }
  });

  // This creates an interactive app using puppeteer.
  app = await createAppFixture(fixture);
  if (!app) {
    console.error("unable to create app");
  }
});

afterAll(async () => app.close());

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

it("button value submitted for normal button via HTML form element", async () => {
  await app.goto("/start");
  await app.clickElement("#span-button-normal");
  expect(await app.getHtml("#result")).toMatch('<div id="result">Value from normal button</div>');
});

it("button value submitted for button with SVG via HTML form element", async () => {
  await app.goto("/start");
  await app.clickElement("#svg-button-normal");
  expect(await app.getHtml("#result")).toMatch('<div id="result">Value from SVG button</div>');
});

it("button value submitted for normal button via Remix-enhanced Form element", async () => {
  await app.goto("/start");
  await app.clickElement("#span-button-enhanced");
  expect(await app.getHtml("#result")).toMatch('<div id="result">Value from normal button</div>');
});

// failing test - then Remix-enhanced Form element doesn't submit the button that was clicked if the event.target is not a HTMLElement
it("button value submitted for button with SVG via Remix-enhanced Form element", async () => {
  await app.goto("/start");
  await app.clickElement("#svg-button-enhanced");
  expect(await app.getHtml("#result")).toMatch('<div id="result">Value from SVG button</div>');
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
