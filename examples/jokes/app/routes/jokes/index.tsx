import { useLoaderData, Link, json } from "remix";
import { jokes, Joke } from "../../jokes";
import { z } from "zod";

let LoaderData = z.object({ randomJoke: Joke });
type LoaderData = z.infer<typeof LoaderData>;

export let loader = () => {
  let randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  let data: LoaderData = { randomJoke };
  return json(data);
};

export default function JokesDefaultScreen() {
  let data = LoaderData.parse(useLoaderData());

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
