import * as React from "react";
import Dialog from "@reach/dialog";
import type { ActionFunction, LinksFunction, LoaderFunction } from "remix";
import { useLoaderData } from "remix";
import { json } from "remix";
import { Form } from "remix";
import { useNavigate } from "remix";
import styles from "@reach/dialog/styles.css";

import stylesUrl from "~/styles/invoices/dialog.css";
import { getInvoices } from "~/data.server";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: styles
    },
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

export let loader: LoaderFunction = ({ params }) => {
  const id = params.id;
  if (!id) return null;

  const invoice = getInvoices().find(invoice => invoice.id === parseInt(id));
  console.log(getInvoices(), params);
  return json(invoice);
};

export let action: ActionFunction = ({ request }) => {
  console.log(request);
  return null;
};

export default function Edit() {
  const navigate = useNavigate();
  const data = useLoaderData();

  const [formData, setFormData] = React.useState({
    company: data.company,
    description: data.description,
    amount: data.amount
  });

  function handleChange(
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.currentTarget;
    setFormData({ ...formData, [name]: value });
  }

  function onDismiss() {
    navigate("/invoices");
  }

  return (
    <Dialog
      className="dialog"
      isOpen={true}
      aria-label="Add invoice"
      onDismiss={onDismiss}
    >
      <h3>Edit invoice</h3>
      <Form className="form" method="post" replace>
        <label className="label" htmlFor="company">
          Company
        </label>
        <input
          className="input"
          type="text"
          name="company"
          value={formData.company}
          onChange={handleChange}
        />

        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          className="textarea"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={10}
        />

        <label className="label">Amount</label>
        <input
          className="input"
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
        />

        <div className="actions">
          <button type="submit">Save</button>
          <button type="button" onClick={onDismiss}>
            Cancel
          </button>
        </div>
      </Form>
    </Dialog>
  );
}
