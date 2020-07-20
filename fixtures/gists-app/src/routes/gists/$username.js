import React from "react";
import { useRouteData } from "remix";
import { useParams } from "react-router-dom";

export function meta({ data, params }) {
  return {
    title: `${data.length} gists from ${params.username}`,
    description: `View all of the gists from ${params.username}`
  };
}

export default function UserGists() {
  let { username } = useParams();
  let [data] = useRouteData();
  return (
    <div data-test-id="/gists/$username">
      <h2>All gists from {username}</h2>
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
