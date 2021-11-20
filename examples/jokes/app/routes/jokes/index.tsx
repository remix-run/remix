import { useLoaderData, Link, json } from "remix";
import type { Joke } from "@prisma/client";

import { db } from "~/utils/db.server";

type LoaderData = { randomJoke: Joke };

export let loader = async () => {
  const count = await db.joke.count();
  const randomRowNumber = Math.floor(Math.random() * count);
  let [randomJoke] = await db.joke.findMany({ take: 1, skip: randomRowNumber });
  let data: LoaderData = { randomJoke };
  return json(data);
};

export default function JokesDefaultScreen() {
  let data = useLoaderData<LoaderData>();

  if (data.randomJoke) {
    return (
      <div>
        <p>Here's a random joke:</p>
        <p>{data.randomJoke.content}</p>
        <Link to={data.randomJoke.id}>"{data.randomJoke.name}" Permalink</Link>
      </div>
    );
  }

  return (
    <div>
      <p>There are no jokes to display.</p>
      <Link to="new">Add your own</Link>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  console.error(error);
  return <div>I did a whoopsies.</div>;
}
