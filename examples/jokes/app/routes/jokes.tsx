import type { LoaderFunction } from "remix";
import { Outlet, useLoaderData, Link, json } from "remix";
import { db } from "~/utils/db.server";

type LoaderData = { jokeListItems: Array<{ id: string; name: string }> };

export let loader: LoaderFunction = async () => {
  let jokeListItems = await db.joke.findMany({
    take: 5,
    select: { id: true, name: true },
  });

  let data: LoaderData = { jokeListItems };
  return json(data);
};

export default function JokesScreen() {
  let data = useLoaderData<LoaderData>();

  return (
    <div>
      <h1>Jokes!</h1>
      <Outlet />
      <p>Here are a few more jokes to check out</p>
      <ul>
        {data.jokeListItems.map(({ id, name }) => (
          <li key={id}>
            <Link to={id}>{name}</Link>
          </li>
        ))}
      </ul>
      <Link to="new">Add your own</Link>
    </div>
  );
}
