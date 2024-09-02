import { expect } from "@playwright/test";

import type { Files } from "./helpers/vite.js";
import { test, viteConfig } from "./helpers/vite.js";

const files: Files = async ({ port }) => ({
  "vite.config.ts": await viteConfig.basic({ port }),
  "app/routes/_index.tsx": `
    import { Form, useLoaderData } from "@remix-run/react";
    import {
      json,
      type ActionFunctionArgs,
      type LoaderFunctionArgs,
    } from "@remix-run/server-runtime";

    const key = "__my-key__";

    export async function loader({ context }: LoaderFunctionArgs) {
      const MY_KV = await Deno.openKv("test");
      const { value } = await MY_KV.get<string>([key]);
      return json({ value, extra: context.extra });
    }

    export async function action({ request }: ActionFunctionArgs) {
      const MY_KV = await Deno.openKv("test");

      if (request.method === "POST") {
        const formData = await request.formData();
        const value = formData.get("value") as string;
        await MY_KV.set([key], value);
        return null;
      }

      if (request.method === "DELETE") {
        await MY_KV.delete([key]);
        return null;
      }

      throw new Error(\`Method not supported: "\${request.method}"\`);
    }

    export default function Index() {
      const { value } = useLoaderData<typeof loader>();
      return (
        <div>
          <h1>Welcome to Remix</h1>
          {value ? (
            <>
              <p data-text>Value: {value}</p>
              <Form method="DELETE">
                <button>Delete</button>
              </Form>
            </>
          ) : (
            <>
              <p data-text>No value</p>
              <Form method="POST">
                <label htmlFor="value">Set value:</label>
                <input type="text" name="value" id="value" required />
                <br />
                <button>Save</button>
              </Form>
            </>
          )}
        </div>
      );
    }
  `,
});

test("vite dev", async ({ page, viteDevDeno }) => {
  let { port } = await viteDevDeno(files, "vite-deno-template");
  await page.goto(`http://localhost:${port}/`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator("[data-text]")).toHaveText("No value");

  await page.getByLabel("Set value:").fill("my-value");
  await page.getByRole("button").click();
  await expect(page.locator("[data-text]")).toHaveText("Value: my-value");
  expect(page.errors).toEqual([]);
});
