import * as React from "react";
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  json,
} from "remix";
import type { MetaFunction } from "remix";
import { useLocation } from "react-router-dom";
import * as gtag from "~/utils/gtags.client";

export const meta: MetaFunction = () => {
  return { title: "New Remix App" };
};

/**
 * @description
 * If you would like to include the development env values in your browser bundle AKA 
 * set some global values on the window object, take a look at these docs here:
 * https://remix.run/docs/en/v1/guides/envvars#server-environment-variables
 */
// export async function loader() {
//   return json({
//     ENV: {
//       APP_ENV: process.env.NODE_ENV,
//     },
//   });
// }

export default function App() {
  const location = useLocation();

  React.useEffect(() => {
    gtag.pageview(location.pathname);
  }, [location]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {process.env.NODE_ENV !== 'development' ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_TRACKING_ID}`}
            />
            <script
              async
              id="gtag-init"
              dangerouslySetInnerHTML={{
                __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', '${gtag.GA_TRACKING_ID}', {
                  page_path: window.location.pathname,
                });
              `
              }}
            />
          </>
        ) : null}
        
        <header>
          <nav>
            <ul>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
              <li>
                <Link to="/profile">Profile</Link>
              </li>
            </ul>
          </nav>
        </header>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
