import { PassThrough } from "node:stream";
import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";

import type { FixtureInit } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";
import { PlaywrightFixture } from "./helpers/playwright-fixture.js";

let ROOT_FILE_CONTENTS = js`
  import { Outlet, Scripts } from "@remix-run/react";

  export default function App() {
    return (
      <html lang="en">
        <body>
          <Outlet />
          <Scripts />
        </body>
      </html>
    );
  }
`;

async function setup(init: Partial<FixtureInit>, page: Page) {
  let buildStdio = new PassThrough();
  let buildOutput: string;

  let fixture = await createFixture({
    buildStdio,
    ...init,
  });

  let chunks: Buffer[] = [];
  buildOutput = await new Promise<string>((resolve, reject) => {
    buildStdio.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    buildStdio.on("error", (err) => reject(err));
    buildStdio.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

  let appFixture = await createAppFixture(fixture);
  console.log("buildOutput\n", buildOutput);
  let app = new PlaywrightFixture(appFixture, page);
  return { fixture, appFixture, app, buildOutput };
}

test.describe("route ranking", () => {
  test("chooses the first matching file in the case of ties", async ({
    page,
  }) => {
    let { app } = await setup(
      {
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/($locale).apple-pay.jsx": js`
          import { useLoaderData } from '@remix-run/react';

          export function loader() {
            return ":locale?/apple-pay"
          }

          export default function Component() {
            let data = useLoaderData();
            return (
              <>
                <h1>:locale?/apple-pay</h1>
                <pre>{data}</pre>
              </>
            );
          }
        `,
          "app/routes/($locale).legal.$article.jsx": js`
          import { useLoaderData } from '@remix-run/react';

          export function loader() {
            return ":locale?/legal/:article"
          }

          export default function Component() {
            let data = useLoaderData();
            return (
              <>
                <h1>:locale?/legal/:article</h1>
                <pre>{data}</pre>
              </>
            );
          }
        `,
        },
      },
      page
    );

    await app.goto("/legal/apple-pay");
    await page.waitForSelector("h1");
    expect(await app.getHtml("h1")).toMatch(":locale?/apple-pay");
    expect(await app.getHtml("pre")).toMatch(":locale?/apple-pay");
  });

  test("preserves user-ordering from remix.config.js", async ({ page }) => {
    let { app } = await setup(
      {
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "remix.config.js": js`
            export default {
              ignoredRouteFiles: [
                "**/.*",
                "routes/($locale).apple-pay.jsx",
                "routes/($locale).legal.$article.jsx",
              ],
              async routes(defineRoutes) {
                return defineRoutes((route) => {
                  route("/:locale?/legal/:article", "routes/($locale).legal.$article.jsx");
                  route("/:locale?/apple-pay", "routes/($locale).apple-pay.jsx");
                });
              },
            };
          `,
          "app/routes/($locale).apple-pay.jsx": js`
            import { useLoaderData } from '@remix-run/react';

            export function loader() {
              return ":locale?/apple-pay"
            }

            export default function Component() {
              let data = useLoaderData();
              return (
                <>
                  <h1>:locale?/apple-pay</h1>
                  <pre>{data}</pre>
                </>
              );
            }
          `,
          "app/routes/($locale).legal.$article.jsx": js`
            import { useLoaderData } from '@remix-run/react';

            export function loader() {
              return ":locale?/legal/:article"
            }

            export default function Component() {
              let data = useLoaderData();
              return (
                <>
                  <h1>:locale?/legal/:article</h1>
                  <pre>{data}</pre>
                </>
              );
            }
          `,
        },
      },
      page
    );

    await app.goto("/legal/apple-pay");
    await page.waitForSelector("h1");
    expect(await app.getHtml("h1")).toMatch(":locale?/legal/:article");
    expect(await app.getHtml("pre")).toMatch(":locale?/legal/:article");
  });

  test.describe("vite", () => {
    test("chooses the first matching file in the case of ties (vite)", async ({
      page,
    }) => {
      let { app } = await setup(
        {
          compiler: "vite",
          files: {
            "vite.config.ts": js`
              import { defineConfig } from "vite";
              import { vitePlugin as remix } from "@remix-run/dev";

              export default defineConfig({
                plugins: [remix()],
              });
            `,
            "app/root.tsx": ROOT_FILE_CONTENTS,
            "app/routes/($locale).apple-pay.jsx": js`
              import { useLoaderData } from '@remix-run/react';

              export function loader() {
                return ":locale?/apple-pay"
              }

              export default function Component() {
                let data = useLoaderData();
                return (
                  <>
                    <h1>:locale?/apple-pay</h1>
                    <pre>{data}</pre>
                  </>
                );
              }
            `,
            "app/routes/($locale).legal.$article.jsx": js`
              import { useLoaderData } from '@remix-run/react';

              export function loader() {
                return ":locale?/legal/:article"
              }

              export default function Component() {
                let data = useLoaderData();
                return (
                  <>
                    <h1>:locale?/legal/:article</h1>
                    <pre>{data}</pre>
                  </>
                );
              }
            `,
          },
        },
        page
      );

      await app.goto("/legal/apple-pay");
      await page.waitForSelector("h1");
      expect(await app.getHtml("h1")).toMatch(":locale?/apple-pay");
      expect(await app.getHtml("pre")).toMatch(":locale?/apple-pay");
    });

    test("preserves user-ordering from remix.config.js", async ({ page }) => {
      let { app } = await setup(
        {
          compiler: "vite",
          files: {
            "vite.config.ts": js`
              import { defineConfig } from "vite";
              import { vitePlugin as remix } from "@remix-run/dev";

              export default defineConfig({
                plugins: [
                  remix({
                    ignoredRouteFiles: [
                      "**/.*",
                      "routes/($locale).apple-pay.jsx",
                      "routes/($locale).legal.$article.jsx",
                    ],
                    async routes(defineRoutes) {
                      return defineRoutes((route) => {
                        route("/:locale?/legal/:article", "routes/($locale).legal.$article.jsx");
                        route("/:locale?/apple-pay", "routes/($locale).apple-pay.jsx");
                      });
                    },
                  })],
              });
            `,
            "app/root.tsx": ROOT_FILE_CONTENTS,
            "app/routes/($locale).apple-pay.jsx": js`
              import { useLoaderData } from '@remix-run/react';

              export function loader() {
                return ":locale?/apple-pay"
              }

              export default function Component() {
                let data = useLoaderData();
                return (
                  <>
                    <h1>:locale?/apple-pay</h1>
                    <pre>{data}</pre>
                  </>
                );
              }
            `,
            "app/routes/($locale).legal.$article.jsx": js`
              import { useLoaderData } from '@remix-run/react';

              export function loader() {
                return ":locale?/legal/:article"
              }

              export default function Component() {
                let data = useLoaderData();
                return (
                  <>
                    <h1>:locale?/legal/:article</h1>
                    <pre>{data}</pre>
                  </>
                );
              }
            `,
          },
        },
        page
      );

      await app.goto("/legal/apple-pay");
      await page.waitForSelector("h1");
      expect(await app.getHtml("h1")).toMatch(":locale?/legal/:article");
      expect(await app.getHtml("pre")).toMatch(":locale?/legal/:article");
    });
  });
});
