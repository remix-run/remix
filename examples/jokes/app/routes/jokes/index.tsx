import { useLoaderData, Link, json } from "remix";
import type { Joke } from "@prisma/client";

import { db } from "~/utils/db.server";

type LoaderData = { randomJoke: Joke };

export let loader = async () => {
  // TODO: figure out if we can get a random joke via the query rather than
  // grabing them all from the db and randomly picking one
  let jokes = await db.joke.findMany();
  let randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  let data: LoaderData = { randomJoke };
  return json(data);
};

export default function JokesDefaultScreen() {
  let data = useLoaderData<LoaderData>();

  return (
    <div>
      <p>Here's a random joke:</p>
      <p>{data.randomJoke.content}</p>
      <Link to={data.randomJoke.id}>{data.randomJoke.name}</Link>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  console.error(error);
  return <div>I did a whoopsies.</div>;
}
