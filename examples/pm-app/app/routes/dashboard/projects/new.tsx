import * as React from "react";
import {
  Form,
  json,
  redirect,
  useActionData,
  useLoaderData,
  useCatch
} from "remix";
import type { ActionFunction, LoaderFunction, LinksFunction } from "remix";
import type { UserSecure } from "~/models";
import { Heading } from "~/ui/section-heading";
import { MaxContainer } from "~/ui/max-container";
import { requireUser } from "~/session.server";
import { Field, FieldError, FieldProvider, Label, Textarea } from "~/ui/form";
import { Button } from "~/ui/button";
import { createProject, getUsers } from "~/db.server";
import stylesUrl from "~/dist/styles/routes/dashboard/projects/new.css";
import {
  MemberSearch,
  MemberSearchCombobox,
  MemberSearchHiddenField,
  MemberSearchSelections
} from "~/ui/member-search";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export const loader: LoaderFunction = async ({ request }) => {
  const { passwordHash, ...secureUser } = await requireUser(request, {
    redirect: "/sign-in"
  });

  const allUsers = await getUsers();

  const loaderData: LoaderData = {
    user: secureUser,
    allUsers: allUsers
  };

  return loaderData;
};

export const action: ActionFunction = async ({ request }) => {
  const currentUser = await requireUser(request, {
    redirect: "/sign-in"
  });

  // 1. Get/setup form data from the request
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";
  const membersRaw = formData.get("members");

  const fieldErrors: FieldErrors = {
    description: null,
    name: null,
    members: null
  };

  // 2. Validate the form data
  let members: string[] = [];
  try {
    members = JSON.parse(membersRaw as string);
    if (
      typeof name !== "string" ||
      typeof description !== "string" ||
      !Array.isArray(members)
    ) {
      throw Error("blergh");
    }
  } catch (_) {
    const data: ActionData = {
      formError: `Something went wrong. Please try again later.`
    };
    return json(data);
  }

  const fields = { name, description, members };

  if (!name) {
    fieldErrors.name = "Project name is required";
  } else if (name.length < 3) {
    fieldErrors.name = "Project name must be at least 3 characters";
  }

  if (Object.values(fieldErrors).some(Boolean)) {
    return json({ fieldErrors, fields });
  }

  // 3. Create the project
  try {
    const project = await createProject({
      name,
      description,
      ownerId: currentUser.id,
      members
    });
    return redirect(`dashboard/projects/${project.id}`);
  } catch (_) {
    const data: ActionData = {
      formError: `Something went wrong. Please try again later.`
    };
    return json(data);
  }
};

function NewProject() {
  const loaderData = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>() || {};
  const { fieldErrors, fields, formError } = actionData;
  const { allUsers, user } = loaderData;

  const selectableUsers = React.useMemo(() => {
    return allUsers.filter(u => u.id !== user.id);
  }, [allUsers, user.id]);

  // We don't show the combobox initially to prevent SSR jank. We show and hide
  // it based on whether or not a name is set for the project.
  const [nameComplete, setNameComplete] = React.useState(false);
  function handleNameBlur(event: React.FocusEvent<HTMLInputElement>) {
    setNameComplete(!!event.target.value);
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setNameComplete(complete => {
      if (complete && !event.target.value) {
        return false;
      }
      return complete;
    });
  }

  return (
    <MaxContainer className="new-project">
      <div className="new-project__header">
        <div className="new-project__header-inner">
          <Heading level={2}>Create a new project</Heading>
        </div>
      </div>
      <div className="new-project__section new-project__create-section">
        <Form
          method="post"
          aria-describedby={formError ? "form-error-message" : undefined}
        >
          <div className="new-project__form">
            {formError ? (
              <div className="new-project__form-error">
                <span
                  className="new-project__form-error-text"
                  id="form-error-text"
                  role="alert"
                >
                  {actionData.formError}
                </span>
              </div>
            ) : null}

            <FieldProvider
              name="name"
              id="new-project-name"
              error={fieldErrors?.name}
            >
              <Label>Project Name</Label>
              <Field
                required
                defaultValue={fields?.name}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
              />
              <FieldError />
            </FieldProvider>
            <FieldProvider
              name="description"
              id="new-project-description"
              error={fieldErrors?.description}
            >
              <Label>Description</Label>
              <Textarea defaultValue={fields?.description} />
              <FieldError />
            </FieldProvider>

            {nameComplete ? (
              <FieldProvider
                name="members-combobox"
                id="new-project-members"
                error={fieldErrors?.members}
              >
                <Label>Members</Label>

                <MemberSearch users={selectableUsers}>
                  <MemberSearchCombobox />
                  <MemberSearchHiddenField name="members" />
                  <div className="member-selection-wrapper flex flex-wrap gap-2">
                    <MemberSearchSelections />
                  </div>
                </MemberSearch>

                <FieldError />
              </FieldProvider>
            ) : null}

            <Button className="new-project__form-submit">Create Project</Button>
          </div>
        </Form>
      </div>
    </MaxContainer>
  );
}

export default NewProject;

export function CatchBoundary() {
  const caught = useCatch();

  switch (caught.status) {
    case 401:
    case 404:
      return (
        <div>
          <h1>
            {caught.status} -- {caught.statusText}
          </h1>
        </div>
      );

    default:
      throw new Error(
        `Unexpected caught response with status: ${caught.status}`
      );
  }
}

export function ErrorBoundary({ error }: { error: Error }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <div>
        <h1>PM Camp</h1>
        <div>Crap</div>
      </div>
    </div>
  );
}

interface LoaderData {
  user: UserSecure;
  allUsers: UserSecure[];
}

interface ActionData {
  formError?: string;
  fieldErrors?: FieldErrors;
  fields?: Record<TextFields, string>;
}

type FieldErrors = Record<TextFields, string | undefined | null>;

type TextFields = "name" | "description" | "members";
