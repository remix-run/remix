import { json, useLoaderData, useActionData, Form } from "remix";

interface Task {
  id: string;
  name: string;
  complete: boolean;
  delay: number;
}

let tasks: Task[] = [
  {
    id: "taco",
    name: "Eat tacos",
    complete: false,
    delay: 3000
  },
  {
    id: "puppy",
    name: "Adopt a puppy",
    complete: false,
    delay: 2000
  },
  {
    id: "giveup",
    name: "Give up",
    complete: false,
    delay: 1000
  }
];

export async function loader() {
  return tasks;
}

export async function action({ request }: { request: Request }) {
  let body = new URLSearchParams(await request.text());
  let id = body.get("id");
  let complete = JSON.parse(body.get("complete")!);
  let task = tasks.find(t => t.id === id)!;

  // fake delay
  await new Promise(res => setTimeout(res, task.delay));

  if (id === "giveup") {
    return json(
      {
        id,
        error: "NEVER GIVE UP!"
      },
      { status: 500 }
    );
  }

  task.complete = complete;

  return json("ok");
}

export default function Tasks() {
  let tasks = useLoaderData<Task[]>();
  return (
    <div>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}

function TaskItem({ task }: { task: Task }) {
  let actionData = useActionData();
  let error = actionData?.id === task.id && actionData.error;

  return (
    <Form forceRefresh method="post">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="complete" value={String(!task.complete)} />
      <button
        type="submit"
        style={{
          width: "10rem",
          fontSize: "80%",
          background: error ? "red" : task.complete ? "green" : "blue"
        }}
      >
        {task.complete ? "Mark Incomplete" : "Mark Complete"}
      </button>{" "}
      {task.name} {error && <span style={{ color: "red" }}>{error}</span>}
    </Form>
  );
}
