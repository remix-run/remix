import type { ActionFunction, LoaderFunction } from "remix";
import { Link } from "remix";
import { json, useLoaderData } from "remix";
import { useActionData, Form, redirect } from "remix";
import { db } from "~/utils/db.server";
import { getUserId, requireUserId } from "~/utils/session.server";

function validateJokeContent(content: unknown) {
  if (typeof content !== "string" || content.length < 4) {
    return `That joke is too short`;
  }
}

function validateJokeName(name: unknown) {
  if (typeof name !== "string" || name.length < 2) {
    return `That joke's name is too short`;
  }
}

type ActionData = {
  formError?: string;
  fieldErrors?: { name: string | undefined; content: string | undefined };
  fields?: {
    name: string;
    content: string;
  };
};

type LoaderData = { loggedIn: boolean };

export let loader: LoaderFunction = async ({ request }) => {
  let userId = await getUserId(request);
  let data: LoaderData = { loggedIn: Boolean(userId) };
  return json(data);
};

export let action: ActionFunction = async ({
  request,
}): Promise<Response | ActionData> => {
  const userId = await requireUserId(request);

  let { name, content } = Object.fromEntries(await request.formData());
  if (typeof name !== "string" || typeof content !== "string") {
    return { formError: `Form not submitted correctly.` };
  }

  let fieldErrors = {
    name: validateJokeName(name),
    content: validateJokeContent(content),
  };
  let fields = { name, content };
  if (Object.values(fieldErrors).some(Boolean)) return { fieldErrors, fields };

  let joke = await db.joke.create({ data: { ...fields, jokesterId: userId } });
  return redirect(`/jokes/${joke.id}`);
};

export default function JokeScreen() {
  let data = useLoaderData<LoaderData>();
  let actionData = useActionData<ActionData | undefined>();

  console.log(data.loggedIn);
  if (!data.loggedIn) {
    return (
      <div>
        <p>You must be logged in to create a joke.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <Form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              type="text"
              defaultValue={actionData?.fields?.name}
              name="name"
              aria-describedby={
                actionData?.fieldErrors?.name ? "name-error" : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p className="form-validation-error" role="alert" id="name-error">
              {actionData?.fieldErrors?.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              role="alert"
              id="content-error"
            >
              {actionData?.fieldErrors?.content}
            </p>
          ) : null}
        </div>
        <button type="submit" className="button">
          Add
        </button>
      </Form>
    </div>
  );
}
