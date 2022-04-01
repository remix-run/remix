import { collectResponses, collectDataResponses } from "./helpers/utils";
import {
  css,
  js,
  createFixture,
  createAppFixture,
} from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

const fakeGists = [
  {
    url: "https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9",
    id: "610613b54e5b34f8122d1ba4a3da21a9",
    files: {
      "remix-server.jsx": {
        filename: "remix-server.jsx",
      },
    },
    owner: {
      login: "ryanflorence",
      id: 100200,
      avatar_url: "https://avatars0.githubusercontent.com/u/100200?v=4",
    },
  },
];

describe("route module link export", () => {
  let fixture: Fixture;
  let app: AppFixture;
  beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/favicon.ico": js``,

        "app/guitar.jpg": js``,

        "app/reset.css": css`
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html {
            font-size: 16px;
            box-sizing: border-box;
          }
        `,

        "app/app.css": css`
          body {
            background-color: #eee;
            color: #000;
          }
        `,

        "app/gists.css": css`
          * {
            color: dodgerblue;
          }
        `,

        "app/redText.css": css`
          * {
            color: red;
          }
        `,

        "app/blueText.css": css`
          * {
            color: blue;
          }
        `,

        "app/root.jsx": js`
          import { useEffect } from "react";
          import {
            Link,
            Links,
            Meta,
            Outlet,
            Scripts,
            useCatch,
          } from "remix";
          import resetHref from "./reset.css";
          import stylesHref from "./app.css";
          import favicon from "./favicon.ico";

          export function links() {
            return [
              { rel: "stylesheet", href: resetHref },
              { rel: "stylesheet", href: stylesHref },
              { rel: "stylesheet", href: "/resources/theme-css" },
              { rel: "shortcut icon", href: favicon },
            ];
          }

          export let handle = {
            breadcrumb: () => <Link to="/">Home</Link>,
          };

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <meta charSet="utf-8" />
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }

          export function CatchBoundary() {
            let caught = useCatch();

            switch (caught.status) {
              case 404:
                return (
                  <html lang="en">
                    <head>
                      <meta charSet="utf-8" />
                      <title>404 Not Found</title>
                      <Links />
                    </head>
                    <body>
                      <div>
                        <h1>404 Not Found</h1>
                      </div>
                      <Scripts />
                    </body>
                  </html>
                );
              default:
                console.warn("Unexpected catch", caught);

                return (
                  <html lang="en">
                    <head>
                      <meta charSet="utf-8" />
                      <title>{caught.status} Uh-oh!</title>
                      <Links />
                    </head>
                    <body>
                      <div>
                        <h1>
                          {caught.status} {caught.statusText}
                        </h1>
                        {caught.data ? (
                          <pre>
                            <code>{JSON.stringify(caught.data, null, 2)}</code>
                          </pre>
                        ) : null}
                      </div>
                      <Scripts />
                    </body>
                  </html>
                );
            }
          }

          export function ErrorBoundary({ error }) {
            console.error(error);
            return (
              <html lang="en">
                <head>
                  <meta charSet="utf-8" />
                  <title>Oops!</title>
                  <Links />
                </head>
                <body>
                  <div>
                    <h1>App Error Boundary</h1>
                    <pre>{error.message}</pre>
                  </div>
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/index.jsx": js`
          import { useEffect } from "react";
          import { Link } from "remix";

          export default function Index() {
            return (
              <div data-test-id="/">
                <header>
                  <h1>Cool App</h1>
                </header>
                <nav>
                  <ul>
                    <li>
                      <Link to="/gists">View Some gists</Link>
                    </li>
                    <li>
                      <Link to="/gists/mjackson">View Michael's gists</Link>
                    </li>
                    <li>
                      <Link to="/gists/mjijackson">Loader Redirect</Link>
                    </li>
                    <li>
                      <Link to="/resources">Resource routes</Link>
                    </li>
                  </ul>
                </nav>
              </div>
            );
          }
        `,

        //     "app/routes/links.jsx": js`
        //       import type { LinksFunction, LoaderFunction } from "remix";
        //       import { useLoaderData, Link } from "remix";

        //       import redTextHref from "~/redText.css";
        //       import blueTextHref from "~/blueText.css";
        //       import guitar from "~/guitar.jpg";

        //       export async function loader() {
        //         return [
        //           { name: "Michael Jackson", id: "mjackson" },
        //           { name: "Ryan Florence", id: "ryanflorence" },
        //         ];
        //       }

        //       export function links()  {
        //         // this blocks on transitions automatically
        //         let styleLink = { rel: "stylesheet", href: redTextHref };
        //         let nonMatching = {
        //           rel: "stylesheet",
        //           href: blueTextHref,
        //           media: "(prefers-color-scheme: beef)",
        //         };

        //         let fails = { rel: "stylesheet", href: "/fails.css" };

        //         // preload another page
        //         let pageLink = { page: \`/gists/mjackson\` };

        //         let preloadGuitar = { rel: "preload", as: "image", href: guitar };

        //         return [styleLink, nonMatching, fails, pageLink, preloadGuitar];
        //       }

        //       export default function LinksPage() {
        //         let users = useLoaderData();
        //         return (
        //           <div data-test-id="/links">
        //             <h2>Links Page</h2>
        //             {users.map((user) => (
        //               <li key={user.id}>
        //                 <Link to={\`/gists/$\{user.id\}\`} prefetch="none">
        //                   {user.name}
        //                 </Link>
        //               </li>
        //             ))}

        //             <hr />
        //             <p>
        //               <img alt="a guitar" src={guitar} data-test-id="blocked" /> Prefetched
        //               because it's a preload.
        //             </p>
        //           </div>
        //         );
        //       }
        //     `,

        "app/routes/gists.jsx": js`
              import { json, Link, Outlet, useLoaderData, useTransition } from "remix";

              import stylesHref from "~/gists.css";

              export function links() {
                return [{ rel: "stylesheet", href: stylesHref }];
              }

              export async function loader() {
                let data = {
                  users: [
                    { id: "ryanflorence", name: "Ryan Florence" },
                    { id: "mjackson", name: "Michael Jackson" },
                  ],
                };

                return json(data, {
                  headers: {
                    "Cache-Control": "public, max-age=60",
                  },
                });
              }

              export function headers({ loaderHeaders }) {
                return {
                  "Cache-Control": loaderHeaders.get("Cache-Control"),
                };
              }

              export let handle = {
                breadcrumb: () => <Link to="/gists">Gists</Link>,
              };

              export default function Gists() {
                let locationPending = useTransition().location;
                let { users } = useLoaderData();

                return (
                  <div data-test-id="/gists">
                    <header>
                      <h1>Gists</h1>
                      <ul>
                        {users.map((user) => (
                          <li key={user.id}>
                            <Link to={user.id}>
                              {user.name} {locationPending ? "..." : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </header>
                    <Outlet />
                  </div>
                );
              }

            `,

        //     "app/routes/gists/$username.jsx": js`
        //       import { Link, json, redirect, useLoaderData, useParams } from "remix";

        //       export async function loader({ params }) {
        //         let { username } = params;

        //         if (username === "mjijackson") {
        //           return redirect("/gists/mjackson", 302);
        //         }

        //         if (username === "_why") {
        //           return json(null, { status: 404 });
        //         }

        //         return ${JSON.stringify(fakeGists)};
        //       }

        //       export function headers() {
        //         return {
        //           "Cache-Control": "public, max-age=300",
        //         };
        //       }

        //       export function meta({ data, params }) {
        //         let { username } = params;
        //         return {
        //           title: data
        //             ? \`$\{data.length\} gists from $\{username\}\`
        //             : \`User $\{username\} not found\`,
        //           description: \`View all of the gists from $\{username\}\`,
        //         };
        //       }

        //       export let handle = {
        //         breadcrumb: ({ params }) => (
        //           <Link to={\`gists/$\{params.username\}\`}>{params.username}</Link>
        //         ),
        //       };

        //       export default function UserGists() {
        //         let { username } = useParams();
        //         let data = useLoaderData();

        //         return (
        //           <div data-test-id="/gists/$username">
        //             {data ? (
        //               <>
        //                 <h2>All gists from {username}</h2>
        //                 <ul>
        //                   {data.map((gist) => (
        //                     <li key={gist.id}>
        //                       <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
        //                     </li>
        //                   ))}
        //                 </ul>
        //               </>
        //             ) : (
        //               <h2>No gists for {username}</h2>
        //             )}
        //           </div>
        //         );
        //       }
        //     `,

        "app/routes/gists/index.jsx": js`
              import { useLoaderData } from "remix";

              export async function loader() {
                return Promise.resolve(${JSON.stringify(fakeGists)});
              }

              export function headers() {
                return {
                  "Cache-Control": "public, max-age=60",
                };
              }

              export function meta() {
                return {
                  title: "Public Gists",
                  description: "View the latest gists from the public",
                };
              }

              export let handle = {
                breadcrumb: () => <span>Public</span>,
              };

              export default function GistsIndex() {
                let data = useLoaderData();

                return (
                  <div data-test-id="/gists/index">
                    <h2>Public Gists</h2>
                    <ul>
                      {data.map((gist) => (
                        <li key={gist.id} style={{ display: "flex", alignItems: "center" }}>
                          <img
                            src={gist.owner.avatar_url}
                            style={{ height: 36, margin: "0.25rem 0.5rem 0.25rem 0" }}
                            alt="avatar"
                          />
                          <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
            `,

        //     "app/routes/resources/theme-css.jsx": js`
        //       import { redirect } from "remix";
        //       import { defaultStyles, sessionStorage } from "~/themes.server";

        //       export async function action({ request }) {
        //         let formData = new URLSearchParams(await request.text());
        //         let session = await sessionStorage.getSession(request.headers.get("Cookie"));
        //         let custom = session.get("custom") || {};

        //         if (formData.get("event") === "reset") {
        //           return redirect("/resources/settings", {
        //             headers: {
        //               "Set-Cookie": await sessionStorage.destroySession(session),
        //             },
        //           });
        //         }

        //         for (let [key, value] of formData) {
        //           if (key in defaultStyles) {
        //             custom[key] = value || defaultStyles[key];
        //           }
        //         }

        //         session.set("custom", custom);

        //         return redirect("/resources/settings", {
        //           headers: {
        //             "Set-Cookie": await sessionStorage.commitSession(session),
        //           },
        //         });
        //       };

        //       export async function loader({ request }) {
        //         let session = await sessionStorage.getSession(request.headers.get("Cookie"));
        //         let custom = session.get("custom") || {};
        //         let entries = Object.entries(custom);

        //         return new Response(
        //           \`/* this css was generated via a loader in a remix resource route */
        //       :root {
        //         $\{entries
        //           .map(([key, value]) =>
        //             defaultStyles[key] && value ? \`$\{key\}: $\{value\};\` : false
        //           )
        //           .filter((s) => s)
        //           .join("\n  ")}
        //       }
        //         \`,
        //           {
        //             headers: {
        //               "Content-Type": "text/css; charset=UTF-8",
        //               "x-has-custom": entries.length > 0 ? "yes" : "no",
        //             },
        //           }
        //         );
        //       };
        //     `,

        //     "app/themes.server.js": js`
        //         import { createCookieSessionStorage } from "remix";

        //         export let sessionStorage = createCookieSessionStorage({
        //           cookie: {
        //             name: "theme-css",
        //             secrets: ["fjdlafjdkla"],
        //           },
        //         });

        //         export let defaultStyles = {
        //           "--nc-tx-1": "#ffffff",
        //           "--nc-tx-2": "#eeeeee",
        //           "--nc-bg-1": "#000000",
        //           "--nc-bg-2": "#111111",
        //           "--nc-bg-3": "#222222",
        //           "--nc-lk-1": "#3291FF",
        //           "--nc-lk-2": "#0070F3",
        //           "--nc-lk-tx": "#FFFFFF",
        //           "--nc-ac-1": "#7928CA",
        //           "--nc-ac-tx": "#FFFFFF",
        //         };
        //       `,
      },
    });
    app = await createAppFixture(fixture);
  });

  afterAll(async () => {
    await app.close();
  });

  it("waits for new styles to load before transitioning", async () => {
    await app.goto("/");

    let cssResponses = collectResponses(app.page, (url) =>
      url.pathname.endsWith(".css")
    );

    await app.page.click('a[href="/gists"]');
    await app.page.waitForSelector('[data-test-id="/gists/index"]');

    let stylesheetResponses = cssResponses.filter((res) => {
      // ignore prefetches
      return res.request().resourceType() === "stylesheet";
    });

    expect(stylesheetResponses.length).toEqual(1);
  });

  it.only("adds links to the document", async () => {
    await app.disableJavaScript();
    await app.goto("/links");
    let cssResponses = collectResponses(app.page, (url) =>
      url.pathname.endsWith(".css")
    );
    expect(cssResponses.length).toEqual(5);
  });

  it("preloads assets for other pages and serves from browser cache on navigation", async () => {
    await app.goto("/links", { waitUntil: "networkidle0" });

    let jsResponses = collectResponses(app.page, (url) =>
      url.pathname.endsWith(".js")
    );

    await app.page.click('a[href="/gists/ryanflorence"]');
    await app.page.waitForSelector('[data-test-id="/gists/$username"]');

    expect(jsResponses.every((res) => res.fromCache())).toBe(true);
  });

  it("preloads data for other pages and serves from browser cache on navigation", async () => {
    let dataResponses = collectDataResponses(app.page);
    await app.goto("/links", { waitUntil: "networkidle0" });

    expect(dataResponses.length).toBe(2);
    let [prefetchGists, prefetchUser] = dataResponses;
    expect(prefetchGists.request().resourceType()).toBe("other");
    expect(prefetchUser.request().resourceType()).toBe("other");

    await app.page.click('a[href="/gists/mjackson"]');
    await app.page.waitForSelector('[data-test-id="/gists/$username"]');

    expect(dataResponses.length).toBe(4);
    let [, , gists, username] = dataResponses;
    expect(gists.request().resourceType()).toBe("fetch");
    expect(gists.fromCache()).toBe(true);
    expect(username.fromCache()).toBe(true);
  });
});
