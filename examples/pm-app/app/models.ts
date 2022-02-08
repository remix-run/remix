import type {
  User,
  Project as _Project,
  TodoList as _TodoList,
  Todo
} from "@prisma/client";

export type { User, Todo };

export type Project = _Project & {
  members: UserSecure[];
  todoLists: TodoList[];
};

export type TodoList = _TodoList & {
  todos: Todo[];
};

export type UserSecure = Omit<User, "passwordHash">;
export type UserPublic = Omit<User, "passwordHash" | "createdAt" | "updatedAt">;
export type TodoData = Omit<
  Pick<Todo, "name" | "todoListId"> &
    Partial<Omit<Todo, "name" | "todoListId">>,
  "createdAt" | "updatedAt"
>;
export type TodoDataUnordered = Omit<TodoData, "order" | "todoListId"> & {
  order?: never;
  todoListId?: never;
};
export type TodoDataOrdered = Omit<TodoData, "order" | "todoListId"> &
  Required<Pick<TodoData, "order" | "todoListId">>;
