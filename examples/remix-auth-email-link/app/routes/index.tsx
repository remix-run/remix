import type { LoaderFunction} from "remix";
import { Form, Link, useLoaderData} from "remix";
import { json } from "remix"
import type { User } from "~/data.server";
import { authenticator } from "~/services/auth.server"

type LoaderData = {
  user: User | null
}

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request)
  return json<LoaderData>({ user })
}


export default function Home() {
  const {user} = useLoaderData<LoaderData>()

  return (
    <>
      {user ? (
        <Form method="post" action="/logout">
          <button type="submit">Logout</button>
        </Form>
      ) : (
        <Link to="/login">Login</Link>
      )}
    </>
  )
}