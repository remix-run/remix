import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

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

test.beforeAll(async () => {
  fixture = await createFixture({
    future: { v2_routeConvention: true },
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/routes/post/route.jsx": js`
        import { json } from "@remix-run/node";
        import { useLoaderData } from "@remix-run/react";
        import { Content } from "./content";
        import { Heading } from "./heading";
        
        export function loader() {
          return json({
            title: "Some post title",
            content: "Some post content",
          });
        }
        
        export default function Post() {
          const data = useLoaderData();
        
          return (
            <div>
              <Heading title={data.title} />
              <Content content={data.content} />
            </div>
          );
        }      
      `,
      // According to the docs, these should NOT be route modules
      // This component is without a loader, so it will throw an error
      "app/routes/post/heading.jsx": js`
        export const Heading = ({ title }) => {
          return <h1>{title}</h1>;
        };      
      `,
      // This component has a loader, thus it renders the loader data
      "app/routes/post/content.jsx": js`
        export function loader() {
          return "unexpected content";
        }
        
        export const Content = ({ content }) => {
          return <article>{content}</article>;
        };           
      `,
    },
  });

  // This creates an interactive app using puppeteer.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("requests to `/post` route", async () => {
  let response = await fixture.requestDocument("/post");
  expect(response.status).toBe(200);
  expect(await response.text()).toMatch("Some post content");
});

test("requests to `/post/content` route should return 404", async () => {
  let response = await fixture.requestDocument("/post/content");
  // It should be 404 because the the modules inside routes/post are not supposed be route modules
  expect(response.status).not.toBe(200);
  expect(response.status).toBe(404);
  expect(await response.text()).not.toMatch("unexpected content");
});

test("requests to `/post/heading` route should return 404", async () => {
  let response = await fixture.requestDocument("/post/heading");
  
  // It should be 404 because the the modules inside routes/post are not supposed be route modules
  expect(response.status).toBe(404);
  expect(response.status).not.toBe(500);
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
