import * as React from "react";
import {
  Form,
  json,
  Outlet,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useTransition
} from "remix";
import type { LoaderFunction, LinksFunction, MetaFunction } from "remix";
import { Heading, Section } from "~/ui/section-heading";
import { MaxContainer } from "~/ui/max-container";

import stylesUrl from "~/dist/styles/routes/dashboard/projects/$projectId/index.css";
import { Link } from "~/ui/link";
import { requireUser } from "~/session.server";
import { getProject, getUsers } from "~/db.server";
import type { Project, UserSecure } from "~/models";
import {
  DropdownMenu,
  DropdownMenuOptionsButton,
  DropdownMenuList,
  DropdownMenuItem,
  DropdownMenuPopover
} from "~/ui/dropdown-menu";
import { Avatar } from "~/ui/avatar";
import { Dialog, DialogCloseButton } from "~/ui/dialog";
import { Field, FieldError, FieldProvider, Label, Textarea } from "~/ui/form";
import {
  MemberSearch,
  MemberSearchCombobox,
  MemberSearchHiddenField,
  MemberSearchSelections
} from "~/ui/member-search";
import { Button } from "~/ui/button";
import { Note } from "~/ui/note";
import { IconAdd } from "~/ui/icons";
import { ShadowBox } from "~/ui/shadow-box";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export const meta: MetaFunction = ({ data }) => {
  return {
    title: `${
      data.project ? data.project.name?.trim() : "Project Overview"
    } | PM Camp`
  };
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { passwordHash, ...user } = await requireUser(request, {
    redirect: "/sign-in"
  });

  const projectId = params.projectId as string;
  const [project, allUsers] = await Promise.all([
    getProject(projectId),
    getUsers()
  ]);

  if (!project) {
    throw redirect("/dashboard");
  }

  return json<LoaderData>({ project, user, allUsers });
};

export default function ProjectRoute() {
  const { project, allUsers, user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();

  const { fieldErrors } = actionData || {};
  const [showTeamDialog, setShowTeamDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);

  // TODO: Move to loader
  const selectableUsers = React.useMemo(() => {
    return allUsers.filter(u => u.id !== user.id);
  }, [allUsers, user.id]);

  // Ok, so there's a bit of data setup/manipulation here that is probably a bit
  // confusing. There are two forms on this route that write data via the form
  // action but they are intended to show two different ways to handle UI in
  // Remix. In one example (the Edit form), the data doesn't change until after
  // the user submits the form, and the UI waits for the form submission to
  // complete before the form's modal is dismissed and the view is updated. This
  // is how a lot of folks deal with these kinds of mutations without Remix, and
  // this shows how you could still do that here if you wanted to in some cases!
  //
  // In the other form (the Members update form) we use another approach to
  // update the UI instantly (optimistically). This is handled by updating local
  // state in our component to reflect what the user sees in real time while the
  // submission is triggered by the changing state. Once the submission is
  // complete, we switch back to the real values from the server in our UI.
  // Remix handles race conditions under the hood so we don't have to worry
  // about janky UI. If the submission fails for some reason, we render our
  // error boundary instead.
  //
  // See https://remix.run/guides/optimistic-ui

  // TODO: Consider sending to a separate route
  // TODO: Try catching potential error and sending data back via the fetcher
  const membersFetcher = useFetcher();
  const membersFormRef = React.useRef<HTMLFormElement>(null);

  const [optimisticMembers, setOptimisticSelectedMembers] = React.useState(
    project.members
  );

  // Submit the membersFetcher form any time the optimistic member state
  // is updated.
  const initialRender = React.useRef(true);
  React.useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    membersFetcher.submit(membersFormRef.current);
  }, [membersFetcher, optimisticMembers]);

  const deleteFetcher = useFetcher();
  const deleteFormRef = React.useRef<HTMLFormElement>(null);

  // Edit form stuff
  // TODO: Get correct state from action
  const transition = useTransition();
  React.useEffect(() => {
    if (transition.state === "idle") {
      setShowEditDialog(false);
    }
  }, [transition.state]);

  // In our member selection combobox we exclude the current user so they can't
  // accidentally remove themselves on the project. We handle this on the server
  // as well, but no use in showing something in the UI if it won't work!
  // TODO: Stick this into the loader!
  const projectMembers = project.members;
  const [membersExcludingSelf, memberIds] = React.useMemo(() => {
    const excludingSelf: typeof projectMembers = [];
    const userIds: Array<UserSecure["id"]> = [];
    for (const member of projectMembers) {
      userIds.push(member.id);
      if (member.id !== user.id) {
        excludingSelf.push(member);
      }
    }
    return [excludingSelf, userIds] as const;
  }, [projectMembers, user.id]);

  const [optimisticMembersExcludingSelf, optimisticMemberIds] =
    React.useMemo(() => {
      const excludingSelf: typeof optimisticMembers = [];
      const userIds: Array<UserSecure["id"]> = [];
      for (const member of optimisticMembers) {
        userIds.push(member.id);
        if (member.id !== user.id) {
          excludingSelf.push(member);
        }
      }
      return [excludingSelf, userIds] as const;
    }, [optimisticMembers, user.id]);

  return (
    <Layout
      heading={project.name}
      description={project.description}
      memberList={
        <>
          {(membersFetcher.submission
            ? optimisticMembers
            : project.members
          ).map((member, i) => {
            return (
              <Avatar
                size="xl"
                key={member.id}
                className="project-index__member"
                {...member}
                // @ts-ignore
                style={{ "--n": i }}
              />
            );
          })}
          <button
            type="button"
            className="project-index__member-add"
            onClick={() => setShowTeamDialog(true)}
            aria-label="Update Team Members"
            title="Update Team Members"
          >
            <IconAdd aria-hidden />
          </button>
        </>
      }
      optionsPanel={
        <DropdownMenu id="project-options-menu">
          <DropdownMenuOptionsButton aria-label="Project Options" size={8} />
          <DropdownMenuPopover>
            <DropdownMenuList>
              <DropdownMenuItem
                className="project-index__options-menu-item"
                onSelect={() => setShowEditDialog(true)}
              >
                Edit project details
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="danger"
                className="project-index__options-menu-item project-index__options-menu-item--delete"
                onSelect={() => {
                  const confirmed = window.confirm(
                    "Are you sure? This will also delete all todo lists associated with this project."
                  );
                  if (confirmed) {
                    deleteFetcher.submit(deleteFormRef.current);
                  }
                }}
              >
                Delete project
              </DropdownMenuItem>
            </DropdownMenuList>
          </DropdownMenuPopover>
        </DropdownMenu>
      }
      main={
        <div className="project-index__flexer">
          <div>
            <Heading className="project-index__section-heading">
              Todo Lists
            </Heading>
            <Section as="div" className="project-index__todolists">
              {project.todoLists.length > 0 ? (
                <React.Fragment>
                  {project.todoLists.map(list => {
                    return (
                      <article
                        key={list.id}
                        className="project-index__todolist"
                      >
                        <Link
                          to={`list/${list.id}`}
                          aria-label={`Todo List: ${list.name}`}
                          className="project-index__todolist-link"
                        >
                          <ShadowBox className="project-index__todolist-box">
                            <span className="project-index__todolist-name">
                              {list.name}
                            </span>
                          </ShadowBox>
                        </Link>
                      </article>
                    );
                  })}

                  <div>
                    <Link
                      to={`../todo-lists/new?project=${project.id}`}
                      className="project-index__list-block-link project-index__create-link"
                    >
                      <span>Create a new list</span>
                    </Link>
                  </div>
                </React.Fragment>
              ) : (
                <div>
                  <p>
                    No todo lists for this project yet.{" "}
                    <Link to={`../todo-lists/new?project=${project.id}`}>
                      Create a new list.
                    </Link>
                  </p>
                </div>
              )}
            </Section>
          </div>
          <Outlet />
        </div>
      }
    >
      <Dialog
        aria-label="Team Member Selection"
        isOpen={showTeamDialog}
        onDismiss={() => setShowTeamDialog(false)}
        allowPinchZoom
      >
        <DialogCloseButton />

        <div className="project-index__member-form-wrapper">
          <membersFetcher.Form ref={membersFormRef} method="post">
            <FieldProvider
              name="members-combobox"
              id="edit-project-members"
              error={fieldErrors?.members}
            >
              <Label>Members</Label>

              <MemberSearch
                users={selectableUsers}
                selection={
                  membersFetcher.submission
                    ? optimisticMembersExcludingSelf
                    : membersExcludingSelf
                }
                onSelectionChange={setOptimisticSelectedMembers}
              >
                <MemberSearchCombobox />

                <input
                  type="hidden"
                  name="members"
                  value={JSON.stringify(optimisticMemberIds)}
                />
                <input
                  type="hidden"
                  name="currentMembers"
                  value={JSON.stringify(memberIds)}
                />
                <div className="member-selection-wrapper flex flex-wrap gap-2">
                  <MemberSearchSelections />
                </div>
              </MemberSearch>

              <FieldError />
            </FieldProvider>
          </membersFetcher.Form>

          <Note>
            <p>
              Updating members in this dialog will send a request to the server
              on each change to the autocomplete field. Notice optimistic
              updates in the bacground UI as you make changes!
            </p>
          </Note>
        </div>
      </Dialog>

      <Dialog
        aria-label="Edit Project"
        isOpen={showEditDialog}
        onDismiss={() => setShowEditDialog(false)}
        allowPinchZoom
      >
        <DialogCloseButton />

        <div className="project-index__edit-form-wrapper">
          <Form method="post">
            <div className="project-index__edit-form-inner">
              <FieldProvider
                name="name"
                id="edit-project-name"
                error={fieldErrors?.name}
              >
                <Label>Name</Label>
                <Field
                  type="text"
                  defaultValue={
                    actionData && actionData.fields
                      ? actionData.fields.name
                      : project.name
                  }
                />
                <FieldError />
              </FieldProvider>
              <FieldProvider
                name="description"
                id="edit-project-description"
                error={fieldErrors?.description}
                required
              >
                <Label>Description</Label>
                <Textarea
                  defaultValue={
                    actionData && actionData.fields
                      ? actionData.fields.description
                      : project.description || ""
                  }
                  placeholder="Add a description"
                />
                <FieldError />
              </FieldProvider>
              <FieldProvider
                name="members-combobox"
                id="edit-project-members"
                error={fieldErrors?.members}
              >
                <Label>Members</Label>

                <MemberSearch
                  users={selectableUsers}
                  initialSelection={membersExcludingSelf}
                >
                  <MemberSearchCombobox />
                  <MemberSearchHiddenField name="members" />
                  <input
                    type="hidden"
                    name="currentMembers"
                    value={JSON.stringify(memberIds)}
                  />
                  <div className="member-selection-wrapper flex flex-wrap gap-2">
                    <MemberSearchSelections />
                  </div>
                </MemberSearch>

                <FieldError />
              </FieldProvider>

              <Button>Submit Changes</Button>
            </div>
          </Form>

          <Note>
            <p>
              Updating data in this dialog will only send a request to the
              server once the form is submitted. Notice the UI in the background
              does not update as you make changes.
            </p>
          </Note>
        </div>
      </Dialog>

      <deleteFetcher.Form
        hidden
        action="delete"
        method="post"
        replace
        ref={deleteFormRef}
      >
        <button>Delete project</button>
      </deleteFetcher.Form>
    </Layout>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return (
    <Layout
      heading="Oh no!"
      description="Something went wrong! Go back and try again later."
    />
  );
}

function Layout({
  children,
  optionsPanel,
  heading,
  description,
  memberList,
  main
}: React.PropsWithChildren<{
  heading: React.ReactNode | string;
  optionsPanel?: React.ReactNode;
  description?: React.ReactNode;
  memberList?: React.ReactNode;
  main?: React.ReactNode;
}>) {
  return (
    <MaxContainer className="project-index">
      {optionsPanel ? (
        <aside className="project-index__options-panel">{optionsPanel}</aside>
      ) : null}
      <div className="project-index__header">
        <div className="project-index__header-inner">
          <Heading level={1} className="project-index__heading">
            {heading}
          </Heading>
          {description ? <p>{description}</p> : null}
          {memberList ? (
            <div className="project-index__member-list">{memberList}</div>
          ) : null}
        </div>
      </div>
      {main ? (
        <section className="project-index__section project-index__section--lists">
          {main}
        </section>
      ) : null}
      {children}
    </MaxContainer>
  );
}

interface LoaderData {
  project: Project;
  user: UserSecure;
  allUsers: UserSecure[];
}

interface ActionData {
  formError?: string;
  fieldErrors?: FieldErrors;
  fields?: Fields;
}

type FieldErrors = Record<TextFields, string | undefined | null>;

type TextFields = "name" | "description" | "members";
type Fields = Record<"name" | "description", string> & {
  members: string[];
  currentMembers: string[];
};
