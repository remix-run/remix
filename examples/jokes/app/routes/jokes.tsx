import { Outlet, useLoaderData, Link, json, LoaderFunction } from "remix";
import { jokes } from "../jokes";
import { z } from "zod";

let LoaderData = z.object({
  jokeListItems: z.array(z.object({ id: z.string(), name: z.string() })),
});
type LoaderData = z.infer<typeof LoaderData>;

export let loader: LoaderFunction = () => {
  let jokeListItems = jokes
    .map((j) => ({ id: j.id, name: j.name }))
    .slice(0, 5);
  let data: LoaderData = { jokeListItems };
  return json(data);
};

export default function JokesScreen() {
  let data = LoaderData.parse(useLoaderData());

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
