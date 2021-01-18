import { Meta, Scripts, Styles, useRouteData } from "@remix-run/react";
import { Link, Outlet } from "react-router-dom";

export default function App() {
  let data = useRouteData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Styles />
      </head>
      <body>
        <Link to="/gists">Gists</Link>
        <Outlet />
        <Scripts />
        <footer>
          <p>This page was rendered at {data.date.toLocaleString()}</p>
        </footer>
      </body>
    </html>
  );
}
