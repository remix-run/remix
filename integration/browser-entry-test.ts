import type { Request } from "@playwright/test";
import { test, expect } from "@playwright/test";

import type { AppFixture, Fixture } from "./helpers/create-fixture";
import { createFixture, js, createAppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { Link } from "@remix-run/react";

        export default function Index() {
          return (
            <div>
              <div id="pizza">pizza</div>
              <Link to="/burgers">burger link</Link>
            </div>
          )
        }
      `,

      "app/routes/burgers.jsx": js`

        export default function Index() {
          return (
            <div id="cheeseburger">cheeseburger</div>
          );
        }
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => appFixture.close());

// This test generally fails without the corresponding fix in browser.tsx,
// but sometimes manages to pass. With the fix, it always passes.
test(`expect to be able to browse backward out of a remix app, 
      then forward in history and have pages render correctly`, async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "firefox",
    "FireFox doesn't support browsing to an empty page (aka about:blank)"
  );

  let app = new PlaywrightFixture(appFixture, page);

  // This sets up the Remix modules cache in memory, priming the error case.
  await app.goto("/");
  await app.clickLink("/burgers");
  expect(await page.content()).toContain("cheeseburger");

  let retry = 4;
  for (let i = 0; i < retry; i++) {
    // Back to /
    await page.goBack();

    await page.waitForSelector("#pizza");
    expect(await app.getHtml()).toContain("pizza");

    // Takes the browser to an empty state.
    // This doesn't seem to work in headless Firefox.
    await page.goBack();
    expect(page.url()).toContain("about:blank");

    // This attempts to watch for the request for the entry.client.js chunk
    // and redirect before it is finished loading.
    let redirectOnEntryChunk = async (request: Request) => {
      if (request.url().includes("entry")) {
        page.off("request", redirectOnEntryChunk);
        await page.goForward();
      }
    };

    page.on("request", redirectOnEntryChunk);

    // Forward to /
    // This initiates a request for the entry.client.js chunk
    await page.goForward();
    expect(page.url()).toContain("/");

    // The navigation to /burgers happens in `redirectOnEntryChunk`.
    // Here's an error: the path should be `/burgers`
    // (this validates correctly and passes)
    await page.waitForSelector("#cheeseburger");
    expect(page.url()).toContain("/burgers");

    // but now the content won't contain the string "cheeseburger"
    expect(await app.getHtml()).toContain("cheeseburger");
  }
});
