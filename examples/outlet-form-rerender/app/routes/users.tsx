import type { LoaderFunction, MetaFunction } from "remix";
import { Link, Outlet, json } from "remix";
import { useLoaderData } from "remix";
import type { User } from "~/data.server";
import { users } from "~/data.server";

interface LoaderData {
  users: User[];
}

export const meta: MetaFunction = () => {
  return { title: "Users" };
};

export const loader: LoaderFunction = async () => {
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
      </ul>
      <Outlet />
    </div>
  );
}
