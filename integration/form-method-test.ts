import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

describe('Form submission method', () => {
  let fixture: Fixture;
  let app: AppFixture;

  beforeAll(async () => {
    fixture = await createFixture({
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
                <Form method="post">
                  <button type="submit">Submit</button>
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
                <Form>
                  <button type="submit" formMethod="post">Submit</button>
                </Form>

                <pre>{actionData}</pre>
              </>
            )
          }
        `,

        "app/routes/button-form-method-override.jsx": js`
          import { useActionData, Form, json } from "remix";

          export function action({ request }) {
            return json(request.method)
          }

          export default function() {
            let actionData = useActionData();
            return (
              <>
                <Form method="get">
                  <button type="submit" formMethod="post">Submit</button>
                </Form>

                <pre>{actionData}</pre>
              </>
            )
          }
        `,
      },
    });
  
    app = await createAppFixture(fixture);
    
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses the form "method" attribute', async () => {
    await app.goto("/form-method");
    await app.clickElement("button");
    expect(await app.getHtml("pre")).toMatch("POST");
  });

  it('uses the button "formmethod" attribute', async () => {
    await app.goto("/button-form-method");
    await app.clickElement("button");
    expect(await app.getHtml("pre")).toMatch("POST");
  });
  
  it('overrides the form "method" attribute with the button "formmethod" attribute', async () => {
    await app.goto("/button-form-method-override");
    await app.clickElement("button");
    expect(await app.getHtml("pre")).toMatch("POST");
  });

});
