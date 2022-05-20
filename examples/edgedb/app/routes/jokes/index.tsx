import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useCatch, useLoaderData } from "@remix-run/react";

import { client } from "~/utils/edgedb.server";
import { getUserId } from "~/utils/session.server";
import e from "../../../dbschema/edgeql-js";

async function getRandomJoke(userId: string) {
  return (
    await e
      .select(e.Joke, (joke) => ({
        ...e.Joke["*"],
        order_by: e.random(),
        limit: 1,
        filter: e.op(joke.jokester.id, "=", e.uuid(userId)),
      }))
      .run(client)
  )[0];
}

type Joke = Awaited<ReturnType<typeof getRandomJoke>>;
type LoaderData = { randomJoke: Joke };

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);

  // in the official deployed version of the app, we don't want to deploy
  // a site with unmoderated content, so we only show users their own jokes
  const randomJoke = userId ? await getRandomJoke(userId) : null;
  if (!randomJoke) {
    throw new Response("No jokes to be found!", { status: 404 });
  }
  const data = { randomJoke };
  return json(data);
};

export default function JokesIndexRoute() {
  const data = useLoaderData<LoaderData>();

  return (
    <div>
      <p>Here's a random joke:</p>
      <p>{data.randomJoke.content}</p>
      <Link to={data.randomJoke.id}>"{data.randomJoke.name}" Permalink</Link>
    </div>
  );
}

export function CatchBoundary() {
  const caught = useCatch();

  if (caught.status === 404) {
    return (
      <div className="error-container">
        <p>
          There are no jokes to display.
          <br />
          <small>
            Note: this is the deployed version of the jokes app example and
            because we don't want to show you unmoderated content, we only
            display jokes you create in this version.
          </small>
        </p>
        <Link to="new">Add your own</Link>
      </div>
    );
  }
  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return <div>I did a whoopsies.</div>;
}
