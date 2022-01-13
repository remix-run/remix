import * as React from "react";
import {
  Form,
  json,
  redirect,
  useActionData,
  useSearchParams,
  useLoaderData,
  useCatch
} from "remix";
import type {
  ActionFunction,
  RouteComponent,
  LoaderFunction,
  LinksFunction
} from "remix";
import type { UserSecure, TodoDataUnordered, Project } from "~/models";
import { Heading } from "~/ui/section-heading";
import { MaxContainer } from "~/ui/max-container";
import { requireUser } from "~/session.server";
import {
  Field,
  FieldError,
  FieldProvider,
  Label,
  Textarea,
  Select
} from "~/ui/form";
import { Button } from "~/ui/button";
import { createTodoList, getUserProjects } from "~/db.server";
import stylesUrl from "~/dist/styles/routes/dashboard/todo-lists/new.css";
import { TokenDismissButton } from "../../../ui/token";

type TempTodo = TodoDataUnordered & { _tempId: number };

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { passwordHash, ...secureUser } = await requireUser(request, {
    redirect: "/sign-in"
  });

  const projects = await getUserProjects(secureUser.id);

  const loaderData: LoaderData = {
    user: secureUser,
    projects
  };

  return loaderData;
};

export const action: ActionFunction = async ({ request, context, params }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });

  // 1. Get/setup form data from the request
  const formData = await request.formData();
  const name = formData.get("name") as string;
  let projectId = formData.get("project") as string | null;
  const description = (formData.get("description") as string) || "";
  const todosRaw = formData.get("todos");

  if (projectId === "null") {
    projectId = null;
  }

  const fieldErrors: FieldErrors = {
    description: null,
    name: null,
    todos: null,
    project: null
  };

  // 2. Validate the form data
  let todos: Array<TodoDataUnordered> = [];
  try {
    todos = (JSON.parse(todosRaw as string) as TempTodo[]).map(
      ({ _tempId, ...todo }) => todo
    );
    if (
      typeof name !== "string" ||
      (projectId != null && typeof projectId !== "string") ||
      typeof description !== "string" ||
      !Array.isArray(todos)
    ) {
      throw Error("blergh");
    }
  } catch (_) {
    const data: ActionData = {
      formError: `Something went wrong. Please try again later.`
    };
    return json(data);
  }

  const fields = { name, description, todos };

  if (!name) {
    fieldErrors.name = "Todo list name is required";
  } else if (name.length < 3) {
    fieldErrors.name = "Todo list name must be at least 3 characters";
  }

  if (Object.values(fieldErrors).some(Boolean)) {
    return json({ fieldErrors, fields });
  }

  // 3. Create the list
  try {
    const todoList = await createTodoList({
      name,
      description,
      todos,
      projectId
    });

    return projectId
      ? redirect(`dashboard/projects/${projectId}`)
      : redirect(`dashboard/todo-lists/${todoList.id}`);
  } catch (_) {
    const data: ActionData = {
      formError: `Something went wrong. Please try again later.`
    };
    return json(data);
  }
};

const NewTodoList: RouteComponent = () => {
  const actionData = useActionData<ActionData>() || {};
  const { projects } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const { fieldErrors, fields, formError } = actionData;
  const [todos, setTodos] = React.useState<TempTodo[]>([]);
  const [hydrated, setHyrdrated] = React.useState(false);
  const [state, setState] = React.useState<"IDLE" | "WRITING_TODO">("IDLE");
  React.useEffect(() => {
    setHyrdrated(true);
  }, []);

  return (
    <MaxContainer className="new-todo-list">
      <div className="new-todo-list__header">
        <div className="new-todo-list__header-inner">
          <Heading level={2} className="new-todo-list__heading">
            Create a new todo list
          </Heading>
        </div>
      </div>
      <div className="new-todo-list__section new-todo-list__create-section">
        <Form
          method="post"
          aria-describedby={formError ? "form-error-message" : undefined}
        >
          <div className="new-todo-list__form">
            {formError ? (
              <div className="new-todo-list__form-error">
                <span
                  className="new-todo-list__form-error-text"
                  id="form-error-text"
                  role="alert"
                >
                  {actionData.formError}
                </span>
              </div>
            ) : null}

            <FieldProvider
              name="name"
              id="new-todo-list-name"
              error={fieldErrors?.name}
            >
              <Label>List Name</Label>
              <Field required defaultValue={fields?.name} />
              <FieldError />
            </FieldProvider>
            <FieldProvider
              name="project"
              id="new-todo-list-project"
              error={fieldErrors?.project}
            >
              <Label>Project</Label>
              <Select
                defaultValue={
                  fields?.project || searchParams.get("project") || "null"
                }
                required
              >
                <option value="null" disabled>
                  Select a project...
                </option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              <FieldError />
            </FieldProvider>
            <FieldProvider
              name="description"
              id="new-todo-list-description"
              error={fieldErrors?.description}
            >
              <Label>Description</Label>
              <Textarea defaultValue={fields?.description} />
              <FieldError />
            </FieldProvider>

            {hydrated ? (
              <div>
                {todos.length > 0 ? (
                  <ul
                    className="new-todo-list__todo-list"
                    onFocus={handleTodoListFocus}
                    onBlur={handleTodoListBlur}
                    onKeyDown={handleTodoListKeyDown}
                  >
                    {todos.map(todo => {
                      // TODO: Feature: Allow drag/drop sorting
                      return (
                        <li
                          key={todo._tempId}
                          className="new-todo-list__todo-item"
                        >
                          <span className="new-todo-list__todo-text">
                            {todo.name}
                          </span>
                          <TokenDismissButton
                            className="new-todo-list__todo-dismiss"
                            type="button"
                            onClick={e => {
                              const target = e.currentTarget;
                              const parent =
                                target.parentElement?.parentElement
                                  ?.parentElement;
                              const currentValue =
                                parent?.querySelector<HTMLInputElement>(
                                  'input[type="text"]'
                                )?.value;
                              setTodos(todos =>
                                todos.filter(t => t._tempId !== todo._tempId)
                              );
                              if (state === "WRITING_TODO") {
                                window.requestAnimationFrame(() => {
                                  const nextInput =
                                    parent?.querySelector<HTMLInputElement>(
                                      'input[type="text"]'
                                    );
                                  if (nextInput) {
                                    nextInput.value = currentValue || "";
                                    nextInput.focus({ preventScroll: true });
                                  }
                                });
                              }
                            }}
                            aria-label={`Remove "${todo.name}" from list`}
                            title="Remove"
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {state === "WRITING_TODO" ? (
                  <input
                    className="new-todo-list__new-input"
                    placeholder="What should you do?"
                    type="text"
                    key={todos.length}
                    onBlur={() => setState("IDLE")}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = e.target as HTMLInputElement;
                        const value = target.value;
                        if (value.trim()) {
                          setTodos(todos =>
                            todos.concat({
                              name: value,
                              _tempId: Date.now()
                            })
                          );
                          const parent = target.parentElement;
                          window.requestAnimationFrame(() => {
                            parent
                              ?.querySelector<HTMLInputElement>(
                                'input[type="text"]'
                              )
                              ?.focus({ preventScroll: true });
                          });
                        } else {
                          setState("IDLE");
                          const parent = target.parentElement;
                          window.requestAnimationFrame(() => {
                            parent
                              ?.querySelector<HTMLInputElement>("button")
                              ?.focus({ preventScroll: true });
                          });
                        }
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="new-todo-list__new-button"
                    onClick={e => {
                      e.preventDefault();
                      const button = e.currentTarget;
                      const parent = button.parentElement;
                      setState("WRITING_TODO");
                      window.requestAnimationFrame(() => {
                        parent
                          ?.querySelector<HTMLInputElement>(
                            'input[type="text"]'
                          )
                          ?.focus({ preventScroll: true });
                      });
                    }}
                  >
                    Add new todo
                  </button>
                )}
              </div>
            ) : null}

            <input type="hidden" name="todos" value={JSON.stringify(todos)} />
            <Button className="new-todo-list__form-submit">Create List</Button>
          </div>
        </Form>
      </div>
    </MaxContainer>
  );
};

export default NewTodoList;

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

function handleTodoListFocus(event: React.FocusEvent<HTMLUListElement>) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const listItem = target.parentElement!;
  const list = listItem.parentElement!;
  for (const button of list.querySelectorAll("li button")) {
    button.setAttribute(
      "tabIndex",
      button.parentElement === listItem ? "0" : "-1"
    );
  }
}

function handleTodoListBlur(event: React.FocusEvent<HTMLUListElement>) {
  const list = event.currentTarget;
  if (!list.contains(event.relatedTarget)) {
    for (const button of list.querySelectorAll("li button")) {
      button.removeAttribute("tabIndex");
    }
  }
}

function handleTodoListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
  if (
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End"
    ].includes(event.key)
  ) {
    return;
  }

  const list = event.currentTarget!;
  const activeElement = document.activeElement as HTMLElement | null;
  const listButtons = Array.from(
    list.querySelectorAll<HTMLButtonElement>("li button")
  );
  const currentIndex = listButtons.findIndex(el => el === activeElement);

  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp": {
      if (currentIndex === 0) {
        listButtons[listButtons.length - 1].focus();
      } else {
        listButtons[(currentIndex - 1) % listButtons.length]?.focus();
      }
      return;
    }
    case "ArrowRight":
    case "ArrowDown": {
      listButtons[(currentIndex + 1) % listButtons.length]?.focus();
      return;
    }
    case "Home":
      listButtons[0].focus();
      return;
    case "End":
      listButtons[listButtons.length - 1].focus();
      return;
  }
}

interface LoaderData {
  user: UserSecure;
  projects: Project[];
}

interface ActionData {
  formError?: string;
  fieldErrors?: FieldErrors;
  fields?: Record<TextFields | SelectFields, string>;
}

type FieldErrors = Record<TextFields | SelectFields, string | undefined | null>;

type TextFields = "name" | "description" | "todos";
type SelectFields = "project";
