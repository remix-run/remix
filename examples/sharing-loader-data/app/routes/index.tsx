import { useMatches, Link } from "remix";
import type { User } from "~/data.server";

export default function Index() {
  // the root route will always be the first match
  const rootData = useMatches()[0].data as { user: User };
  return (
    <div>
      <h1>Hi there, {rootData.user.name}</h1>
      <Link to="workshops">/workshops</Link>
    </div>
  );
}
