import {
  createAppFixture,
  createFixture,
  js,
  getElement,
} from "./helpers/create-fixture";
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
      "app/routes/foo.jsx": js`
        import { json, useActionData, Outlet } from "remix";

        export async function action({ request }) {
          let data = Object.fromEntries(await request.formData());
          return json(data);
        }

        export default function Index() {
          let data = useActionData();
          return (
            <div>
              <Outlet />
              <pre data-testid="layout-data">{JSON.stringify(data)}</pre>
            </div>
          )
        }
      `,

      "app/routes/foo/index.jsx": js`
        import { Form, useActionData } from "remix";
        export default function Index() {
          let actionData = useActionData();
          return (
            <Form action="/foo" method="post">
              <input type="hidden" name="foo" value="bar" />
              <button type="submit">Submit</button>
              <pre data-testid="index-data">{JSON.stringify(actionData)}</pre>
            </Form>
          );
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

describe("submit form to layout route action handler", () => {
  beforeAll(async () => {
    await app.goto("/foo");
    await app.clickSubmitButton("/foo");
    app.collectDataResponses();
  });

  let expected = JSON.stringify({ foo: "bar" });

  it("layout component gets data from useActionData", async () => {
    let html = await app.getHtml();
    let layoutEl = getElement(html, "[data-testid=layout-data]");
    expect(layoutEl.text()).toEqual(expected);
  });

  it("index component gets data from useActionData", async () => {
    let html = await app.getHtml();
    let childEl = getElement(html, "[data-testid=index-data]");
    expect(childEl.text()).toEqual(expected);
  });
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
