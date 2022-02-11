import * as React from "react";
import type {
  ActionFunction,
  MetaFunction,
  LinksFunction,
  LoaderFunction
} from "remix";
import { Form, json, useActionData, useSearchParams } from "remix";
import { Button } from "~/ui/button";
import { Link } from "~/ui/link";
import { ShadowBox } from "~/ui/shadow-box";
import { Field, FieldError, FieldProvider, Label } from "~/ui/form";
import { Heading } from "~/ui/section-heading";
import routeStyles from "../styles/routes/register.css";
import { createUserSession, register } from "~/session.server";
import { getUser } from "~/db.server";
import { validateEmail, validatePassword } from "~/utils/validation";

export const meta: MetaFunction = () => {
  return {
    title: "Register | PM Camp"
  };
};

export const links: LinksFunction = () => {
  return [{ href: routeStyles, rel: "stylesheet" }];
};

export const loader: LoaderFunction = async ({ request }) => {
  //   let session = await sessionStorage.getSession(request.headers.get("Cookie"));

  //   // If the user is already authenticated, just redirect to `/done`
  //   await isAuthenticated(session, {
  //     successRedirect: "/done",
  //   });

  return {};
};

export const action: ActionFunction = async ({ request }) => {
  // 1. Get/setup form data from the request
  const formData = await request.formData();
  const fieldErrors = {} as FieldErrors;
  const fields = {} as Record<TextFields, FormDataEntryValue | null>;
  for (const fieldName of [
    "nameFirst",
    "nameLast",
    "email",
    "password"
  ] as TextFields[]) {
    const fieldValue = formData.get(fieldName);
    fields[fieldName] = fieldValue as string;
    fieldErrors[fieldName] = null;
  }

  const redirectTo = formData.get("redirectTo") || "dashboard";

  // 2. Validate the form data
  if (
    typeof fields.nameFirst !== "string" ||
    (fields.nameLast && typeof fields.nameLast !== "string") ||
    typeof fields.email !== "string" ||
    typeof fields.password !== "string" ||
    typeof redirectTo !== "string"
  ) {
    const data: ActionData = {
      formError: `Something went wrong. Please try again later.`
    };
    return json(data);
  }

  const { email, password, nameFirst, nameLast } = fields;

  if (!nameFirst) {
    fieldErrors.nameFirst = "First name is required";
  }

  if (!email) {
    fieldErrors.email = "Email is required";
  } else {
    try {
      validateEmail(email);
    } catch (e) {
      fieldErrors.email = (e as Error).message;
    }
  }

  if (!password) {
    fieldErrors.password = "Password is required";
  } else {
    try {
      validatePassword(password);
    } catch (e) {
      fieldErrors.password = (e as Error).message;
    }
  }

  if (Object.values(fieldErrors).some(Boolean)) {
    return json({ fieldErrors, fields });
  }

  // 3. Check for existing user
  const existingUser = await getUser("email", email);
  if (existingUser) {
    return {
      fields,
      formError: `Sorry! That email is already taken.`
    };
  }

  // 4. Register a new user
  const user = await register({ email, password, nameFirst, nameLast });
  if (!user) {
    return {
      fields,
      formError: `Something went wrong with registration. Please try again later!`
    };
  }

  // 5. Create a user session with the new user's ID
  return await createUserSession(user.id, {
    // 6. Redirect to the user's dashboard
    redirect: redirectTo
  });
};

export default function Register() {
  const actionData = useActionData<ActionData>() || {};
  const { fieldErrors, fields, formError } = actionData;
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    if (!formError && !fieldErrors) {
      return;
    }

    // If we have a form error, focus the first field in the form
    if (formError) {
      const form = document.getElementById("register-form");
      const input = form?.querySelector("input");
      input?.focus();
      return;
    }

    // If we have field errors, focus the first problematic field
    if (fieldErrors) {
      for (const field of [
        "nameFirst",
        "nameLast",
        "email",
        "password"
      ] as TextFields[]) {
        if (fieldErrors[field]) {
          const elem = document.getElementById(`register-${field}`);
          elem?.focus();
          return;
        }
      }
    }
  }, [formError, fieldErrors]);

  return (
    <div className="register__container">
      <ShadowBox className="register__box">
        {formError ? (
          <div className="register__form-error">
            <span
              className="register__form-error-text"
              id="form-error-text"
              role="alert"
            >
              {actionData.formError}
            </span>
          </div>
        ) : null}
        <Heading level={3} className="register__heading">
          Register
        </Heading>
        <Form
          id="register-form"
          method="post"
          aria-describedby={formError ? "form-error-text" : undefined}
        >
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? undefined}
          />
          <div className="register__email-form">
            <FieldProvider
              name="nameFirst"
              id="register-nameFirst"
              required
              error={fieldErrors?.nameFirst}
            >
              <Label>First Name</Label>
              <Field defaultValue={fields?.nameFirst} />
              <FieldError />
            </FieldProvider>
            <FieldProvider
              name="nameLast"
              id="register-nameLast"
              error={fieldErrors?.nameLast}
            >
              <Label>Last Name</Label>
              <Field defaultValue={fields?.nameLast} />
              <FieldError />
            </FieldProvider>
            <FieldProvider
              name="email"
              id="register-email"
              required
              error={fieldErrors?.email}
            >
              <Label>Email</Label>
              <Field
                type="email"
                placeholder="hello@remix.run"
                defaultValue={fields?.email}
              />
              <FieldError />
            </FieldProvider>
            <FieldProvider
              name="password"
              id="register-password"
              required
              error={fieldErrors?.password}
            >
              <Label>Password</Label>
              <Field type="password" defaultValue={fields?.password} />
              <FieldError />
            </FieldProvider>
            <Button className="register__email-submit-button">Sign Up</Button>
          </div>
        </Form>
      </ShadowBox>
      <p className="register__outer-text">
        Existing user? <Link to="/sign-in">Sign in here.</Link>
      </p>
    </div>
  );
}

interface ActionData {
  formError?: string;
  fieldErrors?: FieldErrors;
  fields?: Record<TextFields, string>;
}
type FieldErrors = Record<TextFields, string | null>;

type TextFields = "email" | "password" | "nameFirst" | "nameLast";
