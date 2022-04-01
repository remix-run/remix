import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { AppFixture } from "./helpers/create-fixture";
import { disableJavaScript } from "./helpers/utils";

describe("loader in an app", () => {
  let app: AppFixture;

  beforeAll(async () => {
    app = await createAppFixture(
      await createFixture({
        files: {
          "app/root.jsx": js`
            import { Scripts, Form, Link } from "@remix-run/react";

            export default function Root() {
              return (
                <html>
                  <body>
                    <Link to="/redirect">Redirect</Link>
                    <Form action="/redirect-to" method="post">
                      <input name="destination" defaultValue="/redirect-destination" />
                      <button type="submit">Redirect</button>
                    </Form>
                    <Link reloadDocument to="/data.json">Data</Link>
                    <Scripts />
                  </body>
                </html>
              );
            }
          `,
          "app/routes/redirected.jsx": js`
            export default () => <div data-testid="redirected">You were redirected</div>;
          `,
          "app/routes/redirect.jsx": js`
            import { redirect } from "@remix-run/node";

            export let loader = () => redirect("/");
          `,
          "app/routes/redirect-to.jsx": js`
            import { redirect } from "@remix-run/node";

            export let action = async ({ request }) => {
              let formData = await request.formData();
              return redirect(formData.get('destination'));
            }
          `,
          "app/routes/redirect-destination.jsx": js`
            export default () => <div data-testid="redirect-destination">You made it!</div>
          `,
          "app/routes/data[.]json.jsx": js`
            import { json } from "@remix-run/node";
            export let loader = () => json({hello: "world"});
          `,
        },
      })
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("with JavaScript", () => {
    runTests();
  });

  describe("without JavaScript", () => {
    beforeEach(async () => {
      await disableJavaScript(app.page);
    });

    runTests();
  });

  function runTests() {
    beforeEach(async () => {
      await app.goto("/");
    });

    it("should redirect to redirected", async () => {
      await app.page.click("a[href='/redirect']");
      await app.page.waitForSelector("[data-testid='redirected']");
    });

    it("should handle post to destination", async () => {
      await app.page.click("button[type='submit']");
      await app.page.waitForSelector("[data-testid='redirect-destination']");
    });

    it("should handle reloadDocument to resource route", async () => {
      await app.page.click("a[href='/data.json']");
      expect(await app.page.content()).toBe('{"hello":"world"}');
    });
  }
});
