import * as React from "react";
import { useFetcher, useFetchers } from "remix";
import type { Todo } from "~/models";
import cx from "clsx";
import { Token } from "~/ui/token";

export function TodoList({
  className,
  children
}: React.PropsWithChildren<{ className?: string }>) {
  return <ul className={cx(className, "ui--todo-list")}>{children}</ul>;
}

export function TodoItem({
  todo,
  className
}: {
  todo: Todo;
  className?: string;
}) {
  const fetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const deleteFormRef = React.useRef<HTMLFormElement | null>(null);

  const isCompleted = fetcher.submission
    ? Boolean(fetcher.submission.formData.get("complete"))
    : todo.completed;

  const fetchers = useFetchers();

  let isCreating = false;
  for (const fetcher of fetchers) {
    if (fetcher.type === "actionSubmission") {
      if (fetcher.submission.action.startsWith("/dashboard/todos/new")) {
        isCreating = true;
      }
    }
  }

  return (
    <li
      className={cx(className, "ui--todo-list__item flex gap-2", {
        "ui--todo-list__item--completed": isCompleted
      })}
    >
      <fetcher.Form method="post" action={`/dashboard/todos/${todo.id}/edit`}>
        <label>
          <input
            className="ui--todo-list__checkbox"
            name="id"
            type="checkbox"
            checked={isCompleted}
            onChange={e => fetcher.submit(e.target.form)}
            disabled={isCreating || undefined}
          />
          <span>{todo.name}</span>
        </label>
      </fetcher.Form>
      <deleteFetcher.Form
        ref={deleteFormRef}
        method="post"
        action={`/dashboard/todos/${todo.id}/delete`}
      >
        <input type="hidden" name="listId" value={todo.todoListId} />
        <input type="hidden" name="todoId" value={todo.id} />
        <button aria-label={`Delete todo: ${todo.name}`}>
          <input type="hidden" value="none" />
          <Token>Delete</Token>
        </button>
      </deleteFetcher.Form>
    </li>
  );
}
