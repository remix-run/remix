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
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/csrf.tsx": js`
        import { createContext, ReactNode, useContext } from "react";

        export interface AuthenticityTokenProviderProps {
          children: ReactNode;
          token: string;
        }
        
        export interface AuthenticityTokenInputProps {
          name?: string;
        }
        
        let context = createContext<string | null>(null);
        
        /**
         * Save the Authenticity Token into context
         */
        export function AuthenticityTokenProvider({
          children,
          token,
        }: AuthenticityTokenProviderProps) {
          return <context.Provider value={token}>{children}</context.Provider>;
        }
        
        /**
         * Get the authenticity token, this should be used to send it in a submit.
         * @example
         * let token = useAuthenticityToken();
         * let submit = useSubmit();
         * function sendFormWithCode() {
         *   submit(
         *     { csrf: token, ...otherData },
         *     { action: "/action", method: "post" },
         *   );
         * }
         */
        export function useAuthenticityToken() {
          let token = useContext(context);
          if (!token) throw new Error("Missing AuthenticityTokenProvider.");
          return token;
        }
        
        /**
         * Render a hidden input with the name csrf and the authenticity token as value.
         */
        export function AuthenticityTokenInput({
          name = "csrf",
        }: AuthenticityTokenInputProps) {
          let token = useAuthenticityToken();
          return <input type="hidden" value={token} name={name} />;
        }      
      `,

      "app/sessions.ts": js`
        import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

        const { getSession, commitSession, destroySession } =
          createCookieSessionStorage({
            // a Cookie from createCookie or the CookieOptions to create one
            cookie: {
              name: "__session",

              httpOnly: true,
              maxAge: 60,
              path: "/",
              sameSite: "lax",
              secrets: ["s3cret1"],
              secure: true,
            },
          });

        export { getSession, commitSession, destroySession };
      `,

      "app/root.tsx": js`
        import type { MetaFunction, LoaderFunction } from "@remix-run/node";
        import {
          Links,
          LiveReload,
          Meta,
          Outlet,
          Scripts,
          ScrollRestoration,
          useLoaderData,
        } from "@remix-run/react";
        import { AuthenticityTokenProvider } from "./csrf";
        import { json } from "@remix-run/node";
        import * as crypto from "crypto";
        import { getSession, commitSession } from "./sessions";
        
        export const meta: MetaFunction = () => ({
          charset: "utf-8",
          title: "New Remix App",
          viewport: "width=device-width,initial-scale=1",
        });
        
        export const loader: LoaderFunction = async ({ request }) => {
          const session = await getSession(request.headers.get("Cookie"));
        
          const token = crypto.randomBytes(16).toString("base64");
          session.set("csrf", token);
        
          return json(
            { csrf: token },
            { headers: { "Set-Cookie": await commitSession(session) } }
          );
        };
        
        export default function App() {
          const data = useLoaderData();
        
          return (
            <AuthenticityTokenProvider token={data.csrf}>
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <ScrollRestoration />
                  <Scripts />
                  <LiveReload />
                </body>
              </html>
            </AuthenticityTokenProvider>
          );
        }
      `,

      "app/routes/index.tsx": js`
        import type { ActionFunction, LoaderFunction } from "@remix-run/node";
        import { json, redirect } from "@remix-run/node";
        import { Form, useLoaderData } from "@remix-run/react";
        import { getSession, commitSession } from "../sessions";
        import { AuthenticityTokenInput } from "../csrf";

        export const loader: LoaderFunction = async ({ request }) => {
          const session = await getSession(request.headers.get("Cookie"));

          const message = session.get("globalMessage") || null;

          return json(
            { message },
            {
              headers: {
                "Set-Cookie": await commitSession(session),
              },
            }
          );
        };

        export const action: ActionFunction = async ({ request }) => {
          const session = await getSession(request.headers.get("Cookie"));

          if (request instanceof Request && request.bodyUsed) {
            throw new Error(
              "The body of the request was read before calling verifyAuthenticityToken. Ensure you clone it before reading it."
            );
          }
          // We clone the request to ensure we don't modify the original request.
          // This allow us to parse the body of the request and let the original request
          // still be used and parsed without errors.
          let formData =
            request instanceof FormData ? request : await request.clone().formData();

          // if the session doesn't have a csrf token, throw an error
          if (!session.has("csrf")) {
            throw new Error("CSRF token not found in session");
          }

          console.log("session.get(csrf)", session.get("csrf"));

          // if the body doesn't have a csrf token, throw an error
          if (!formData.get("csrf")) {
            throw new Error("Can't find CSRF token in body.");
          }

          console.log("formData.get(csrf)", formData.get("csrf"));

          // if the body csrf token doesn't match the session csrf token, throw an
          // error
          if (formData.get("csrf") !== session.get("csrf")) {
            throw new Error("Can't verify CSRF token authenticity.");
          }

          session.flash("globalMessage", "hello");

          return redirect("/", {
            headers: {
              "Set-Cookie": await commitSession(session),
            },
          });
        };

        export default function Index() {
          const { message } = useLoaderData();

          return (
            <>
              {message ? <strong>{message}</strong> : null}
              <Form method="post">
                <AuthenticityTokenInput />
                <button type="submit">Submit</button>
              </Form>
            </>
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

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect Remix to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("[submit form]", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);

  // If you need to test interactivity use the `app`
  await app.goto("/");
  await app.clickSubmitButton("/?index");

  // First click will be successful
  expect(await app.getHtml()).toMatch("hello");

  // Second click will fail
  await app.clickSubmitButton("/?index");
  expect(await app.getHtml()).toMatch("hello");

  // If you're not sure what's going on, you can "poke" the app, it'll
  // automatically open up in your browser for 20 seconds, so be quick!
  // await app.poke(20);

  // Go check out the other tests to see what else you can do.
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of Remix and open a pull request!
////////////////////////////////////////////////////////////////////////////////
