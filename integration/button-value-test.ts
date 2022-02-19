import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;
let app: AppFixture;

beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { Form } from 'remix';

        export default function Index() {
          return (
            <div onClick={e => e.stopPropagation()}>
              <Form method="post" action="/action">
                <button type="submit" name="buttonValue" value="Hello">Submit</button>
              </Form>
            </div>
          )
        }
      `,

      "app/routes/action.jsx": js`
        import { json, useActionData } from "remix";

        export async function action({ request }) {
          const formData = await request.formData();
          return json({ buttonValue: formData.get('buttonValue') });
        }

        export default function Index() {
          const data = useActionData();
          return (
            <p>
              Button value is: {data.buttonValue}
            </p>
          );
        }
      `
    }
  });

  app = await createAppFixture(fixture);
});

afterAll(async () => app.close());

it("should submit the value of the button correctly even when inside a container calling stopPropagation", async () => {
  await app.goto("/");
  await app.clickSubmitButton("/action");
  expect(await app.getHtml()).toMatch("Button value is: Hello");
});
