import * as React from "react";
import { useActionData, Form, redirect } from "remix";

import { prisma } from "~/utils/prisma.server";

function validateJokeContent(content) {
  if (content?.length < 4) return `That joke is too short`;
}

function validateJokeName(name) {
  if (name?.length < 2) return `That joke's name is too short`;
}

export let action = async ({ request }) => {
  let requestText = await request.text();
  let form = new URLSearchParams(requestText);
  let joke = {
    content: form.get("content"),
    name: form.get("name"),
  };
  let errors = {
    content: validateJokeContent(joke.content),
    name: validateJokeName(joke.name),
  };
  if (Object.values(errors).some(Boolean)) {
    return {
      errors,
      joke,
    };
  }
  const { id } = await prisma.jokes.create({ data: { joke } });
  return redirect(`/jokes/${id}`);
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
      <Form
        method="post"
        onChange={(e) =>
          setFormValues({
            name: e.currentTarget.elements.name.value,
            content: e.currentTarget.elements.content.value,
          })
        }
      >
        <div>
          <label>
            Name: <input defaultValue={formValues.name} name="name" />
          </label>
          {nameError ? <div role="alert">{nameError}</div> : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea defaultValue={formValues.content} name="content" />
          </label>
          {contentError ? <div role="alert">{contentError}</div> : null}
        </div>
        <button type="submit">Add</button>
      </Form>
    </div>
  );
}
