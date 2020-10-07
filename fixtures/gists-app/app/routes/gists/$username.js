import React from "react";
import { useRouteData } from "@remix-run/react";
import { useParams } from "react-router-dom";

export function headers() {
  return {
    "cache-control": "public, max-age=300"
  };
}

export function meta({ data, params }) {
  let { username } = params;
  return {
    title: data
      ? `${data.length} gists from ${username}`
      : `User ${username} not found`,
    description: `View all of the gists from ${username}`
  };
}

export default function UserGists() {
  let { username } = useParams();
  let [data] = useRouteData();

  return (
    <div data-test-id="/gists/$username">
      {data ? (
        <>
          <h2>All gists from {username}</h2>
          <ul>
            {data.map(gist => (
              <li key={gist.id}>
                <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <h2>No gists for {username}</h2>
      )}
    </div>
  );
}
