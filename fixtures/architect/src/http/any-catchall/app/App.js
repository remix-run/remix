import { Meta, Scripts, Styles, Routes, useGlobalData } from "@remix-run/react";
import { Link } from "react-router-dom";

export default function App() {
  let data = useGlobalData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Styles />
      </head>
      <body>
        <ul>
          <li>
            <Link to="/gists">Gists</Link>
          </li>
          <li>
            <Link to="/form">Form</Link>
          </li>
        </ul>
        <Routes />
        <Scripts />
        <footer>
          <p>This page was rendered at {data.date.toLocaleString()}</p>
        </footer>
      </body>
    </html>
  );
}
