import type { ActionFunction } from "remix";
import { Form, json, useCatch, useActionData } from "remix";
import * as t from "io-ts";

import { decodeFormData } from "../formData";

/**
 * A runtime representation of the `User`-type
 * https://gcanti.github.io/io-ts/modules/index.ts.html#type
 */
const User = t.type({
  name: t.string,
  age: t.number
});

type ActionData = {
  // The actual `User`-type
  // https://gcanti.github.io/io-ts/modules/index.ts.html#typeof-type-alias
  user: t.TypeOf<typeof User>;
};

export const action: ActionFunction = async ({ request }) => {
  // Using `FormData` with TypeScript can be a little inconvinient:
  //
  //     const formData = await request.formData();
  //     const name = formData.get("name");
  //     const age = formData.get("age");
  //
  // Here, both `name` and `age` are of type `FormDataEntryValue | null`. That
  // type is annoying when working with something like Prisma:
  //
  //     const user = await prisma.user.create({
  //       data: {
  //         name, // type error
  //         age,  // type error
  //       },
  //     });
  //
  // The resulting type errors could be sidestepped with type assertions:
  //
  //     const name = formData.get("name") as string;
  //     const age = formData.get("age") as number;
  //
  // However, this could lead to subtle bugs. The form data is provided by the
  // user, which means that it could have any shape. What if `age` actually
  // isn't a `number` at runtime?
  //
  // "Reminder: Because type assertions are removed at compile-time, there is no
  // runtime checking associated with a type assertion. There won’t be an
  // exception or null generated if the type assertion is wrong."
  // https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions
  //
  // With `decodeFormData`, `user.name` is of type `string` and `user.age` is of
  // type `number`. If, at runtime, it turns out that this is not the case,
  // `decodeFormData` will throw a "422: Unprocessable Entity" Response, which
  // will be caught by the `CatchBoundary` below.
  const user = await decodeFormData(request, User);

  // From this point on, `name` and `age` can be used safely:
  return json({ user }, { status: 200 });
};

const NewUserForm = () => (
  <section>
    <h1>New User</h1>
    <Form method="post">
      <label>
        Name
        <input name="name" />
      </label>
      <label>
        Age
        {/* This is not an `<input type="number" />`, just because it makes it
            easy to enforce errors */}
        <input name="age" />
      </label>
      <button type="submit">Create New User</button>
    </Form>
  </section>
);

export default function App() {
  const data = useActionData<ActionData>();
  const user = data?.user;

  return (
    <div>
      <NewUserForm />
      {user && (
        <section>
          <h1>Success</h1>
          <div>
            <span>User </span>
            <b>
              {user.name}, age {user.age}
            </b>
            <span> created successfully</span>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Will be rendered if the submitted form data is malformed.
 */
export const CatchBoundary = () => {
  const caught = useCatch();

  return (
    <div>
      <NewUserForm />
      <section>
        <h1>Caught</h1>
        <p>Status: {caught.status}</p>
        <pre>
          <code>{JSON.stringify(JSON.parse(caught.data), null, 2)}</code>
        </pre>
      </section>
    </div>
  );
};
