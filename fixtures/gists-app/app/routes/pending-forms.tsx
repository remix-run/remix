import styles from "../styles/pending-forms.css";
import { useEffect, useRef, useState } from "react";
import {
  json,
  useLoaderData,
  useActionData,
  Form,
  usePendingFormSubmit
} from "remix";

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

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

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
  let ref = useRef<HTMLFormElement>(null);
  let pending = usePendingFormSubmit();
  let thisIsPending = pending?.data.get("id") === task.id;
  let actionData = useActionData();
  let error = actionData?.id === task.id && actionData.error;

  return (
    <Form method="post" ref={ref}>
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="complete" value={String(!task.complete)} />
      <button
        disabled={!!pending}
        type="submit"
        data-status={
          error ? "error" : task.complete ? "complete" : "incomplete"
        }
      >
        {task.complete ? "Mark Incomplete" : "Mark Complete"}
        {thisIsPending && <ProgressBar total={task.delay} />}
      </button>{" "}
      {task.name} {error && <span style={{ color: "red" }}>{error}</span>}
    </Form>
  );
}

function ProgressBar({ total }: { total: number }) {
  let [ts, setTimeStamp] = useState(0);
  let [start, setStart] = useState<null | number>(null);

  useEffect(() => {
    let id = requestAnimationFrame(now => {
      setTimeStamp(now);
      if (!start) setStart(now);
    });
    return () => cancelAnimationFrame(id);
  }, [ts, start]);

  let progress = 0;
  if (start) {
    let elapsed = ts - start;
    progress = (elapsed / total) * 100;
  }

  return <progress value={progress} max="100" />;
}
