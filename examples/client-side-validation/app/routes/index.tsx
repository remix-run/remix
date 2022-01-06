import { redirect } from "remix";

export function loader() {
  return redirect('/example');
}

export default function Index() {
  return;
}
