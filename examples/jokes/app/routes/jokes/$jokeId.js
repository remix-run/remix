import { json, useLoaderData, useCatch, Link, Form, redirect } from "remix";
import { useParams } from "react-router-dom";

import { prisma } from "~/utils/prisma.server";

export let loader = ({ params }) => {
  let joke = await prisma.jokes.findFirst({ where: { id: params.jokeId } });

  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }

  return json({ joke });
};

export let action = ({ request, params }) => {
  if (request.method === "DELETE") {
    await prisma.jokes.delete({ where: { id: params.jokeId } });
    return redirect("/jokes");
  }
};

export default function JokeScreen() {
  let data = useLoaderData();
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
