import * as React from "react";
import {
  Form,
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  json,
  useCatch
} from "remix";
import type { LinksFunction, ActionFunction } from "remix";

import globalStylesUrl from "~/styles/global.css";
import darkStylesUrl from "~/styles/dark.css";
import mediumStylesUrl from "~/styles/medium.css";

/**
 * The `links` export is a function that returns an array of objects that map to
 * the attributes for an HTML `<link>` element. These will load `<link>` tags on
 * every route in the app, but individual routes can include their own links
 * that are automatically unloaded when a user navigates away from the route.
 *
 * @see {@link [Links API](https://docs.remix.run/v0.21/api/app/#links)}
 */
export let links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: globalStylesUrl },
    {
      rel: "stylesheet",
      href: mediumStylesUrl,
      media: "screen and (min-width: 640px)"
    },
    {
      rel: "stylesheet",
      href: darkStylesUrl,
      media: "(prefers-color-scheme: dark)"
    }
  ];
};

/**
 * The root module's default export is a component that renders the current
 * route via the `<Outlet />` component. Think of this as the global layout
 * component for your app.
 */
export default function App() {
  return (
    <Document>
      <Layout>
        <Outlet />
      </Layout>
    </Document>
  );
}

function Document({
  children,
  title
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        {title ? <title>{title}</title> : null}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}

function Layout({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="remix-app">
      <header className="remix-app__header">
        <div className="container remix-app__header-content">
          <NavLink to="/" title="Remix" className="remix-app__header-home-link">
            <RemixLogo />
          </NavLink>
          <nav aria-label="Main navigation" className="remix-app__header-nav">
            <ul>
              <li>
                <NavLink to="/about">About</NavLink>
              </li>
              <li>
                <NavLink to="/oops">Oops</NavLink>
              </li>
              <li>
                <a href="https://github.com/remix-run/remix">GitHub</a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main className="remix-app__main">
        <div className="container remix-app__main-content">{children}</div>
      </main>
      <footer className="remix-app__footer">
        <div className="container remix-app__footer-content">
          <p>&copy; Remix Software</p>
        </div>
      </footer>
    </div>
  );
}

export function CatchBoundary() {
  let caught = useCatch();

  let message: React.ReactNode;
  switch (caught.status) {
    case 401:
      message = (
        <p>
          Oops! Looks like you tried to visit a page that you do not have access
          to.
        </p>
      );
      break;
    case 404:
      message = (
        <p>Oops! Looks like you tried to visit a page that does not exist.</p>
      );
      break;

    default:
      throw new Error(caught.data || caught.statusText);
  }

  return (
    <Document title={`${caught.status} ${caught.statusText}`}>
      <Layout>
        <h1>
          {caught.status}: {caught.statusText}
        </h1>
        <div style={{ maxWidth: 500 }}>
          {message}

          <hr />

          <p>
            When your server responds with an error, you'll land in a{" "}
            <code>CatchBoundary</code> (if it exists).
          </p>

          <p>
            You can export a <code>CatchBoundary</code> component in{" "}
            <strong>any route</strong>—not just the app root! This enables some
            pretty cool opportunities to handle errors more elegantly for your
            users.
          </p>
          <p>
            <a href="https://docs.remix.run/TODO">
              Check out the docs for more on handling errors in Remix.
            </a>
          </p>
        </div>
      </Layout>
    </Document>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Document title="Uh-oh!">
      <Layout>
        <div style={{ maxWidth: 500 }}>
          <h1>Well that sucks!</h1>
          <p>{error.message}</p>

          <hr />

          <p>
            When your server responds with an error that isn't caught by a{" "}
            <code>CatchBoundary</code>, you'll land in an{" "}
            <code>ErrorBoundary</code>.
          </p>

          <p>
            Just like <code>CatchBoundary</code>, you can export an{" "}
            <code>ErrorBoundary</code> component in <strong>any route</strong>
            —not just the app root! We suggest that you always include an{" "}
            <code>ErrorBoundary</code> in your app's root, but exposing them
            strategically throughout your route hierarchy can be a powerful way
            to improve the UX of your app.
          </p>

          <p>
            <a href="https://docs.remix.run/TODO">
              Check out the docs for more on handling errors in Remix.
            </a>
          </p>
        </div>
      </Layout>
    </Document>
  );
}

function RemixLogo(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      viewBox="0 0 659 165"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      aria-labelledby="remix-run-logo-title"
      role="img"
      fill="currentColor"
      {...props}
    >
      <title id="remix-run-logo-title">Remix Logo</title>
      <path d="M0 161V136H45.5416C53.1486 136 54.8003 141.638 54.8003 145V161H0Z M133.85 124.16C135.3 142.762 135.3 151.482 135.3 161H92.2283C92.2283 158.927 92.2653 157.03 92.3028 155.107C92.4195 149.128 92.5411 142.894 91.5717 130.304C90.2905 111.872 82.3473 107.776 67.7419 107.776H54.8021H0V74.24H69.7918C88.2407 74.24 97.4651 68.632 97.4651 53.784C97.4651 40.728 88.2407 32.816 69.7918 32.816H0V0H77.4788C119.245 0 140 19.712 140 51.2C140 74.752 125.395 90.112 105.665 92.672C122.32 96 132.057 105.472 133.85 124.16Z" />
      <path d="M229.43 120.576C225.59 129.536 218.422 133.376 207.158 133.376C194.614 133.376 184.374 126.72 183.35 112.64H263.478V101.12C263.478 70.1437 243.254 44.0317 205.11 44.0317C169.526 44.0317 142.902 69.8877 142.902 105.984C142.902 142.336 169.014 164.352 205.622 164.352C235.83 164.352 256.822 149.76 262.71 123.648L229.43 120.576ZM183.862 92.6717C185.398 81.9197 191.286 73.7277 204.598 73.7277C216.886 73.7277 223.542 82.4317 224.054 92.6717H183.862Z" />
      <path d="M385.256 66.5597C380.392 53.2477 369.896 44.0317 349.672 44.0317C332.52 44.0317 320.232 51.7117 314.088 64.2557V47.1037H272.616V161.28H314.088V105.216C314.088 88.0638 318.952 76.7997 332.52 76.7997C345.064 76.7997 348.136 84.9917 348.136 100.608V161.28H389.608V105.216C389.608 88.0638 394.216 76.7997 408.04 76.7997C420.584 76.7997 423.4 84.9917 423.4 100.608V161.28H464.872V89.5997C464.872 65.7917 455.656 44.0317 424.168 44.0317C404.968 44.0317 391.4 53.7597 385.256 66.5597Z" />
      <path d="M478.436 47.104V161.28H519.908V47.104H478.436ZM478.18 36.352H520.164V0H478.18V36.352Z" />
      <path d="M654.54 47.1035H611.788L592.332 74.2395L573.388 47.1035H527.564L568.78 103.168L523.98 161.28H566.732L589.516 130.304L612.3 161.28H658.124L613.068 101.376L654.54 47.1035Z" />
    </svg>
  );
}
