import type {
  LoaderFunction,
  ActionFunction,
  MetaFunction,
  HeadersFunction,
} from "remix";
import { json, useLoaderData, useCatch, Link, Form, redirect } from "remix";
import { useParams } from "react-router-dom";
import type { Joke } from "@prisma/client";
import { db } from "~/utils/db.server";
import { getUserId, requireUserId } from "~/utils/session.server";

export let meta: MetaFunction = ({ data }: { data: LoaderData }) => {
  return {
    title: `"${data.joke.name}" joke`,
    description: `Enjoy the "${data.joke.name}" joke and much more`,
  };
};

type LoaderData = { joke: Joke; isOwner: boolean };

export let loader: LoaderFunction = async ({ request, params }) => {
  let userId = await getUserId(request);
  let joke = await db.joke.findUnique({ where: { id: params.jokeId } });
  if (!joke) {
    throw new Response("What a joke! Not found.", { status: 404 });
  }
  let data: LoaderData = { joke, isOwner: userId === joke.jokesterId };
  return json(data, {
    headers: {
      "Cache-Control": `public, max-age=${60 * 5} s-maxage=${60 * 60}`,
    },
  });
};

export let headers: HeadersFunction = ({ loaderHeaders }) => {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control") ?? "",
  };
};

export let action: ActionFunction = async ({ request, params }) => {
  if (request.method === "DELETE") {
    let userId = await requireUserId(request);
    let joke = await db.joke.findUnique({ where: { id: params.jokeId } });
    if (!joke) {
      throw new Response("Can't delete what does not exist", { status: 404 });
    }
    if (joke.jokesterId !== userId) {
      throw new Response("Pssh, nice try. That's not your joke", {
        status: 401,
      });
    }
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
      {data.isOwner ? (
        <Form method="delete">
          <button type="submit" className="button">
            Delete
          </button>
        </Form>
      ) : null}
    </div>
  );
}

export function CatchBoundary() {
  let caught = useCatch();
  let params = useParams();
  switch (caught.status) {
    case 404: {
      return <div>Huh? What the heck is {params.jokeId}?</div>;
    }
    case 401: {
      return <div>Sorry, but {params.jokeId} is not your joke.</div>;
    }
    default: {
      throw new Error(`Unhandled error: ${caught.status}`);
    }
  }
}
