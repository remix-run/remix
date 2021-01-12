import { Link, Outlet } from "react-router-dom";
import { useRouteData } from "@remix-run/react";
import type { Loader } from "@remix-run/data";

interface Member {
  id: string;
  login: string;
}

export let loader: Loader = () => {
  return fetch("https://api.github.com/orgs/reacttraining/members");
};

export default function Team() {
  let data = useRouteData<Member[]>();

  return (
    <div>
      <h2>Team</h2>
      <ul>
        {data.map(member => (
          <li key={member.id}>
            <Link to={member.login}>{member.login}</Link>
          </li>
        ))}
      </ul>
      <hr />
      <Outlet />
    </div>
  );
}
