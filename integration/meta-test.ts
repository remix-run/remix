import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("meta", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  // disable JS for all tests in this file
  // to only disable them for some, add another test.describe()
  // and move the following line there
  test.use({ javaScriptEnabled: false });

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { json } from "@remix-run/node";
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export const loader = async () =>
            json({
              description: "This is a meta page",
              title: "Meta Page",
            });

          export const meta = ({ data }) => ({
            charset: "utf-8",
            description: data.description,
            "og:image": "https://picsum.photos/200/200",
            "og:type": data.contentType, // undefined
            refresh: {
              httpEquiv: "refresh",
              content: "3;url=https://www.mozilla.org",
            },
            title: data.title,
          });

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/index.jsx": js`
          export default function Index() {
            return <div>This is the index file</div>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => appFixture.close());

  test("empty meta does not render a tag", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    await expect(app.getHtml('meta[property="og:type"]')).rejects.toThrowError(
      'No element matches selector "meta[property="og:type"]"'
    );
  });

  test("meta { charset } adds a <meta charset='utf-8' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[charset="utf-8"]')).toBeTruthy();
  });

  test("meta { title } adds a <title />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml("title")).toBeTruthy();
  });

  test("meta { 'og:*' } adds a <meta property='og:*' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[property="og:image"]')).toBeTruthy();
  });

  test("meta { description } adds a <meta name='description' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[name="description"]')).toBeTruthy();
  });

  test("meta { refresh } adds a <meta http-equiv='refresh' content='3;url=https://www.mozilla.org' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(
      await app.getHtml(
        'meta[http-equiv="refresh"][content="3;url=https://www.mozilla.org"]'
      )
    ).toBeTruthy();
  });
});

test.describe("meta array syntax", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  // disable JS for all tests in this file
  // to only disable them for some, add another test.describe()
  // and move the following line there
  test.use({ javaScriptEnabled: false });

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { json } from "@remix-run/node";
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export const loader = async () =>
            json({
              description: "This is a meta page",
              title: "Meta Page",
              contentType: undefined,
            });

          export const meta = ({ data }) => [
            { key: "charset", content: "utf-8" },
            { name: "description", content: data.description },
            { property: "og:image", content: "https://picsum.photos/300/300" },
            { property: "og:image:width", content: "300" },
            { property: "og:image:height", content: "300" },
            { property: "og:image", content: "https://picsum.photos/200/200" },
            { property: "og:image", content: "https://picsum.photos/500/1000" },
            { property: "og:image:height", content: "1000" },
            { property: "og:type", content: data.contentType }, // undefined
            { key: "httpEquiv:refresh", httpEquiv: "refresh", content: "3;url=https://www.mozilla.org" },
            { title: data.title },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
          ];

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/index.jsx": js`
          export const meta = ({ data }) => [
            { title: 'Override Title' },
          ];

          export default function Index() {
            return <div>This is the index file</div>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => appFixture.close());

  test("empty meta does not render a tag", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    await expect(app.getHtml('meta[property="og:type"]')).rejects.toThrowError(
      'No element matches selector "meta[property="og:type"]"'
    );
  });

  test("meta { charset } adds a <meta charset='utf-8' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[charset="utf-8"]')).toBeTruthy();
  });

  test("meta { title } adds a <title />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml("title")).toBeTruthy();
  });

  test("meta { title } overrides a <title />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml("title")).toBe("<title>Override Title</title>");
  });

  test("meta { 'og:*' } adds a <meta property='og:*' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[property="og:image"]')).toBeTruthy();
  });

  test("meta { description } adds a <meta name='description' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[name="description"]')).toBeTruthy();
  });

  test("meta { refresh } adds a <meta http-equiv='refresh' content='3;url=https://www.mozilla.org' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(
      await app.getHtml(
        'meta[http-equiv="refresh"][content="3;url=https://www.mozilla.org"]'
      )
    ).toBeTruthy();
  });

  test("meta supports multiple items with same name/property />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getElement('meta[property="og:image"]')).toHaveLength(3);
  });
});
