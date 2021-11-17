import * as React from "react";

import type { ActionFunction } from "remix";
import { useActionData, Form, redirect } from "remix";
import { db } from "~/utils/db.server";
import type { Joke } from "@prisma/client";
import { getUser } from "~/utils/session.server";

function validateJokeContent(content: unknown) {
  if (typeof content !== "string" || content.length < 4) {
    return `That joke is too short`;
  }
}

function validateJokeName(name: unknown) {
  if (typeof name !== "string" || name.length < 2) {
    return `That joke's name is too short`;
  }
}

type JokeData = Pick<Joke, "content" | "name" | "jokesterId">;

export let action: ActionFunction = async ({ request }) => {
  const user = await getUser(request);
  if (!user) return redirect("/login");

  let { name, content } = Object.fromEntries(await request.formData());

  let errors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  let jokeData = { name, content, jokesterId: user.id } as JokeData;
  if (Object.values(errors).some(Boolean)) return { errors, joke: jokeData };

  let joke = await db.joke.create({ data: jokeData });
  return redirect(`/jokes/${joke.id}`);
};

export default function JokeScreen() {
  let actionData = useActionData();
  let [formValues, setFormValues] = React.useState(
    actionData?.joke ?? {
      name: "",
      content: "",
    }
  );
  let nameError = validateJokeName(formValues.name);
  let contentError = validateJokeContent(formValues.content);
  return (
    <div>
      <p>Add your own hilarious joke</p>
      <Form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={formValues.name}
              name="name"
              onChange={(e) =>
                setFormValues({ ...formValues, name: e.currentTarget.value })
              }
            />
          </label>
          {nameError ? <div role="alert">{nameError}</div> : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={formValues.content}
              name="content"
              onChange={(e) =>
                setFormValues({ ...formValues, content: e.currentTarget.value })
              }
            />
          </label>
          {contentError ? <div role="alert">{contentError}</div> : null}
        </div>
        <button type="submit">Add</button>
      </Form>
    </div>
  );
}
