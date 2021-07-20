import styles from "../styles/pending-forms.css";
import { useEffect, useState } from "react";
import {
  json,
  useLoaderData,
  useActionData,
  Form,
  useSubmission,
  Link
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
    delay: 1000
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
      <p>
        <Link to="/gists">Gists</Link>
      </p>
    </div>
  );
}

function TaskItem({ task }: { task: Task }) {
  let submission = useSubmission(task.id);
  let actionData = useActionData(task.id);

  return (
    <Form replace id={task.id} method="post">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="complete" value={String(!task.complete)} />
      <button
        type="submit"
        data-status={
          actionData?.error
            ? "error"
            : task.complete
            ? "complete"
            : "incomplete"
        }
      >
        {task.complete ? "Mark Incomplete" : "Mark Complete"}
        {submission && <ProgressBar key={submission.id} total={task.delay} />}
      </button>{" "}
      {task.name}{" "}
      {actionData?.error && (
        <span style={{ color: "red" }}>Error! {actionData.error}</span>
      )}
    </Form>
  );
}

function ProgressBar({ total }: { total: number }) {
  let [ts, setTimeStamp] = useState(0);
  let [start, setStart] = useState<null | number>(null);

  let progress = 0;
  if (start) {
    let elapsed = ts - start;
    progress = (elapsed / total) * 100;
  }

  useEffect(() => {
    if (progress >= 100) return;
    let id = requestAnimationFrame(now => {
      setTimeStamp(now);
      if (!start) setStart(now);
    });
    return () => cancelAnimationFrame(id);
  }, [start, progress]);

  return <progress value={progress} max="100" />;
}
