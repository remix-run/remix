import { PrismaClient } from "@prisma/client";
import type {
  MembersOnProjects,
  Project as PrismaProject
} from "@prisma/client";
import type {
  Project,
  Todo,
  TodoDataUnordered,
  TodoDataOrdered,
  TodoList,
  User,
  UserSecure
} from "~/models";
import bcrypt from "bcrypt";

const __DEV__ = process.env.NODE_ENV === "development";

interface TodoListData {
  name: TodoList["name"];
  description?: TodoList["description"];
  todos?: Array<TodoDataUnordered>;
  projectId?: TodoList["projectId"];
}

let prisma: PrismaClient;

declare global {
  var db: PrismaClient;
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.db) {
    global.db = new PrismaClient();
  }
  prisma = global.db;
}

export async function getUser(
  key: "id" | "email",
  value: string
): Promise<User | null>;
export async function getUser(id: User["id"]): Promise<User | null>;

export async function getUser(
  id: string,
  value?: string
): Promise<User | null> {
  if (value != null) {
    if (!["id", "email"].includes(id)) {
      throw Error(
        "Invalid key provided to getUser. Must be either `id` or `email`."
      );
    }
    return await prisma.user.findUnique({
      where: { [id as "id"]: value }
    });
  }
  return await prisma.user.findUnique({
    where: { id }
  });
}

export async function getUserSecure(
  key: "id" | "email",
  value: string
): Promise<User | null>;
export async function getUserSecure(
  id: string,
  value: never
): Promise<User | null>;

export async function getUserSecure(
  id: string,
  value?: string
): Promise<UserSecure | null> {
  // @ts-ignore
  const user = await getUser(id, value);
  if (user) {
    const { passwordHash, ...secureUser } = user;
    return secureUser;
  }
  return null;
}

export async function getUsers(): Promise<Array<UserSecure>> {
  const users = await prisma.user.findMany();
  return users.map(user => {
    const { passwordHash, ...secureUser } = user;
    return secureUser;
  });
}

export async function deleteUser(userId: User["id"]) {
  await prisma.user.delete({
    where: {
      id: userId
    }
  });
}

export async function createUser({
  email,
  nameFirst,
  nameLast,
  timeZone,
  title,
  avatar,
  password,
  projects
}: {
  email: string;
  password: string;
  nameFirst: string;
  nameLast?: string | null;
  title?: string | null;
  timeZone?: string | null;
  avatar?: { url: string };
  projects?: Array<Project["id"]>;
}) {
  const passwordHash = await bcrypt.hash(password, 10);

  const createArgs: Parameters<typeof prisma.user.create>[0] = {
    data: {
      email,
      nameFirst: nameFirst,
      nameLast: nameLast || null,
      timeZone: timeZone || null,
      title: title || null,
      avatar: avatar?.url || null,
      passwordHash
    }
  };

  if (projects && projects.length > 0) {
    createArgs.data.projects = {
      create: projects.map(id => {
        return {
          project: {
            connect: { id }
          }
        };
      })
    };
  }

  return await prisma.user.create({
    data: {
      email,
      nameFirst: nameFirst,
      nameLast: nameLast || null,
      timeZone: timeZone || null,
      title: title || null,
      avatar: avatar?.url || null,
      passwordHash
    }
  });
}

export async function verifyLogin(
  email: string,
  password: string
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw Error("User not found");
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw Error("Incorrect password");
  }

  return user;
}

export async function createProject({
  name,
  description,
  ownerId,
  todoLists,
  members
}: {
  name: string;
  ownerId: User["id"];
  description?: string;
  todoLists?: Array<TodoListData>;
  members?: Array<User["id"]>;
}): Promise<Project> {
  members = members ? [...members, ownerId] : [ownerId];

  return modelProject(
    await prisma.project.create({
      data: {
        name,
        description: description || null,
        ownerId,
        members: {
          create: members.map(id => {
            return {
              user: { connect: { id } }
            };
          })
        },
        todoLists: {
          create: (todoLists || []).map(({ todos, ...list }) => {
            return {
              ...list,
              todos: {
                create:
                  todos?.map((todo, index) => {
                    return {
                      ...todo,
                      order: index
                    };
                  }) || []
              }
            };
          })
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        todoLists: {
          include: {
            todos: {
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        }
      }
    })
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: true
        }
      },
      todoLists: {
        include: {
          todos: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }
    }
  });
  return project
    ? {
        ...project,
        members: project.members.map(member => {
          return {
            ...member.user
          };
        })
      }
    : null;
}

export async function getProjects(): Promise<Project[]> {
  const projects =
    (await prisma.project.findMany({
      include: {
        members: {
          include: {
            user: true
          }
        },
        todoLists: {
          include: {
            todos: {
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        }
      }
    })) || [];

  return projects.map(modelProject);
}

export async function getUserProjects(userId: User["id"]): Promise<Project[]> {
  const projects =
    (await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        todoLists: {
          include: {
            todos: {
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        }
      }
    })) || [];

  return projects.map(modelProject);
}

export async function updateProject(
  id: string,
  {
    members,
    ...data
  }: Partial<Pick<Project, "name" | "description" | "ownerId">> & {
    members?: { add?: string[]; remove?: string[] };
  }
): Promise<Project | null> {
  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: data.name || undefined,
        description: data.description || undefined,
        ownerId: data.ownerId || undefined,
        members: {
          create: (members?.add || []).map(userId => {
            return {
              userId
            };
          }),

          delete: (members?.remove || []).map(userId => {
            return {
              userId_projectId: {
                projectId: id,
                userId
              }
            };
          })
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        todoLists: {
          include: {
            todos: {
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        }
      }
    });
    return modelProject(project);
  } catch (error) {
    if (__DEV__) console.error(error);
    throw error;
  }
}

export async function deleteProject(id: string) {
  try {
    const project = await prisma.project.delete({
      where: { id },
      include: {
        members: {
          include: {
            user: true
          }
        },
        todoLists: {
          include: {
            todos: {
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        }
      }
    });
    return project && modelProject(project);
  } catch (error) {
    if (__DEV__) console.error(error);
    throw error;
  }
}

export async function createTodoList({
  name,
  description,
  todos,
  projectId
}: TodoListData): Promise<TodoList> {
  return await prisma.todoList.create({
    data: {
      name,
      description: description || null,
      projectId: projectId || null,
      todos: {
        create: (todos || []).map((todo, index) => {
          return {
            ...todo,
            order: index
          };
        })
      }
    },
    include: {
      todos: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function getTodoList(id: string): Promise<TodoList | null> {
  return await prisma.todoList.findUnique({
    where: { id },
    include: {
      todos: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function updateTodoList(
  id: string,
  data: Partial<Omit<TodoList, "id" | "todos">>
): Promise<TodoList | null> {
  return await prisma.todoList.update({
    where: { id },
    data,
    include: {
      todos: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function deleteTodoList(id: string): Promise<TodoList> {
  return await prisma.todoList.delete({
    where: { id },
    include: {
      todos: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function createTodo({
  name,
  order,
  description,
  ownerId,
  todoListId
}: TodoDataOrdered): Promise<Todo> {
  return await prisma.todo.create({
    data: {
      name,
      todoListId,
      order,
      description: description || null,
      ownerId: ownerId || null
    }
  });
}

export async function getTodo(id: Todo["id"]): Promise<Todo | null> {
  return await prisma.todo.findUnique({
    where: { id }
  });
}

export async function getAllTodos(): Promise<Todo[]> {
  return await prisma.todo.findMany({
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function getTodosFromList(
  listId: TodoList["id"]
): Promise<Todo[]> {
  return await prisma.todo.findMany({
    where: {
      todoListId: listId
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function getAllTodoLists(): Promise<TodoList[]> {
  return await prisma.todoList.findMany({
    include: {
      todos: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function updateTodo(
  id: string,
  data: Partial<Omit<Todo, "id">>
): Promise<Todo | null> {
  return await prisma.todo.update({
    where: { id },
    data
  });
}

export async function deleteTodo(id: Todo["id"]) {
  return await prisma.todo.delete({
    where: { id }
  });
}

function getProjectMembers(
  project: PrismaProject & {
    todoLists: TodoList[];
    members: (MembersOnProjects & {
      user: User;
    })[];
  }
): UserSecure[] {
  const members = project.members.map(member => {
    const { passwordHash, ...secureUser } = member.user;
    return secureUser;
  });
  return members;
}

function modelProject(
  project: PrismaProject & {
    todoLists: TodoList[];
    members: (MembersOnProjects & {
      user: User;
    })[];
  }
): Project {
  return {
    ...project,
    members: getProjectMembers(project)
  };
}
