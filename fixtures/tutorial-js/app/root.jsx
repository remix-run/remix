import { Outlet } from "react-router-dom";
import { Meta, Scripts, Links, useLoaderData, LiveReload } from "remix";

import styles from "~/styles/global.css";

export let loader = async () => {
  return { date: new Date() };
};

export let links = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export default function App() {
  let data = useLoaderData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <footer>
          <p>This page was rendered at {data.date.toLocaleString()}</p>
        </footer>
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
