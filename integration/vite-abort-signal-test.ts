import { test } from "@playwright/test";
import getPort from "get-port";

import { createProject, viteDev, viteConfig } from "./helpers/vite.js";

const js = String.raw;

let port: number;
let cwd: string;
let stop: () => void;

test.beforeAll(async () => {
  port = await getPort();
  cwd = await createProject({
    "vite.config.js": await viteConfig.basic({ port: port }),
    "app/routes/_index.tsx": js`
        import { json } from "@remix-run/node";
        import { useActionData, useLoaderData, Form } from "@remix-run/react";

        export async function action ({ request }) {
          // New event loop causes express request to close
          await new Promise(r => setTimeout(r, 0));
          return json({ aborted: request.signal.aborted });
        }

        export function loader({ request }) {
          return json({ aborted: request.signal.aborted });
        }

        export default function Index() {
          let actionData = useActionData();
          let data = useLoaderData();
          return (
            <div>
              <p className="action">{actionData ? String(actionData.aborted) : "empty"}</p>
              <p className="loader">{String(data.aborted)}</p>
              <Form method="post">
                <button type="submit">Submit</button>
              </Form>
            </div>
          )
        }
      `,
  });
  stop = await viteDev({ cwd, port });
});

test.afterAll(() => stop());

test("should not abort the request in a new event loop", async ({ page }) => {
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector(`.action:has-text("empty")`);
  await page.waitForSelector(`.loader:has-text("false")`);

  await page.click('button[type="submit"]');

  await page.waitForSelector(`.action:has-text("false")`);
  await page.waitForSelector(`.loader:has-text("false")`);
});
