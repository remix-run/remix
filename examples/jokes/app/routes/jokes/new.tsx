import type { ActionFunction, LoaderFunction } from "remix";
import { Link, useCatch, useActionData, Form, redirect } from "remix";
import { db } from "~/utils/db.server";
import { getUserId, requireUserId } from "~/utils/session.server";

export let loader: LoaderFunction = async ({ request }) => {
  let userId = await getUserId(request);
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return {};
};

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return `That joke is too short`;
  }
}

function validateJokeName(name: string) {
  if (name.length < 2) {
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

export default function NewJokeRoute() {
  let actionData = useActionData<ActionData | undefined>();

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
              aria-invalid={Boolean(actionData?.fieldErrors?.name)}
              aria-describedby={
                actionData?.fieldErrors?.name ? "name-error" : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p className="form-validation-error" role="alert" id="name-error">
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(actionData?.fieldErrors?.content)}
              aria-describedby={
                actionData?.fieldErrors?.content ? "content-error" : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              role="alert"
              id="content-error"
            >
              {actionData.fieldErrors.content}
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

export function CatchBoundary() {
  let caught = useCatch();

  if (caught.status === 401) {
    return (
      <div className="error-container">
        <p>You must be logged in to create a joke.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return <div>Something unexpected went wrong. Sorry about that.</div>;
}
