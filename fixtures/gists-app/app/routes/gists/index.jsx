import { useLoaderData } from "remix";

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

export async function loader() {
  if (process.env.NODE_ENV !== "development") {
    return Promise.resolve(fakeGists);
  }

  let res = await fetch(`https://api.github.com/gists`);
  return res.json();
}

export function headers() {
  return {
    "Cache-Control": "public, max-age=60"
  };
}

export function meta() {
  return {
    title: "Public Gists",
    description: "View the latest gists from the public"
  };
}

export let handle = {
  breadcrumb: () => <span>Public</span>
};

export default function GistsIndex() {
  let data = useLoaderData();

  return (
    <div data-test-id="/gists/index">
      <h2>Public Gists</h2>
      <ul>
        {data.map(gist => (
          <li key={gist.id} style={{ display: "flex", alignItems: "center" }}>
            <img
              src={gist.owner.avatar_url}
              style={{ height: 36, margin: "0.25rem 0.5rem 0.25rem 0" }}
              alt="avatar"
            />
            <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
