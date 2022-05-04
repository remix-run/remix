import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { FlashMessage, getSession, storage } from "~/utils/session.server";
import { getSessionFlash } from "~/utils/session.server";

interface LoaderData {
  message?: FlashMessage;
}

interface ActionData {
  formError: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  const flash = await getSessionFlash(request);
  if (flash && flash.message) {
    return json({ message: flash.message }, { headers: flash.headers });
  }

  return null;
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const text = form.get("messageText");
  const color = form.get("messageColor");

  if (!text || !color) {
    return json({ formError: `Invalid form submission` }, { status: 400 });
  }

  const session = await getSession(request);
  session.flash("messageText", text);
  session.flash("messageColor", color);

  return redirect(".", {
    headers: { "Set-Cookie": await storage.commitSession(session) },
    status: 200,
  });
};

export default function Index() {
  const loaderData = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  return (
    <>
      {loaderData?.message ? (
        <FlashMessage message={loaderData.message} />
      ) : null}
      <Form method="post">
        <label htmlFor="messageText">Enter your message: </label>
        <input
          id="messageText"
          name="messageText"
          type="text"
          defaultValue="This is a flash message ⚡"
          required
        />
        <br />

        <fieldset style={{ width: "fit-content" }}>
          <legend>Pick a color</legend>
          <input
            id="info"
            name="messageColor"
            type="radio"
            value="#11bddf"
            defaultChecked
          />
          <label htmlFor="info">info</label>

          <input
            id="success"
            name="messageColor"
            type="radio"
            value="#1bcd18"
          />
          <label htmlFor="success">success</label>

          <input id="error" name="messageColor" type="radio" value="#e81717" />
          <label htmlFor="error">error</label>
        </fieldset>

        <br />
        <button type="submit">Set Flash Message</button>
        {actionData?.formError ? (
          <pre style={{ color: "red" }}>{actionData.formError}</pre>
        ) : null}
      </Form>
    </>
  );
}

function FlashMessage({ message }: { message: FlashMessage }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (message && !dialogRef.current?.open) dialogRef.current?.show();
  }, [message]);

  return message ? (
    <dialog ref={dialogRef} id="dialog" style={{ borderColor: message.color }}>
      <p>{message.text}</p>
      {/* https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#attr-method */}
      <form method="dialog">
        <button>Close</button>
      </form>
    </dialog>
  ) : null;
}

/*
Source: TypeScript-DOM-lib-generator
https://github.com/microsoft/TypeScript-DOM-lib-generator/blob/31e9b893980c91991f45a565dfbd6280798e2b4f/baselines/dom.generated.d.ts#L6234
*/
interface HTMLDialogElement extends HTMLElement {
  open: boolean;
  returnValue: string;
  /**
   * Closes the dialog element.
   *
   * The argument, if provided, provides a return value.
   */
  close(returnValue?: string): void;
  /** Displays the dialog element. */
  show(): void;
  showModal(): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLDialogElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLDialogElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
}
