import { useLoaderData, Link, json } from "remix";

import { jokes } from "../../jokes";

export let loader = () => {
  let randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  let data = {
    randomJoke,
  };
  return json(data);
};
export default function JokesDefaultScreen() {
  let data = useLoaderData();
  return (
    <div>
      <p>Here's a random joke:</p>
      <p>{data.randomJoke.content}</p>
      <Link to={data.randomJoke.id}>{data.randomJoke.name}</Link>
    </div>
  );
}
export function ErrorBoundary({ error }) {
  console.error(error);
  return <div>I did a whoopsies.</div>;
}
