import { useOptionalUser } from "~/useUser";

export default function Index() {
  const user = useOptionalUser();

  return (
    <div>
      <h1>Index Page</h1>
      <p>Current user (accessed via useMatches): {user?.name}</p>
    </div>
  );
}
