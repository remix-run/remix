import { test, expect } from "@playwright/test";
import getPort from "get-port";

import {
  createProject,
  viteConfig,
  viteBuild,
  viteRemixServe,
  collectDataResponses,
  collectSingleFetchResponses,
} from "./helpers/vite.js";
import { selectHtml } from "./helpers/playwright-fixture.js";

const js = String.raw;

test.describe("actions", () => {
  let port: number;
  let cwd: string;
  let stop: () => void;

  let FIELD_NAME = "message";
  let WAITING_VALUE = "Waiting...";
  let SUBMITTED_VALUE = "Submission";
  let THROWS_REDIRECT = "redirect-throw";
  let REDIRECT_TARGET = "page";
  let PAGE_TEXT = "PAGE_TEXT";

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.js": await viteConfig.basic({ port: port }),

      "app/routes/urlencoded.tsx": js`
        import { Form, useActionData } from "@remix-run/react";

        export let action = async ({ request }) => {
          let formData = await request.formData();
          return formData.get("${FIELD_NAME}");
        };

        export default function Actions() {
          let data = useActionData()

          return (
            <Form method="post" id="form">
              <p id="text">
                {data ? <span id="action-text">{data}</span> : "${WAITING_VALUE}"}
              </p>
              <p>
                <input type="text" defaultValue="${SUBMITTED_VALUE}" name="${FIELD_NAME}" />
                <button type="submit" id="submit">Go</button>
              </p>
            </Form>
          );
        }
      `,

      "app/routes/request-text.tsx": js`
        import { Form, useActionData } from "@remix-run/react";

        export let action = async ({ request }) => {
          let text = await request.text();
          return text;
        };

        export default function Actions() {
          let data = useActionData()

          return (
            <Form method="post" id="form">
              <p id="text">
                {data ? <span id="action-text">{data}</span> : "${WAITING_VALUE}"}
              </p>
              <p>
                <input name="a" defaultValue="1" />
                <input name="b" defaultValue="2" />
                <button type="submit" id="submit">Go</button>
              </p>
            </Form>
          );
        }
      `,

      [`app/routes/${THROWS_REDIRECT}.jsx`]: js`
        import { redirect } from "@remix-run/node";
        import { Form } from "@remix-run/react";

        export function action() {
          throw redirect("/${REDIRECT_TARGET}")
        }

        export default function () {
          return (
            <Form method="post">
              <button type="submit">Go</button>
            </Form>
          )
        }
      `,

      [`app/routes/${REDIRECT_TARGET}.jsx`]: js`
        export default function () {
          return <div id="${REDIRECT_TARGET}">${PAGE_TEXT}</div>
        }
      `,

      "app/routes/no-action.tsx": js`
        import { Form } from "@remix-run/react";

        export default function Component() {
          return (
            <Form method="post">
              <button type="submit">Submit without action</button>
            </Form>
          );
        }
      `,
    });
    viteBuild({ cwd });
    stop = await viteRemixServe({ cwd, port });
  });

  test.afterAll(() => stop());

  let logs: string[] = [];

  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      logs.push(msg.text());
    });
  });

  test.afterEach(() => {
    expect(logs).toHaveLength(0);
  });

  test("is not called on document GET requests", async ({ page }) => {
    await page.goto(`http://localhost:${port}/urlencoded`);
    expect(await page.innerHTML("body")).toContain(WAITING_VALUE);
  });

  test("is called on document POST requests", async ({ page, request }) => {
    let FIELD_VALUE = "cheeseburger";

    let params = new URLSearchParams();
    params.append(FIELD_NAME, FIELD_VALUE);

    let res = await request.post(`http://localhost:${port}/urlencoded`, {
      data: params.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    let html = selectHtml(await res.text(), "#text");
    expect(html).toMatch(FIELD_VALUE);
  });

  test("is called on script transition POST requests", async ({ page }) => {
    await page.goto(`http://localhost:${port}/urlencoded`);
    await page.waitForSelector(`#text:has-text("${WAITING_VALUE}")`);

    await await page.click("button[type=submit]");
    await page.waitForSelector("#action-text");
    await page.waitForSelector(`#text:has-text("${SUBMITTED_VALUE}")`);
  });

  test("throws a 405 when no action exists", async ({ page }) => {
    await page.goto(`http://localhost:${port}/no-action`);
    await await page.click("button[type=submit]");
    await page.waitForSelector(`h1:has-text("405 Method Not Allowed")`);
    expect(logs.length).toBe(2);
    expect(logs[0]).toMatch('Route "routes/no-action" does not have an action');
    // logs[1] is the raw ErrorResponse instance from the boundary but playwright
    // seems to just log the name of the constructor, which in the minified code
    // is meaningless so we don't bother asserting

    // The rest of the tests in this suite assert no logs, so clear this out to
    // avoid failures in afterEach
    logs = [];
  });

  test("properly encodes form data for request.text() usage", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}/request-text`);
    await page.waitForSelector(`#text:has-text("${WAITING_VALUE}")`);

    await await page.click("button[type=submit]");
    await page.waitForSelector("#action-text");
    expect(await page.innerHTML("#action-text")).toBe("a=1&amp;b=2");
  });

  test("redirects a thrown response on document requests", async ({
    request,
  }) => {
    let params = new URLSearchParams();
    let res = await request.post(
      `http://localhost:${port}/${THROWS_REDIRECT}`,
      {
        maxRedirects: 0,
        data: params.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    expect(res.status()).toBe(302);
    expect(res.headers().location).toBe(`/${REDIRECT_TARGET}`);
  });

  test("redirects a thrown response on script transitions", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}/${THROWS_REDIRECT}`);
    let responses = collectDataResponses(page);
    await page.click(`form[action="/${THROWS_REDIRECT}"] button[type=submit]`);
    await page.waitForSelector(`#${REDIRECT_TARGET}`);

    expect(responses.length).toBe(1);
    expect(responses[0].status()).toBe(204);

    expect(new URL(page.url()).pathname).toBe(`/${REDIRECT_TARGET}`);
    expect(await page.content()).toMatch(PAGE_TEXT);
  });
});

test.describe("actions", () => {
  test.describe("single fetch", () => {
    test.describe(async () => {
      let port: number;
      let cwd: string;
      let stop: () => void;

      let FIELD_NAME = "message";
      let WAITING_VALUE = "Waiting...";
      let SUBMITTED_VALUE = "Submission";
      let THROWS_REDIRECT = "redirect-throw";
      let REDIRECT_TARGET = "page";
      let PAGE_TEXT = "PAGE_TEXT";

      test.beforeAll(async () => {
        port = await getPort();
        cwd = await createProject({
          "vite.config.js": js`
          import { vitePlugin as remix } from "@remix-run/dev";

          export default {
            ${await viteConfig.server({ port })}
            plugins: [
              remix({
                future: {
                  unstable_singleFetch: true,
                },
              }),
            ],
          }
        `,

          "app/routes/urlencoded.tsx": js`
        import { Form, useActionData } from "@remix-run/react";

        export let action = async ({ request }) => {
          let formData = await request.formData();
          return formData.get("${FIELD_NAME}");
        };

        export default function Actions() {
          let data = useActionData()

          return (
            <Form method="post" id="form">
              <p id="text">
                {data ? <span id="action-text">{data}</span> : "${WAITING_VALUE}"}
              </p>
              <p>
                <input type="text" defaultValue="${SUBMITTED_VALUE}" name="${FIELD_NAME}" />
                <button type="submit" id="submit">Go</button>
              </p>
            </Form>
          );
        }
      `,

          "app/routes/request-text.tsx": js`
        import { Form, useActionData } from "@remix-run/react";

        export let action = async ({ request }) => {
          let text = await request.text();
          return text;
        };

        export default function Actions() {
          let data = useActionData()

          return (
            <Form method="post" id="form">
              <p id="text">
                {data ? <span id="action-text">{data}</span> : "${WAITING_VALUE}"}
              </p>
              <p>
                <input name="a" defaultValue="1" />
                <input name="b" defaultValue="2" />
                <button type="submit" id="submit">Go</button>
              </p>
            </Form>
          );
        }
      `,

          [`app/routes/${THROWS_REDIRECT}.jsx`]: js`
        import { redirect } from "@remix-run/node";
        import { Form } from "@remix-run/react";

        export function action() {
          throw redirect("/${REDIRECT_TARGET}")
        }

        export default function () {
          return (
            <Form method="post">
              <button type="submit">Go</button>
            </Form>
          )
        }
      `,

          [`app/routes/${REDIRECT_TARGET}.jsx`]: js`
        export default function () {
          return <div id="${REDIRECT_TARGET}">${PAGE_TEXT}</div>
        }
      `,

          "app/routes/no-action.tsx": js`
        import { Form } from "@remix-run/react";

        export default function Component() {
          return (
            <Form method="post">
              <button type="submit">Submit without action</button>
            </Form>
          );
        }
      `,
        });
      });

      test.describe(() => {
        test.beforeAll(async () => {
          viteBuild({ cwd });
          stop = await viteRemixServe({ cwd, port });
        });
        test.afterAll(() => stop());

        let logs: string[] = [];

        test.beforeEach(({ page }) => {
          page.on("console", (msg) => {
            logs.push(msg.text());
          });
        });

        test.afterEach(() => {
          expect(logs).toHaveLength(0);
        });

        test("is not called on document GET requests", async ({ page }) => {
          await page.goto(`http://localhost:${port}/urlencoded`);
          expect(await page.innerHTML("body")).toContain(WAITING_VALUE);
        });

        test("is called on document POST requests", async ({
          page,
          request,
        }) => {
          let FIELD_VALUE = "cheeseburger";

          let params = new URLSearchParams();
          params.append(FIELD_NAME, FIELD_VALUE);

          let res = await request.post(`http://localhost:${port}/urlencoded`, {
            data: params.toString(),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });

          let html = selectHtml(await res.text(), "#text");
          expect(html).toMatch(FIELD_VALUE);
        });

        test("is called on script transition POST requests", async ({
          page,
        }) => {
          await page.goto(`http://localhost:${port}/urlencoded`);
          await page.waitForSelector(`#text:has-text("${WAITING_VALUE}")`);

          await page.click("button[type=submit]");
          await page.waitForSelector("#action-text");
          await page.waitForSelector(`#text:has-text("${SUBMITTED_VALUE}")`);
        });

        test("throws a 405 when no action exists", async ({ page }) => {
          await page.goto(`http://localhost:${port}/no-action`);
          await page.click("button[type=submit]");
          await page.waitForSelector(`h1:has-text("405 Method Not Allowed")`);
          expect(logs.length).toBe(2);
          expect(logs[0]).toMatch(
            'Route "routes/no-action" does not have an action'
          );
          // logs[1] is the raw ErrorResponse instance from the boundary but playwright
          // seems to just log the name of the constructor, which in the minified code
          // is meaningless so we don't bother asserting

          // The rest of the tests in this suite assert no logs, so clear this out to
          // avoid failures in afterEach
          logs = [];
        });

        test("properly encodes form data for request.text() usage", async ({
          page,
        }) => {
          await page.goto(`http://localhost:${port}/request-text`);
          await page.waitForSelector(`#text:has-text("${WAITING_VALUE}")`);

          await page.click("button[type=submit]");
          await page.waitForSelector("#action-text");
          expect(await page.innerHTML("#action-text")).toBe("a=1&amp;b=2");
        });

        test("redirects a thrown response on document requests", async ({
          request,
        }) => {
          let params = new URLSearchParams();
          let res = await request.post(
            `http://localhost:${port}/${THROWS_REDIRECT}`,
            {
              maxRedirects: 0,
              data: params.toString(),
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
          );
          expect(res.status()).toBe(302);
          expect(res.headers().location).toBe(`/${REDIRECT_TARGET}`);
        });

        test("redirects a thrown response on script transitions", async ({
          page,
        }) => {
          await page.goto(`http://localhost:${port}/${THROWS_REDIRECT}`);
          let responses = collectSingleFetchResponses(page);
          await await page.click(
            `form[action="/${THROWS_REDIRECT}"] button[type=submit]`
          );
          await page.waitForSelector(`#${REDIRECT_TARGET}`);

          expect(responses.length).toBe(1);
          expect(responses[0].status()).toBe(200);

          expect(new URL(page.url()).pathname).toBe(`/${REDIRECT_TARGET}`);
          expect(await page.content()).toMatch(PAGE_TEXT);
        });
      });
    });
  });
});
