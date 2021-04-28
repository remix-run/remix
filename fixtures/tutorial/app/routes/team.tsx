import { Link, Outlet } from "react-router-dom";
import type { LoaderFunction } from "remix";
import { useRouteData } from "remix";

interface Member {
  id: string;
  login: string;
}

export let loader: LoaderFunction = () => {
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
