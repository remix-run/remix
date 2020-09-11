import React from "react";
import { renderToString } from "react-dom/server";
import Remix from "@remix/react/server";

import { Response } from "@remix-run/core";

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
  // let markup = renderToString(
  //   <Remix location={req.url} remixContext={remixContext}>
  //     <App />
  //   </Remix>
  // );
  // res.write("<!DOCTYPE html>" + markup);
  // res.end();
  let markup = renderToString(<div>hello world</div>);

  return new Response("<!DOCTYPE html>" + markup, {
    headers: {
      "Content-Type": "text/html"
    }
  });
}
