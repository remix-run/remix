import styles from "../styles/pending-forms.css";
import { useEffect, useState } from "react";
import type { LoaderFunction } from "remix";
import {
  json,
  useLoaderData,
  useActionData,
  useFetcher,
  Form,
  useTransition,
  Link
} from "remix";
import { useSearchParams } from "react-router-dom";

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

export let loader: LoaderFunction = async ({ request }) => {
  let searchParams = new URL(request.url).searchParams;

  if (searchParams.has("q")) {
    // await new Promise(res => setTimeout(res, 1000));
    return tasks.filter(task =>
      task.name.toLowerCase().includes(searchParams.get("q")!.toLowerCase())
    );
  }

  return tasks;
};

export async function action({ request }: { request: Request }) {
  let body = new URLSearchParams(await request.text());
  let id = body.get("id");
  let complete = JSON.parse(body.get("complete")!);
  let task = tasks.find(t => t.id === id)!;

  // fake delay
  await new Promise(res => setTimeout(res, task.delay));

  if (id === "giveup") {
    return json({ error: "NEVER GIVE UP!" }, { status: 500 });
  }

  task.complete = complete;

  return json(task);
}

export default function Tasks() {
  let tasks = useLoaderData<Task[]>();
  let [searchParams] = useSearchParams();

  return (
    <div>
      <h2>Filter Tasks</h2>
      <FilterForm />

      <hr />
      <h2>Tasks</h2>
      {searchParams.has("q") && (
        <p>
          Filtered by search: <i>{searchParams.get("q")}</i>
        </p>
      )}

      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
      <p>
        <Link to="/gists">Gists</Link>
      </p>
    </div>
  );
}

function FilterForm() {
  let transition = useTransition();
  let [searchParams] = useSearchParams();

  return (
    <Form method="get">
      <input type="text" name="q" defaultValue={searchParams.get("q") || ""} />{" "}
      <button type="submit">Go</button>
      {transition.type === "loaderSubmission" ? (
        <p>Searching for: {transition.submission.formData.get("q")}...</p>
      ) : (
        <p>&nbsp;</p>
      )}
    </Form>
  );
}

function TaskItem({ task }: { task: Task }) {
  let toggleComplete = useFetcher();

  let renderedTask =
    toggleComplete.type === "done" && !toggleComplete.data.error
      ? toggleComplete.data
      : task;

  return (
    <toggleComplete.Form method="post">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="complete" value={String(!task.complete)} />
      <button
        type="submit"
        data-status={
          toggleComplete.data?.error
            ? "error"
            : task.complete
            ? "complete"
            : "incomplete"
        }
      >
        {renderedTask.complete ? "Mark Incomplete" : "Mark Complete"}
        {toggleComplete.state === "submitting" && (
          <ProgressBar key={toggleComplete.submission.key} total={task.delay} />
        )}
      </button>{" "}
      {task.name}{" "}
      {toggleComplete.type === "done" && toggleComplete.data.error && (
        <span style={{ color: "red" }}>Error! {toggleComplete.data.error}</span>
      )}
    </toggleComplete.Form>
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
