import { json, Link, Outlet, useLoaderData, useTransition } from "remix";

import Shared from "~/components/Shared";
import stylesHref from "~/styles/gists.css";

export function links() {
  return [{ rel: "stylesheet", href: stylesHref }];
}

export async function loader() {
  let data = {
    users: [
      { id: "ryanflorence", name: "Ryan Florence" },
      { id: "mjackson", name: "Michael Jackson" }
    ]
  };

  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
}

export function headers({ loaderHeaders }) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}

export let handle = {
  breadcrumb: () => <Link to="/gists">Gists</Link>
};

export default function Gists() {
  let locationPending = useTransition().location;
  let { users } = useLoaderData();

  return (
    <div data-test-id="/gists">
      <header>
        <h1>Gists</h1>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              <Link
                // prefetch="intent"
                to={user.id}
                className="text-blue-700 underline"
              >
                {user.name} {locationPending ? "..." : null}
              </Link>
            </li>
          ))}
        </ul>
      </header>
      <Outlet />
      <Shared />
    </div>
  );
}
