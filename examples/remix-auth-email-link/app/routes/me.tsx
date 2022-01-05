import type { LoaderFunction} from "remix";
import { Form} from "remix";
import { useLoaderData} from "remix";
import { json } from "remix"
import type { User } from "~/models/User"
import { authenticator } from "~/services/auth.server"

type LoaderData = {
  user: User
}

export const loader: LoaderFunction = async ({ request }) => {
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