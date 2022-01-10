import type { LoaderFunction} from "remix";
import { json, useLoaderData, Form } from "remix"
import type { User } from "~/data.server";
import { authenticator } from "~/services/auth.server"

type LoaderData = {
  user: User
}

export const loader: LoaderFunction = async ({ request }) => {
  // This is a protected route.
  // If the user is not logged in, redirect to /login to login first.
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  })
  return json<LoaderData>({ user })
}

export default function Me(): JSX.Element {
  const { user } = useLoaderData<LoaderData>()
  return (
    <>
      <p>You are logged in as {user.email}</p>
      <Form method="post" action="/logout">
          <button type="submit">Logout</button>
      </Form>
    </>
  )
}