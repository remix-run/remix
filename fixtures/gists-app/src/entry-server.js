import React from "react";
import { renderToString } from "react-dom/server";
import { Response } from "@remix-run/core";
import Remix from "@remix-run/react/server";

import App from "./components/App";

// TODO: Gotta do something better than this, I hate it.
// I *think* maybe `/app.js` doesn't require "@remix-run/express" but
// instead *this file* requires @remix-run/express and maybe then we
// can build everything into webpack and require modules from remix
// (have to require from here because it's all webpacked!).
// export function requireModule(path) {
//   return require(`./${path}`);
// }

export default function handleRequest(req, remixContext) {
  let markup = renderToString(
    <Remix request={req} context={remixContext}>
      <App />
    </Remix>
  );

  return new Response("<!DOCTYPE html>" + markup, {
    headers: {
      "Content-Type": "text/html"
    }
  });
}
