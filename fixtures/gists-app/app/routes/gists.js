import { Outlet } from "react-router-dom";
import { Link, useRouteData, usePendingLocation } from "@remix-run/react";
import { json } from "@remix-run/data";

import styles from "css:../styles/gists.css";
import Shared from "../components/Shared";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

export function loader() {
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
  let locationPending = usePendingLocation();
  let { users } = useRouteData();

  return (
    <div data-test-id="/gists">
      <header>
        <h1>Gists</h1>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              <Link to={user.id} className="text-blue-700 underline">
                {user.name} {locationPending && "..."}
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
