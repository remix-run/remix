import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture.js";
import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";

import * as path from "node:path";
import * as url from "node:url";
import * as fs from "node:fs/promises";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

let fixture: Fixture;
let appFixture: AppFixture;

////////////////////////////////////////////////////////////////////////////////
// 💿 👋 Hola! It's me, Dora the Remix Disc, I'm here to help you write a great
// bug report pull request.
//
// You don't need to fix the bug, this is just to report one.
//
// The pull request you are submitting is supposed to fail when created, to let
// the team see the erroneous behavior, and understand what's going wrong.
//
// If you happen to have a fix as well, it will have to be applied in a subsequent
// commit to this pull request, and your now-succeeding test will have to be moved
// to the appropriate file.
//
// First, make sure to install dependencies and build Remix. From the root of
// the project, run this:
//
//    ```
//    yarn && yarn build
//    ```
//
// Now try running this test:
//
//    ```
//    yarn bug-report-test
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    yarn bug-report-test --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

test.beforeEach(async ({ context }) => {
  await context.route(/_data/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    route.continue();
  });
});

test.beforeAll(async () => {
  fixture = await createFixture({
    compiler: "vite",
    files: {
      "app/routes/test/route.tsx": js`
        import fs from 'fs/promises'
        import pdfFile from './example.pdf'
        import { useLoaderData } from '@remix-run/react'
        
        export async function loader() {
            const filepath = '.' + pdfFile
            const contents = await fs.readFile(filepath)
            return { contents: contents.length }
        }
        
        export default function SomeRoute() {
            const { contents } = useLoaderData<typeof loader>()
            return (
                <div>bytes {contents}</div>
            )
        }
      `,

      "app/routes/test/example.pdf": await fs.readFile(path.resolve(__dirname, 'assets/example.pdf')),
    },
  });

  // This creates an interactive app using playwright.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("should be able to import a large binary in dev and prod", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  // If you need to test interactivity use the `app`
  await app.goto("/test");
  await page.waitForSelector(".div");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
