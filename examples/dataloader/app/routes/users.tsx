import type { LoaderFunction } from "remix";
import type { User } from "~/data.server";
import { Outlet, useLoaderData } from "remix";
import { usersById } from "~/loaders/userLoader.server";

interface LoaderData {
  users: User[];
}

export const loader: LoaderFunction = async () => {
  const users = await usersById.loadMany([
    "ef3fcb93-0623-4d10-adbf-4dd865d6688c",
    "2cbad877-2da6-422d-baa6-c6a96a9e085f"
  ]);
  return { users };
};

export default function UserNames() {
  const { users } = useLoaderData<LoaderData>();

  return (
    <article>
      <h1>Users</h1>
      <ul>
        {users.map(user => (
          <li key={user.email}>{user.name}</li>
        ))}
      </ul>
      <Outlet />
    </article>
  );
}
