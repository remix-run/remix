import type { LoaderFunction, MetaFunction } from "remix";
import { Link, Outlet, json } from "remix";
import { useLoaderData } from "remix";
import type { User } from "~/data.server";
import { getUsers } from "~/data.server";

type LoaderData = {
  users: Array<User>;
};

export const meta: MetaFunction = () => {
  return { title: "Users" };
};

export const loader: LoaderFunction = async () => {
  const users = getUsers();
  return json<LoaderData>({ users });
};

export default function Users() {
  const { users } = useLoaderData<LoaderData>();

  return (
    <div>
      <ul>
        {users.map(({ id, name }) => (
          <Link to={id} key={id}>
            <li>{name}</li>
          </Link>
        ))}
        <Link to="ducky">
          <li>Ducky (I do not exist)</li>
        </Link>
      </ul>
      <Outlet />
    </div>
  );
}
