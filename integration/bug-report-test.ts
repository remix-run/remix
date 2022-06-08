import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

const SVG_CONTENTS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#000" stroke-width="4" aria-label="Chicken"><path d="M48.1 34C22.1 32 1.4 51 2.5 67.2c1.2 16.1 19.8 17 29 17.8H89c15.7-6.6 6.3-18.9.3-20.5A28 28 0 0073 41.7c-.5-7.2 3.4-11.6 6.9-15.3 8.5 2.6 8-8 .8-7.2.6-6.5-12.3-5.9-6.7 2.7l-3.7 5c-6.9 5.4-10.9 5.1-22.2 7zM48.1 34c-38 31.9 29.8 58.4 25 7.7M70.3 26.9l5.4 4.2"/></svg>`;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/images/icon.svg": SVG_CONTENTS,

      "app/routes/[manifest.webmanifest].js": js`
        import { json } from "@remix-run/node";
        import iconUrl from "~/images/icon.svg";

        export  function loader() {
          return json(
            {
              icons: [
                {
                  src: iconUrl,
                  sizes: '48x48 72x72 96x96 128x128 192x192 256x256 512x512',
                  type: 'image/svg+xml',
                },
              ],
            },
          );
        }
      `,

      // UNCOMMENT THIS TO OBSERVE THE FILE BEING INCLUDED IN THE BUILD OUTPUT
      // "app/routes/index.js": js`
      //   import iconUrl from "~/images/icon.svg";

      //   export default function Index() {
      //     return <img src={iconUrl} />;
      //   }
      // `,
    },
  });

  appFixture = await createAppFixture(fixture);
});

test.afterAll(async () => appFixture.close());

test("writes imported asset with hash to build directory", async ({ page }) => {
  new PlaywrightFixture(appFixture, page);
  let data = await fixture.getBrowserAsset("build/_assets/icon-W7PJN5PS.svg");
  expect(data).toBe(SVG_CONTENTS);
});
