import type { LoaderFunction, MetaFunction } from "remix";
import { json, useCatch, useLoaderData, useParams } from "remix";
import type { User as UserType } from "~/data.server";
import { getUsers } from "~/data.server";

interface LoaderData {
  user: UserType;
}

export const meta: MetaFunction = ({ data }: { data: LoaderData | null }) => {
  // When the response is thrown for a missing user, the data will be the
  // thrown response.
  if (!data || !data.user) {
    return { title: "User not found!" };
  }
  return { title: data.user.name };
};

export const loader: LoaderFunction = async ({ params }) => {
  const userId = params.userId;

  const users = getUsers();
  const user = users.find(({ id }) => id === userId);

  if (!user) {
    // When there's an expected error (like no found user) throw a response.
    throw new Response("Not Found", { status: 404 });
  }

  return json<LoaderData>({ user });
};

export default function User() {
  const { user } = useLoaderData<LoaderData>();
  return <div>Hi there {user.name}!</div>;
}

// Export a CatchBoundary and use the useCatch hook to handle thrown responses
// like the 404 we have in our loader.
// You can also catch thrown responses from actions as well.
export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();

  switch (caught.status) {
    case 404: {
      return <h2>User with ID "{params.userId}" not found!</h2>;
    }
    default: {
      // if we don't handle this then all bets are off. Just throw an error
      // and let the nearest ErrorBoundary handle this
      throw new Error(`${caught.status} not handled`);
    }
  }
}

// this will handle unexpected errors (like the default case above where the
// CatchBoundary gets a response it's not prepared to handle).
export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return (
    <div>
      <pre>{JSON.stringify(error, null, 2)}</pre>
    </div>
  );
}
