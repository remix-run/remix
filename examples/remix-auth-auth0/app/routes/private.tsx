import type { ActionFunction, LoaderFunction } from "remix";
import { Form, json, useLoaderData } from "remix";
import type { Auth0Profile } from "remix-auth-auth0";
import { auth } from "~/utils/auth.server";

type LoaderData = { profile: Auth0Profile };

export const action: ActionFunction = async ({ request }) => {
  await auth.logout(request, { redirectTo: "/" });
};

export const loader: LoaderFunction = async ({ request }) => {
  const profile = await auth.isAuthenticated(request, {
    failureRedirect: "/"
  });

  return json<LoaderData>({ profile });
};

export default function Screen() {
  const { profile } = useLoaderData<LoaderData>();
  return (
    <>
      <Form method="post">
        <button>Log Out</button>
      </Form>

      <hr />

      <pre>
        <code>{JSON.stringify(profile, null, 2)}</code>
      </pre>
    </>
  );
}
