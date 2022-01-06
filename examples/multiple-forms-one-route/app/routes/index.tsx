import { Form, useActionData } from "remix";
import type { ActionFunction } from "remix";
import "../styles.css";

function processNameForm(name: FormDataEntryValue | null) {
  if (name === "Bad Person") {
    return {
      formType: "nameForm",
      status: "error",
      nameError: true
    };
  }

  return {
    formType: "nameForm",
    status: "success",
    name: name
  };
}

function processEmailForm(email: FormDataEntryValue | null) {
  if (email === "bademail@google.com") {
    return {
      formType: "emailForm",
      status: "error",
      emailError: true
    };
  }
  return {
    formType: "emailForm",
    email: email
  };
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  if (formData.get("formType") === "nameForm") {
    return processNameForm(formData.get("name"));
  }
  if (formData.get("formType") === "emailForm") {
    return processEmailForm(formData.get("email"));
  }
  return null;
};

export default function Index() {
  const results = useActionData();

  console.log(results);
  return (
    <div>
      <header>
        <h1>Handle Multiple Forms on one Route</h1>
        <p>
          What if you want to have two or more forms on one page? This sample
          covers that.
        </p>
      </header>
      <div className="content">
        <article>
          <h2>Name Form</h2>
          <Form method="post">
            <input type="hidden" name="formType" value="nameForm" />
            <label htmlFor="name">
              Name:
              <input type="text" name="name" />
            </label>
            <p>Enter 'Bad Person' to trigger an error</p>
            <button type="submit">Submit</button>
          </Form>
          <hr />

          <h2>Results</h2>

          <h3>Success</h3>
          <div className="results">
            {results?.formType === "nameForm" && results?.status !== "error" ? (
              <>
                <p>{results?.name}</p>
              </>
            ) : null}
          </div>

          <h3>Failure</h3>
          <div className="results">
            {results?.formType === "nameForm" && results?.status === "error" ? (
              <>
                <p className="error">
                  {results?.nameError ? "That is not a valid name" : null}
                </p>
              </>
            ) : null}
          </div>
        </article>
        <article>
          <h2>Email Form</h2>
          <Form method="post">
            <input type="hidden" name="formType" value="emailForm" />
            <label htmlFor="email">
              Email:
              <input type="email" name="email" />
            </label>
            <p>Enter 'bademail@google.com' to trigger an error</p>
            <button type="submit">Submit</button>
          </Form>
          <hr />

          <h2>Results</h2>

          <h3>Success</h3>
          <div className="results">
            {results?.formType === "emailForm" &&
            results?.status !== "error" ? (
              <>
                <p>{results?.email}</p>
              </>
            ) : null}
          </div>

          <h3>Failure</h3>
          <div className="results">
            {results?.formType === "emailForm" &&
            results?.status === "error" ? (
              <>
                <p className="error">
                  {results?.emailError ? "That is not a valid email" : null}
                </p>
              </>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
