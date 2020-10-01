import React from "react";
import { Outlet } from "react-router-dom";
import { Link, useRouteData, useLocationPending } from "@remix-run/react";

export default function Gists() {
  let locationPending = useLocationPending();
  let [data] = useRouteData();
  let { users } = data;

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
    </div>
  );
}
