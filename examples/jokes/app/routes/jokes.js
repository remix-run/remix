import { Outlet, useLoaderData, Link, json } from "remix";

import { prisma } from "~/utils/prisma.server";

export let loader = () => {
  let jokeListItems = prisma.jokes.findMany({
    select: {
      id: true,
      name: true,
    },
    take: 5,
  });
  return json({ jokeListItems });
};

export default function JokesScreen() {
  let data = useLoaderData();

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
