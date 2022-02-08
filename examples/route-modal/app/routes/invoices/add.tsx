import Dialog from "@reach/dialog";
import type { ActionFunction, LinksFunction } from "remix";
import { useTransition } from "remix";
import { redirect, useActionData } from "remix";
import { Form } from "remix";
import { useNavigate } from "remix";

import styles from "@reach/dialog/styles.css";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: styles
    }
  ];
};

export const action: ActionFunction = async ({ request }) => {
  // Here we can update our dabatase with the new invoice

  // This is just so we can see the transition
  return new Promise(resolve =>
    setTimeout(() => {
      resolve(redirect(`/invoices/`));
    }, 2000)
  );
};

export default function Add() {
  const navigate = useNavigate();
  const actionData = useActionData();
  const transition = useTransition();

  function onDismiss() {
    navigate("/invoices");
  }

  const disabled =
    transition.state === "submitting" || transition.state === "loading";

  return (
    <Dialog isOpen={true} aria-label="Add invoice" onDismiss={onDismiss}>
      {transition.state === "submitting" && <div>Saving...</div>}
      <h3>Add invoice</h3>
      <Form
        method="post"
        replace
        style={{ display: "flex", flexDirection: "column" }}
      >
        <label htmlFor="company">Company</label>
        <input
          defaultValue={actionData?.fields?.company}
          type="text"
          name="company"
        />

        <label htmlFor="description">Description</label>
        <textarea
          defaultValue={actionData?.fields?.description}
          name="description"
          rows={10}
        />

        <label>Amount</label>
        <input
          defaultValue={actionData?.fields?.amount}
          type="number"
          name="amount"
        />
        <label>Date</label>
        <input
          defaultValue={actionData?.fields?.date}
          type="date"
          name="date"
        />
        <div>
          <button type="submit" disabled={disabled}>
            Add
          </button>
          <button type="button" onClick={onDismiss} disabled={disabled}>
            Cancel
          </button>
        </div>
      </Form>
    </Dialog>
  );
}
