// import "../app.css";
import React, { Suspense } from "react";
import { Meta, Scripts, Styles, Routes, Link } from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <link
          rel="stylesheet"
          href="//unpkg.com/@exampledev/new.css@1.1.3/new.css"
        />
        <Styles />
      </head>
      <body className="m-4">
        <nav>
          <div>
            <Link to="users">Users</Link>
          </div>
          <div>
            <Link to="gists">Gists</Link>
          </div>
        </nav>
        <Suspense fallback={"Loading"}>
          <Routes />
        </Suspense>
        <Scripts />
      </body>
    </html>
  );
}
