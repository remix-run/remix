import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

test.describe("useFetcher", () => {
  let fixture: Fixture;
  let app: AppFixture;

  let CHEESESTEAK = "CHEESESTEAK";
  let LUNCH = "LUNCH";

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/routes/resource-route.jsx": js`
          export function loader() {
            return "${LUNCH}"
          }
          export function action() {
            return "${CHEESESTEAK}"
          }
        `,

        "app/routes/index.jsx": js`
          import { useFetcher } from "remix";
          export default function Index() {
            let fetcher = useFetcher();
            return (
              <>
                <fetcher.Form action="/resource-route">
                  <button type="submit" formMethod="get">get</button>
                  <button type="submit" formMethod="post">post</button>
                </fetcher.Form>
                <button id="fetcher-load" type="button" onClick={() => {
                  fetcher.load('/resource-route')
                }}>
                  load
                </button>
                <button id="fetcher-submit" type="button" onClick={() => {
                  fetcher.submit(new URLSearchParams(), {
                    method: 'post',
                    action: '/resource-route'
                  })
                }}>
                  submit
                </button>
                <pre>{fetcher.data}</pre>
              </>
            )
          }
        `,
      },
    });

    app = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await app.close();
  });

  test.describe("No JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("Form can hit a loader", async ({ page }) => {
      await app.goto(page, "/");

      await Promise.all([
        page.waitForNavigation(),
        app.clickSubmitButton(page, "/resource-route", {
          wait: false,
          method: "get",
        }),
      ]);

      expect(await app.getHtml(page, "pre")).toMatch(LUNCH);
    });

    test("Form can hit an action", async ({ page }) => {
      await app.goto(page, "/");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        app.clickSubmitButton(page, "/resource-route", {
          wait: false,
          method: "post",
        }),
      ]);
      expect(await app.getHtml(page, "pre")).toMatch(CHEESESTEAK);
    });
  });

  test("load can hit a loader", async ({ page }) => {
    await app.goto(page, "/");
    await app.clickElement(page, "#fetcher-load");
    expect(await app.getHtml(page, "pre")).toMatch(LUNCH);
  });

  test("submit can hit an action", async ({ page }) => {
    await app.goto(page, "/");
    await app.clickElement(page, "#fetcher-submit");
    expect(await app.getHtml(page, "pre")).toMatch(CHEESESTEAK);
  });
});
