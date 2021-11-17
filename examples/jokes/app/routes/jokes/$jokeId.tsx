import type { LoaderFunction, ActionFunction } from "remix";
import { json, useLoaderData, useCatch, Link, Form, redirect } from "remix";
import { useParams } from "react-router-dom";
import type { Joke } from "@prisma/client";
import { db } from "~/utils/db.server";

type LoaderData = { joke: Joke };

export let loader: LoaderFunction = async ({ params }) => {
  let joke = await db.joke.findUnique({ where: { id: params.jokeId } });
  if (!joke) {
    throw new Response("What a joke! Not found.", { status: 404 });
  }
  let data: LoaderData = { joke };
  return json(data);
};

export let action: ActionFunction = async ({ request, params }) => {
  if (request.method === "DELETE") {
    await db.joke.delete({ where: { id: params.jokeId } });
    return redirect("/jokes");
  }
};

export default function JokeScreen() {
  let data = useLoaderData<LoaderData>();

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
