import Dialog from "@reach/dialog";
import { ActionFunction, LinksFunction, useTransition } from "remix";
import { json, redirect, useActionData } from "remix";
import { Form } from "remix";
import { useNavigate } from "remix";
import styles from "@reach/dialog/styles.css";
import stylesUrl from "~/styles/invoices/dialog.css";
import { createInvoice } from "~/data.server";

export const links: LinksFunction = () => {
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

function validateAmount(amount: string) {
  const amountNumber = Number(amount);
  if (isNaN(amountNumber) || amountNumber <= 0) {
    return "Amount must be a number greater than 0";
  }
}

function validateCompany(company: string) {
  if (company.length < 3) {
    return "Company must be at least 3 characters";
  }
}

function validateDate(date: string) {
  if (isNaN(new Date(date).getTime())) {
    return "Date must be a valid date";
  }
}

function validateDescription(description: string) {
  if (typeof description !== "string") {
    return "Description must be a string";
  }
}

type ActionData = {
  formError?: string;
  fieldErrors?: {
    company: string | undefined;
    amount: string | undefined;
    date: string | undefined;
    description: string | undefined;
  };
  fields?: {
    company: string;
    amount: string;
    date: string;
    description: string;
  };
};

const badRequest = (data: ActionData) => json(data, { status: 400 });
export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const company = form.get("company");
  const description = form.get("description");
  const amount = form.get("amount");
  const date = form.get("date");

  if (
    typeof company !== "string" ||
    typeof description !== "string" ||
    typeof amount !== "string" ||
    typeof date !== "string"
  ) {
    return badRequest({
      formError: "Invalid form data"
    });
  }

  const fields = { company, description, amount, date };
  const fieldErrors = {
    company: validateCompany(company),
    amount: validateAmount(amount),
    date: validateDate(date),
    description: validateDescription(description)
  };

  if (Object.values(fieldErrors).some(Boolean)) {
    return { fieldErrors, fields };
  }

  const invoice = createInvoice({
    company,
    description,
    date: new Date(date),
    amount: parseFloat(amount)
  });

  // This is just so we can see the transition
  return new Promise(resolve =>
    setTimeout(() => {
      resolve(redirect(`/invoices/`));
    }, 2000)
  );
};

export default function Add() {
  const navigate = useNavigate();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  function onDismiss() {
    navigate("/invoices");
  }

  const disabled =
    transition.state === "submitting" || transition.state === "loading";

  return (
    <Dialog
      className="dialog"
      isOpen={true}
      aria-label="Add invoice"
      onDismiss={onDismiss}
    >
      {transition.state === "submitting" && <div>Saving...</div>}
      <Form className="form" method="post" replace>
        <label className="label" htmlFor="company">
          Company
        </label>
        <input
          className="input"
          defaultValue={actionData?.fields?.company}
          type="text"
          name="company"
        />
        {actionData?.fieldErrors?.company ? (
          <p className="form-validation-error" role="alert" id="name-error">
            {actionData.fieldErrors.company}
          </p>
        ) : null}

        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          className="textarea"
          defaultValue={actionData?.fields?.description}
          name="description"
          rows={10}
        />
        {actionData?.fieldErrors?.description ? (
          <p className="form-validation-error" role="alert" id="name-error">
            {actionData.fieldErrors.description}
          </p>
        ) : null}

        <label className="label">Amount</label>
        <input
          className="input"
          defaultValue={actionData?.fields?.amount}
          type="number"
          name="amount"
        />
        {actionData?.fieldErrors?.amount ? (
          <p className="form-validation-error" role="alert" id="name-error">
            {actionData.fieldErrors.amount}
          </p>
        ) : null}
        <label className="label">Date</label>
        <input
          className="input"
          defaultValue={actionData?.fields?.date}
          type="date"
          name="date"
        />
        {actionData?.fieldErrors?.date ? (
          <p className="form-validation-error" role="alert" id="name-error">
            {actionData.fieldErrors.date}
          </p>
        ) : null}
        <div className="actions">
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
