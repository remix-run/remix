import { test } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { Link } from "@remix-run/react";

        export default function Index() {
          return (
            <ul>
              <li><Link to="passthrough">passthrough</Link></li>
              <li><Link to="defer-passthrough">defer-passthrough</Link></li>
              <li><Link to="client-only">client-only</Link></li>
            </ul>
          );
        }      
      `,
      "app/routes/passthrough.jsx": js`
        import { useLoaderData } from "@remix-run/react";

        export function loader() {
          return {
            title: "Hello from server",
          };
        }

        export async function clientLoader({ next }) {
          const response = await next();
          const data = await response.json();
          return {
            ...data,
            client: "yes",
          };
        }

        export default function Passthrough() {
          const data = useLoaderData();
          return (
            <div>
              <h1>{data.title}</h1>
              <p>{data.client || "no"}</p>
            </div>
          );
        }      
      `,
      "app/routes/defer-passthrough.jsx": js`
        import { Suspense } from "react";
        import { defer } from "@remix-run/node";
        import { Await, useLoaderData } from "@remix-run/react";

        export function loader() {
          return defer({
            title: "Hello from server",
            lazy: Promise.resolve("lazy"),
          });
        }

        export async function clientLoader({ next }) {
          const deferred = await next();
          deferred.data.client = "yes";
          return deferred;
        }

        export default function DeferPassthrough() {
          const data = useLoaderData();
          return (
            <div>
              <h1>{data.title}</h1>
              <p>{data.client || "no"}</p>
              <Suspense>
                <Await resolve={data.lazy}>
                  {(lazy) => <p>{lazy}</p>}
                </Await>
              </Suspense>
            </div>
          );
        }      
      `,
      "app/routes/client-only.jsx": js`
          import { useEffect } from "react";
          import { useLoaderData, useRevalidator } from "@remix-run/react";
  
          export async function clientLoader({ next }) {
            return {
              title: "Hello from client",
              client: "yes",
            };
          }
  
          export default function ClientOnly() {
            const data = useLoaderData();
            const revalidator = useRevalidator();
            useEffect(() => {
              if (!data) revalidator.revalidate();
            }, []);
            return (
              <div>
                <h1>{data?.title}</h1>
                <p>{data?.client || "no"}</p>
              </div>
            );
          }      
        `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

test("calls loader on document request skipping client loader", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/passthrough", true);

  await page.waitForSelector("h1:has-text('Hello from server')");
  await page.waitForSelector("p:has-text('no')");
});

test("calls client loader passthrough on transition", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/", true);
  await app.clickLink("/passthrough");

  await page.waitForSelector("h1:has-text('Hello from server')");
  await page.waitForSelector("p:has-text('yes')");
});

test("calls client loader passthrough on transition with defer", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/", true);
  await app.clickLink("/defer-passthrough");

  await page.waitForSelector("h1:has-text('Hello from server')");
  await page.waitForSelector("p:has-text('yes')");
  await page.waitForSelector("p:has-text('lazy')");
});

test("calls client only loader on revalidation", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/client-only", true);

  await page.waitForSelector("h1:has-text('Hello from client')");
  await page.waitForSelector("p:has-text('yes')");
});

test("calls client only loader on transition", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/", true);
  await app.clickLink("/client-only");

  await page.waitForSelector("h1:has-text('Hello from client')");
  await page.waitForSelector("p:has-text('yes')");
});
