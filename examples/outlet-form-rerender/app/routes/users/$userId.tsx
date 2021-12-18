import type { LoaderFunction, MetaFunction } from "remix";
import { useCatch } from "remix";
import { json, useLoaderData } from "remix";
import type { User as UserType } from "~/data.server";
import { users } from "~/data.server";

interface LoaderData {
  user: UserType;
}

export const meta: MetaFunction = ({ data }) => {
  if (!data) {
    return { title: "User not found!" };
  }
  return { title: (data as LoaderData).user.name };
};

export const loader: LoaderFunction = async ({ params }) => {
  const userId = params.userId;

  const user = users.find(({ id }) => id === userId);

  if (!user) {
    throw json(null, { status: 404 });
  }

  return { user } as LoaderData;
};
export default function User() {
  const { user } = useLoaderData<LoaderData>();

  return (
    /*
     * Since we're setting the initial value of the input through
     * defaultValue, React will initialise the input field with the
     * initial value and leave the subsequent updates uncontrolled
     *
     * To rerender the input field with the updated value on the route
     * transition, we have to inform React to unmount and remount the component
     * which resets the initial values
     *
     * https://reactjs.org/docs/uncontrolled-components.html
     * */
    <form method="post" key={user.id}>
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
    </form>
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
