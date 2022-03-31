import type { LoaderFunction} from "remix";
import { Form, redirect } from "remix";
import { destroySession, getSession } from "~/sessions";

export const action: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
};

export default function Logout() {
  return (
    <div>
      <h1>Logout</h1>
      <p>Press the button below to log out.</p>
      <Form method="post">
        <button type="submit">Logout</button>
      </Form>
    </div>
  );
}
