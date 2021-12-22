import * as React from "react";
import { Form, useSubmit } from "remix";
import type { ActionFunction } from "remix";

import * as gtag from "~/utils/gtags";

export const action: ActionFunction = () => {
  return "";
};

export default function Contact() {
  const submit = useSubmit();

  const handleSubmit = (
    e: React.SyntheticEvent<
      | HTMLFormElement
      | HTMLButtonElement
      | HTMLInputElement
      | FormData
      | URLSearchParams
      | {
          [name: string]: string;
        }
      | null
    >
  ) => {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      message: { value: string };
    };

    console.log("target", target.message.value);

    gtag.event({
      action: "submit_form",
      category: "Contact",
      label: target.message.value
    });

    submit(e.currentTarget, { replace: true, method: "post" });
  };

  return (
    <main>
      <h1>This is the Contact page</h1>
      <Form onSubmit={handleSubmit}>
        <label>
          <span>Message:</span>
          <textarea name="message" />
        </label>
        <button type="submit">submit</button>
      </Form>
    </main>
  );
}
