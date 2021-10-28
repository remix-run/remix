import {
  redirect,
  createCookieSessionStorage,
  json,
  Form,
  useLoaderData
} from "remix";

let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "redirectslogin",
    path: "/",
    httpOnly: true,
    sameSite: true,
    secure: process.env.NODE_ENV !== "development"
  }
});

export let action = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.flash("done", "yes");

  throw redirect("/redirects/login", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

export let loader = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return json(!!session.get("done"), {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

export default function Login() {
  let done = useLoaderData();

  return (
    <div>
      <h1>Login</h1>
      {done ? (
        <p data-testid="done">Logged In!</p>
      ) : (
        <Form method="post">
          <button type="submit">Push me to login</button>
        </Form>
      )}
    </div>
  );
}
