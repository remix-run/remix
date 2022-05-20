import type {
  ActionFunction,
  DataFunctionArgs,
  LoaderFunction,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useCatch, useLoaderData, useParams } from "@remix-run/react";

import { client } from "~/utils/edgedb.server";
import { getUserId, requireUserId } from "~/utils/session.server";
import { JokeDisplay } from "~/components/joke";
import e from "../../../dbschema/edgeql-js";

export const meta: MetaFunction = ({
  data,
}: {
  data: LoaderData | undefined;
}) => {
  if (!data) {
    return {
      title: "No joke",
      description: "No joke found",
    };
  }
  return {
    title: `"${data.joke.name}" joke`,
    description: `Enjoy the "${data.joke.name}" joke and much more`,
  };
};

async function loadData({ request, params }: DataFunctionArgs) {
  const userId = await getUserId(request);
  const joke = await e
    .select(e.Joke, (joke) => ({
      ...e.Joke["*"],
      jokesterId: joke.jokester.id,
      filter: e.op(joke.id, "=", e.uuid(params.jokeId as string)),
    }))
    .run(client);
  if (!joke) {
    throw new Response("What a joke! Not found.", { status: 404 });
  }
  return { joke, isOwner: userId === joke.jokesterId };
}

type LoaderData = Awaited<ReturnType<typeof loadData>>;

export const loader: LoaderFunction = async (args) => {
  const data = await loadData(args);
  return json(data);
};

export const action: ActionFunction = async ({ request, params }) => {
  const form = await request.formData();
  if (form.get("_method") !== "delete") {
    throw new Response(`The _method ${form.get("_method")} is not supported`, {
      status: 400,
    });
  }
  const userId = await requireUserId(request);
  const jokeQuery = e.select(e.Joke, (joke) => ({
    ...e.Joke["*"],
    jokesterId: joke.jokester.id,
    filter: e.op(joke.id, "=", e.uuid(String(params.jokeId))),
  }));
  const joke = await jokeQuery.run(client);

  if (!joke) {
    throw new Response("Can't delete what does not exist", { status: 404 });
  }
  if (joke.jokesterId !== userId) {
    throw new Response("Pssh, nice try. That's not your joke", {
      status: 401,
    });
  }
  // reuse jokeQuery. composition!
  await e.delete(jokeQuery);
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<LoaderData>();

  return <JokeDisplay joke={data.joke} isOwner={data.isOwner} />;
}

export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();
  switch (caught.status) {
    case 400: {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    case 404: {
      return (
        <div className="error-container">
          Huh? What the heck is {params.jokeId}?
        </div>
      );
    }
    case 401: {
      return (
        <div className="error-container">
          Sorry, but {params.jokeId} is not your joke.
        </div>
      );
    }
    default: {
      throw new Error(`Unhandled error: ${caught.status}`);
    }
  }
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  const { jokeId } = useParams();
  return (
    <div className="error-container">
      There was an error loading joke by the id {jokeId}. Sorry.
    </div>
  );
}
