import type { LoaderFunction } from "remix";
import { Form, json, useLoaderData } from "remix";
import { auth, getSession } from "~/utils/auth.server";

type LoaderData = {
  error: { message: string } | null;
};

export const loader: LoaderFunction = async ({ request }) => {
  await auth.isAuthenticated(request, { successRedirect: "/private" });
  const session = await getSession(request.headers.get("Cookie"));
  const error = session.get(auth.sessionErrorKey) as LoaderData["error"];
  return json<LoaderData>({ error });
};

export default function Screen() {
  const { error } = useLoaderData<LoaderData>();

  return (
    <Form method="post" action="/auth0">
      {error && <div>{error.message}</div>}
      <button>Sign In with Auth0</button>
    </Form>
  );
}
