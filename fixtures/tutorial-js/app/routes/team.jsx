import { Outlet } from "react-router-dom";
import { useLoaderData, Link } from "remix";

import { Shared } from "~/shared";

export let loader = () => {
  return fetch("https://api.github.com/orgs/reacttraining/members");
};

export default function Team() {
  let data = useLoaderData();

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
      <Shared />
    </div>
  );
}
