import {
  json,
  useLoaderData,
  useCatch,
  Link,
  Form,
  redirect,
  LoaderFunction,
  ActionFunction,
} from "remix";
import { useParams } from "react-router-dom";
import { Joke, jokes } from "../../jokes";
import { z } from "zod";

let LoaderData = z.object({ joke: Joke });
type LoaderData = z.infer<typeof LoaderData>;

export let loader: LoaderFunction = ({ params }) => {
  const { jokeId } = z.object({ jokeId: z.string() }).parse(params);
  let joke = jokes.find((j) => j.id === jokeId);
  if (!joke) {
    throw new Response("", { status: 404 });
  }
  let data: LoaderData = { joke };
  return json(data);
};

export let action: ActionFunction = ({ request, params }) => {
  if (request.method === "DELETE") {
    jokes.splice(
      jokes.findIndex((j) => j.id === params.jokeId),
      1
    );
    return redirect("/jokes");
  }
};

export default function JokeScreen() {
  let data = LoaderData.parse(useLoaderData());
  return (
    <div>
      <p>Here's your hilarious joke</p>
      <p>{data.joke.content}</p>
      <Link to=".">{data.joke.name}</Link>
      <Form method="delete">
        <button type="submit">Delete</button>
      </Form>
    </div>
  );
}

export function CatchBoundary() {
  let caught = useCatch();
  let params = useParams();
  if (caught.status === 404) {
    return <div>Huh? What the heck is {params.jokeId}?</div>;
  }
  throw new Error(`Unhandled error: ${caught.status}`);
}
