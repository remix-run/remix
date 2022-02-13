import type { LoaderFunction, MetaFunction } from "remix";
import { Form, json, useCatch, useLoaderData, useLocation } from "remix";
import type { User as UserType } from "~/data.server";
import { users } from "~/data.server";

interface LoaderData {
  user: UserType;
}

export const meta: MetaFunction = ({ data }: { data: LoaderData | null }) => {
  if (!data) {
    return { title: "User not found!" };
  }
  return { title: data.user.name };
};

export const loader: LoaderFunction = async ({ params }) => {
  const userId = params.userId;

  const user = users.find(({ id }) => id === userId);

  if (!user) {
    throw json(null, { status: 404 });
  }

  return json<LoaderData>({ user });
};

export default function User() {
  const { user } = useLoaderData<LoaderData>();
  const location = useLocation();

  return (
    <Form method="post" key={location.key} name="user info">
      <fieldset>
        <label>
          Name{" "}
          <input name="name" type="text" defaultValue={user.name} required />
        </label>
        <label>
          Email{" "}
          <input name="email" type="email" defaultValue={user.email} required />
        </label>
        <input name="id" type="hidden" defaultValue={user.id} />
        <button>Submit</button>
      </fieldset>
    </Form>
  );
}

export const CatchBoundary = () => {
  const caught = useCatch();

  switch (caught.status) {
    case 404:
      return <h2>User not found!</h2>;
    default:
      throw new Error(`${caught.status} not handled`);
  }
};
