import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;

beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { json } from "remix";

        export async function action({ request }) {
          try {
            await request.formData()
          } catch (err) {
            return json("no pizza");
          }
          return json("pizza");
        }
      `,
    },
  });
});

it("should respond and not crash server", async () => {
  // You can test any request your app might get using `fixture`.
  let response = await fixture.requestDocument("/", {
    method: "post",
    headers: { "content-type": "application/json" },
  });
  expect(await response.text()).toMatch("no pizza");
});
