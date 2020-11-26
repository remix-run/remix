import { useEffect } from "react";
import { Meta, Scripts, Styles, Routes, useGlobalData } from "@remix-run/react";

export default function App() {
  let data = useGlobalData();

  useEffect(() => {
    // We use this in the tests to wait for React to hydrate the page.
    window.reactIsHydrated = true;
  });

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
        <div data-test-id="content">
          <Routes />
        </div>
        {data.enableScripts && <Scripts />}
      </body>
    </html>
  );
}
