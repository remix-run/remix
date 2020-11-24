import { parseFormBody, redirect } from "@remix-run/data";
import type { Loader, Action } from "@remix-run/data";

let loader: Loader = () => {
  return fetch("https://api.github.com/gists");
};

let action: Action = async ({ request }) => {
  let body = await parseFormBody(request);

  let fileName = body.get("fileName") as string;
  let content = body.get("content");

  await fetch("https://api.github.com/gists", {
    method: "post",
    body: JSON.stringify({
      description: "Created from Remix Form!",
      public: true,
      files: { [fileName]: { content } }
    }),
    headers: {
      "content-type": "application/json",
      authorization: "token 7dd12d0c5824ed0b42add15b296fa2d6522e870b"
    }
  });

  return redirect("/gists");
};

export { action, loader };
