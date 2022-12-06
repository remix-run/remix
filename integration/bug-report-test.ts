import http from "node:http";
import { setTimeout as wait } from "node:timers/promises";
import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import { ServerMode } from "../packages/remix-server-runtime/mode";

let ports = {
  firefox: 10999,
  firefox_nojs: 11999,
  chromium: 10998,
  chromium_nojs: 11998,
  webkit: 10997,
  webkit_nojs: 11997,
  edge: 10996,
  edge_nojs: 11996,
} as const;

function runTest() {
  test("should fail with firefox with js enabled running in dev", async ({ page, javaScriptEnabled }, { project }) => {
    process.env.NODE_ENV = ServerMode.Development;
    let portKey = project.name;
    if (!javaScriptEnabled) {
      portKey += "_nojs";
    }
    let port = ports[portKey as keyof typeof ports];
    let fixture = await createFixture({
      files: {
        "app/routes/race-condition.jsx": js`
          import { Form } from "@remix-run/react";
          export default function() {
            return (
              <>
                <Form method="post" action="/race-condition-action">
                  <button type="submit">Submit</button>
                </Form>
              </>
            )
          }
        `,
        "app/routes/race-condition-action.js": js`
          import { redirect } from "@remix-run/node";

          export async function loader() {
            return redirect("/race-condition");
          }

          export async function action() {
            return redirect("http://localhost:${port}/");
          }
        `,
        "app/routes/race-condition-callback.js": js`
          import { redirect } from "@remix-run/node";

          export async function loader() {
            return redirect("/race-condition-result?success=true");
          }
        `,
        "app/routes/race-condition-result.jsx": js`
          import { useSearchParams } from "@remix-run/react";

          export default function() {
            const [searchParams] = useSearchParams();

            return (
              <div>success = {searchParams.get("success") ?? "false"}</div>
            )
          }
        `,
      },
      mode: ServerMode.Development,
    });
    let appFixture = await createAppFixture(fixture, ServerMode.Development);
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/race-condition");

    let baseUrl = page.url();
    let slowExternalServer = http.createServer(async (req, res) => {
      await wait(1000);
      res.writeHead(302, {
        "Location": baseUrl.replace("/race-condition", "/race-condition-callback"),
      });
      res.end();
    });
    slowExternalServer.listen(port);

    await app.clickSubmitButton("/race-condition-action", { wait: true });
    expect(page.url()).toMatch(/\/race-condition-result\?success=true$/);

    slowExternalServer.close();
    await appFixture.close();
  });
}

test.describe("with JS", () => {
  // it should fail only with firefox
  test.use({ javaScriptEnabled: true });
  runTest();
});

test.describe("without JS", () => {
  // no failure expected
  test.use({ javaScriptEnabled: false });
  runTest();
});
