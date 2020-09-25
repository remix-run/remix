import React from "react";
import { useRouteData } from "@remix-run/react";

export function meta() {
  return {
    title: "Public Gists",
    description: "View the latest gists from the public"
  };
}

export default function GistsIndex() {
  let [data] = useRouteData();

  return (
    <div data-test-id="/gists/index">
      <h2>Public Gists</h2>
      <ul>
        {data.map(gist => (
          <li key={gist.id}>
            <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
