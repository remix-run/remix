import { useRouteData } from "@remix-run/react";
import { parseFormBody, redirect } from "@remix-run/data";
import type { Loader, Action } from "@remix-run/data";

export let loader: Loader = () => {
  return fetch("https://api.github.com/gists");
};

export let action: Action = async ({ request }) => {
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

export function meta() {
  return {
    title: "Public Gists",
    description: "View the latest gists from the public"
  };
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return {
    "cache-control": loaderHeaders.get("cache-control")
  };
}

export default function Gists() {
  let data = useRouteData();
  return (
    <div>
      <h2>Public Gists</h2>
      <ul>
        {data.map((gist: any) => (
          <li key={gist.id}>
            <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
