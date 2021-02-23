import { Meta, Scripts, Links, useRouteData } from "@remix-run/react";
import { Link, Outlet } from "react-router-dom";
import type { LoaderFunction, LinksFunction } from "@remix-run/data";
import styles from "url:./styles/global.css";

export let loader: LoaderFunction = async () => {
  return { date: new Date() };
};

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export default function App() {
  let data = useRouteData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
        <Link to="/gists">Gists</Link>
        <Outlet />
        <footer>
          <p>This page was rendered at {data.date.toLocaleString()}</p>
        </footer>
        <Scripts />
      </body>
    </html>
  );
}
