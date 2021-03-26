import { Link, Outlet } from "react-router-dom";
import type { LoaderFunction, LinksFunction } from "@remix-run/node";
import { Meta, Scripts, Links, useRouteData } from "@remix-run/react";

import styles from "./styles/global.css";

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
        <ul>
          <li>
            <Link to="/gists">Public Gists</Link>
          </li>
          <li>
            <Link to="/beef/and/cheese">Beef and cheese</Link>
          </li>
          <li>
            <Link to="/beef/and/cheddar">Beef and cheddar</Link>
          </li>
          <li>
            <Link to="/portugeuse/sausage">Portugeuse Sausage</Link>
          </li>
        </ul>
        <Outlet />
        <footer>
          <p>This page was rendered at {data.date.toLocaleString()}</p>
        </footer>
        <Scripts />
      </body>
    </html>
  );
}
