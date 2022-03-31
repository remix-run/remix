import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { disableJavaScript } from "./helpers/utils";

describe("_layout routes", () => {
  let app: AppFixture;

  let HOME_PAGE_TEXT = "hello world";

  beforeAll(async () => {
    app = await createAppFixture(
      await createFixture({
        files: {
          "app/root.jsx": js`
            export default function Root() {
              return (
                <html>
                  <body>
                    <Outlet />
                  </body>
                </html>
              );
            }
          `,
          "app/routes/_with-layout.jsx": js`
            export default () => (
              <div data-testid="_layout">
                <h1>Layout Test</h1>
                <Outlet>
              </div>
            )
          `,
          "app/routes/_with-layout/index.jsx": js`
              export default () => <h2>Page inside layout</h2>
          `,
        },
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("applied as parent route without javascript", async () => {
    await disableJavaScript(app.page);
    let response = await app.goto(`/with-layout`);
    expect(response!.status()).toBe(200);
    expect(
      await app.getHtml('[data-testid="_layout"]')
    ).toMatchInlineSnapshot();
  });

  it.skip("applied as parent route with javascript", async () => {
    await page.goto(`${testServer}/`);
    await Utils.reactIsHydrated(page);

    await page.click('a[href="/with-layout"]');
    await page.waitForSelector('[data-test-id="_layout"]');

    expect(await Utils.getHtml(page, '[data-test-id="_layout"]'))
      .toMatchInlineSnapshot(`
      "<div data-test-id=\\"_layout\\">
        <h1>Layout Test</h1>
        <div><h1>Page inside layout</h1></div>
      </div>
      "
    `);
  });
});
