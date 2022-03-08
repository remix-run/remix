import * as React from "react";
import type { LoaderFunction } from "remix";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useFetcher,
} from "remix";
import { gdprConsent } from "./cookies";

export const loader: LoaderFunction = async ({ request }) => {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await gdprConsent.parse(cookieHeader)) || {};
  return json({ track: cookie.gdprConsent });
};

export default function App() {
  const { track } = useLoaderData();
  const analyticsFetcher = useFetcher();
  React.useEffect(() => {
    if (track) {
      const script = document.createElement("script");
      script.src = "/dummy-analytics-script.js";
      document.body.append(script);
    }
  }, [track]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        {!track && (
          <div
            style={{
              backgroundColor: "#ccc",
              padding: 10,
              position: "fixed",
              bottom: 0,
            }}
          >
            <analyticsFetcher.Form method="post" action="/enable-analytics">
              We use Cookies...
              <button name="accept-gdpr" value="true" type="submit">
                Accept
              </button>
            </analyticsFetcher.Form>
          </div>
        )}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
