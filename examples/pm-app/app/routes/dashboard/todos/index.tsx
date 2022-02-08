import * as React from "react";
import { getAllTodos, getTodo, updateTodo } from "~/db.server";
import type { ActionFunction } from "remix";
import { useLoaderData, useActionData, Form, useTransition } from "remix";
import type { Todo } from "~/models";

export const loader = async () => {
  const todos = await getAllTodos();
  return {
    todos
  };
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const todoId = formData.get("update") as string;
  const orderRaw = formData.get("order") || "";
  let todo = await getTodo(todoId);
  if (typeof orderRaw === "string" && orderRaw) {
    const order = parseInt(orderRaw, 10);
    if (todo && order !== todo.order) {
      todo = await updateTodo(todoId, { order });
    }
  }
  return { todo };
};

export default function Llllll() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const transtion = useTransition();
  const todos: Todo[] = loaderData.todos;
  const nextTodo: Todo | null = actionData?.todo || null;

  const keyMapRef = React.useRef<Map<string, string>>();
  if (!keyMapRef.current) {
    keyMapRef.current = new Map();
  }
  const keyMap = keyMapRef.current;

  if (nextTodo && transtion.state === "idle") {
    keyMap.delete(nextTodo.id);
  }

  return (
    <div>
      {todos.map(todo => {
        let inputKey = keyMap.get(todo.id);
        if (inputKey == null) {
          inputKey = Math.random().toString().slice(2);
          keyMap.set(todo.id, inputKey);
        }
        return (
          <Form key={todo.id} method="post">
            <div className="flex gap-2">
              <div>Name: {todo.name}</div>
              <div>List: {todo.todoListId}</div>
              <div>
                Order:{" "}
                <input
                  type="text"
                  defaultValue={String(todo.order ?? "")}
                  key={inputKey}
                  name="order"
                />
              </div>
              <button name="update" value={todo.id}>
                Update
              </button>
            </div>
          </Form>
        );
      })}
      {nextTodo ? <p>Todo "{nextTodo.name}" order updated!</p> : null}
    </div>
  );
}
