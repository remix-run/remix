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
import routeStyles from "../styles/routes/sign-in.css";
import { Field, FieldError, FieldProvider, Label } from "~/ui/form";
import { Heading } from "~/ui/section-heading";
import { validateEmail, validatePassword } from "~/utils/validation";
import { createUserSession, login, redirectUser } from "~/session.server";
import type { User } from "~/models";
import { useFocusOnFormError } from "~/utils/react";

export const meta: MetaFunction = () => {
  return {
    title: "Sign In | PM Camp"
  };
};

export const links: LinksFunction = () => {
  return [{ href: routeStyles, rel: "stylesheet" }];
};

export const action: ActionFunction = async ({ request }) => {
  // 1. Get/setup form data from the request
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");
  const fieldErrors: FieldErrors = {
    email: null,
    password: null
  };

  // 2. Validate the form data
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    (redirectTo && typeof redirectTo !== "string")
  ) {
    return json<ActionData>(
      { formError: `Something went wrong. Please try again later.` },
      400
    );
  }

  const fields = { email, password };

  if (!email) {
    fieldErrors.email = "Email is required";
  } else {
    try {
      validateEmail(email);
    } catch (e) {
      if (e instanceof Error) {
        fieldErrors.email = e.message;
      } else if (typeof e === "string") {
        fieldErrors.email = e;
      } else {
        fieldErrors.email = "There was an error with this field";
      }
    }
  }

  if (!password) {
    fieldErrors.password = "Password is required";
  } else {
    try {
      validatePassword(password);
    } catch (e) {
      if (e instanceof Error) {
        fieldErrors.password = e.message;
      } else if (typeof e === "string") {
        fieldErrors.password = e;
      } else {
        fieldErrors.password = "There was an error with this field";
      }
    }
  }

  if (Object.values(fieldErrors).some(Boolean)) {
    return json<ActionData>({ fieldErrors, fields }, 400);
  }

  // 3. Attempt login
  let user: User | null;
  try {
    user = await login(email, password);
  } catch (e) {
    let formError: string;
    if (e instanceof Error) {
      formError = e.message;
    } else if (typeof e === "string") {
      formError = e;
    } else {
      formError = "There was an error logging in. Please try again later.";
    }

    return json<ActionData>({ fields, formError }, 401);
  }

  // 4. Create a user session with the user's ID
  return await createUserSession(user.id, {
    // 5. Redirect to the user's dashboard (or whatever URL is set by the
    //    `redirectTo` field)
    redirect: redirectTo || "/dashboard"
  });
};

export const loader: LoaderFunction = async ({ request }) => {
  await redirectUser(request, {
    redirect: "/dashboard"
  });
  return {};
};

export default function SignIn() {
  const actionData = useActionData<ActionData>();
  const { fieldErrors, fields, formError } = actionData || {};
  const [searchParams] = useSearchParams();
  const formRef = React.useRef<HTMLFormElement>(null);

  useFocusOnFormError({ formError, fieldErrors, formRef });

  return (
    <div className="signin__container">
      <ShadowBox className="signin__box">
        {formError ? (
          <div className="signin__form-error">
            <span
              className="signin__form-error-text"
              id="form-error-text"
              role="alert"
            >
              {formError}
            </span>
          </div>
        ) : null}
        <Heading level={3} className="signin__heading">
          Sign In
        </Heading>

        <Form
          method="post"
          id="signin-form"
          aria-describedby={formError ? "form-error-text" : undefined}
          ref={formRef}
        >
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? undefined}
          />
          <div className="signin__email-form">
            <FieldProvider
              name="email"
              id="signin-email"
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
              id="signin-password"
              required
              error={fieldErrors?.password}
            >
              <Label>Password</Label>
              <Field type="password" defaultValue={fields?.password} />
              <FieldError />
            </FieldProvider>
            <Button className="signin__email-form-submit">Sign In</Button>
          </div>
        </Form>
      </ShadowBox>
      <p className="signin__outer-text">
        New user? <Link to="/register">Register here.</Link>
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

type TextFields = "email" | "password";
