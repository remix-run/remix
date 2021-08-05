import { useParams } from "react-router-dom";
import { Link, useLoaderData, json, redirect } from "remix";

let fakeGists = [
  {
    url: "https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9",
    id: "610613b54e5b34f8122d1ba4a3da21a9",
    files: {
      "remix-server.jsx": {
        filename: "remix-server.jsx"
      }
    },
    owner: {
      login: "ryanflorence",
      id: 100200,
      avatar_url: "https://avatars0.githubusercontent.com/u/100200?v=4"
    }
  }
];

export async function loader({ params }) {
  let { username } = params;

  if (username === "mjijackson") {
    return redirect("/gists/mjackson", 302);
  }

  if (username === "_why") {
    return json(null, { status: 404 });
  }

  if (process.env.NODE_ENV === "test") {
    return fakeGists;
  }

  let response = await fetch(`https://api.github.com/users/${username}/gists`);

  return json(await response.json(), {
    headers: {
      "Cache-Control": response.headers.get("Cache-Control")
    }
  });
}

export function headers() {
  return {
    "Cache-Control": "public, max-age=300"
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

export let handle = {
  breadcrumb: ({ params }) => (
    <Link to={`gists/${params.username}`}>{params.username}</Link>
  )
};

export default function UserGists() {
  let { username } = useParams();
  let data = useLoaderData();

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
