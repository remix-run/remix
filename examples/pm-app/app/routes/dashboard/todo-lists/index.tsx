import * as React from "react";
import { getAllTodoLists } from "~/db.server";
import { useLoaderData, Link } from "remix";
import type { LoaderFunction } from "remix";
import type { TodoList } from "~/models";
import { requireUser } from "~/session.server";

export const loader: LoaderFunction = async ({ request }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });

  const lists = await getAllTodoLists();
  return {
    lists
  };
};

export default function AllLists() {
  const loaderData = useLoaderData();
  const lists: TodoList[] = loaderData.lists;

  return (
    <div>
      {lists.map(list => {
        return (
          <div key={list.id} className="flex gap-2">
            <div>Name: {list.name}</div>
            <div>ID: {list.id}</div>
            <div>
              Project:{" "}
              <Link to={`/dashboard/projects/${list.projectId}`}>
                {list.projectId}
              </Link>
            </div>
            <div>
              Todos:{" "}
              {list.todos.length > 0 ? (
                <ul>
                  {list.todos.map(todo => (
                    <li key={todo.id}>{todo.name}</li>
                  ))}
                </ul>
              ) : (
                "None"
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
